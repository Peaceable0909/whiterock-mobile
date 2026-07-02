import { createClient } from 'jsr:@supabase/supabase-js@2'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const svc = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

export async function callerFrom(req: Request) {
  const auth = req.headers.get('Authorization') ?? ''
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data: { user } } = await anon.auth.getUser()
  return user
}

export async function gemini(parts: unknown[]): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) throw new Error('GEMINI_API_KEY secret is not set — add it in Supabase Dashboard → Edge Functions → Secrets')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    },
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  if (!text) throw new Error('Gemini returned an empty response')
  return text
}

// Memory is always recomputed from the CURRENT sources, so deleted documents
// automatically fall out of it and fresh uploads flow straight in.
export async function regenerateMemory(studentId: string) {
  const db = svc()
  const [{ data: facts }, { data: chats }, { data: convSums }, { data: profile }, { data: userRow }, { data: current }] = await Promise.all([
    db.from('document_facts').select('category, summary, extracted_fields').eq('student_id', studentId),
    db.from('ai_chat_messages').select('role, content').eq('user_id', studentId).order('created_at', { ascending: false }).limit(30),
    db.from('conversation_summaries').select('summary, key_points, pending_actions').eq('student_id', studentId).order('updated_at', { ascending: false }).limit(5),
    db.from('student_profiles').select('stage, school, program_of_interest, nationality, country_of_interest, intake').eq('user_id', studentId).maybeSingle(),
    db.from('users').select('name').eq('id', studentId).maybeSingle(),
    db.from('ai_student_memory').select('facts, summary').eq('student_id', studentId).maybeSingle(),
  ])

  const context = {
    name: userRow?.name ?? null,
    application_profile: profile ?? null,
    documents_on_file: (facts ?? []).map(f => ({ category: f.category, summary: f.summary, fields: f.extracted_fields })),
    recent_ai_chat: (chats ?? []).reverse().map(c => `${c.role}: ${String(c.content).slice(0, 400)}`),
    counselor_conversation_summaries: convSums ?? [],
    previous_memory: current ?? null,
  }

  const prompt = `You maintain the long-term memory an education-consultancy AI keeps about one student.
Rebuild the memory from the CURRENT sources below. Rules:
- Facts must come only from the sources provided. If a fact in previous_memory is not supported by any current source (for example its document was deleted), drop it.
- Prefer document evidence over conversation claims when they conflict, and record the conflict under an "inconsistencies" fact.
- Keep facts atomic and useful for advising: identity, nationality, date_of_birth, academics (institutions, qualifications, grades/GPA), english_test, finances_budget, target_country, target_universities, preferred_intake, scholarship_interest, work_experience, concerns, missing_documents, inconsistencies.
Return JSON exactly as: {"facts": {"<snake_case_key>": "<string value>"}, "summary": "<4-6 sentence advisor briefing about this student>"}

SOURCES:
${JSON.stringify(context).slice(0, 24000)}`

  const out = await gemini([{ text: prompt }])
  let parsed: { facts?: Record<string, unknown>; summary?: string }
  try { parsed = JSON.parse(out) } catch { throw new Error('Memory model returned invalid JSON') }

  await db.from('ai_student_memory').upsert({
    student_id: studentId,
    facts: parsed.facts ?? {},
    summary: parsed.summary ?? '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id' })

  return parsed
}
