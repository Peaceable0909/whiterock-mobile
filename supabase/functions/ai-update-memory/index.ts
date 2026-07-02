import { cors, svc, callerFrom, regenerateMemory } from './shared.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const fail = (msg: string, code = 400) =>
    new Response(JSON.stringify({ error: msg }), { status: code, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const user = await callerFrom(req)
    if (!user) return fail('Not authenticated', 401)
    const body = await req.json().catch(() => ({}))
    const studentId: string = body.studentId ?? user.id

    // Role separation: self, assigned staff, or admin only.
    if (studentId !== user.id) {
      const db = svc()
      const { data: me } = await db.from('users').select('role').eq('id', user.id).maybeSingle()
      if (me?.role === 'admin') {
        // ok
      } else if (me?.role === 'counselor' || me?.role === 'agent') {
        const { data: conv } = await db.from('conversations').select('id')
          .eq('student_id', studentId)
          .or(`counselor_id.eq.${user.id},agent_id.eq.${user.id}`)
          .limit(1).maybeSingle()
        if (!conv) return fail('Not authorized for this student', 403)
      } else {
        return fail('Not authorized', 403)
      }
    }

    const memory = await regenerateMemory(studentId)
    return new Response(JSON.stringify({ ok: true, summary: memory.summary }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error', 500)
  }
})
