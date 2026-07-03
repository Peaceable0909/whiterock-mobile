import { cors, svc, callerFrom, gemini, regenerateMemory } from './shared.ts'
import { encodeBase64 } from 'jsr:@std/encoding/base64'

const FIELD_HINTS: Record<string, string> = {
  passport:     'full_name, passport_number, nationality, date_of_birth, sex, issue_date, expiry_date, place_of_birth',
  bank:         'account_holder, bank_name, currency, closing_balance, statement_period, large_recent_deposits',
  academic:     'student_name, institution, qualification, subjects_and_grades, gpa_or_classification, completion_date',
  offer_letter: 'student_name, university, program, level, intake, conditions, tuition_fee, deposit_required, offer_type',
  cas:          'student_name, cas_number, university, program, course_start, course_end, tuition_fee, fee_paid',
  visa:         'holder_name, visa_type, issue_date, expiry_date, conditions',
  other:        'any identifying details, dates, institutions, amounts',
}

const IMG_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', gif: 'image/gif',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const fail = (msg: string, code = 400) =>
    new Response(JSON.stringify({ error: msg }), { status: code, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const user = await callerFrom(req)
    if (!user) return fail('Not authenticated', 401)
    const { documentId } = await req.json().catch(() => ({}))
    if (!documentId) return fail('documentId required')

    const db = svc()
    const { data: doc } = await db.from('documents')
      .select('id, student_id, category, url, original_name, file_type, size')
      .eq('id', documentId).maybeSingle()
    if (!doc) return fail('Document not found', 404)

    // Role separation: owner, assigned staff, or admin only.
    if (doc.student_id !== user.id) {
      const { data: me } = await db.from('users').select('role').eq('id', user.id).maybeSingle()
      if (me?.role === 'admin') {
        // ok
      } else if (me?.role === 'counselor' || me?.role === 'agent') {
        const { data: conv } = await db.from('conversations').select('id')
          .eq('student_id', doc.student_id)
          .or(`counselor_id.eq.${user.id},agent_id.eq.${user.id}`)
          .limit(1).maybeSingle()
        if (!conv) return fail('Not authorized for this student', 403)
      } else {
        return fail('Not authorized', 403)
      }
    }

    if ((doc.size ?? 0) > 15 * 1024 * 1024) return fail('File too large to analyze (15 MB max)')
    const ext = (doc.original_name ?? '').split('.').pop()?.toLowerCase() ?? ''
    const mime = doc.file_type === 'pdf' ? 'application/pdf' : IMG_MIME[ext] ?? (doc.file_type === 'image' ? 'image/jpeg' : null)
    if (!mime) return fail(`File type "${doc.file_type}" cannot be analyzed (images and PDFs only)`)

    const path = doc.url?.startsWith('http')
      ? decodeURIComponent(doc.url.replace(/.*\/object\/(?:public|sign)\/documents\//, '').split('?')[0])
      : doc.url
    const { data: blob, error: dlErr } = await db.storage.from('documents').download(path)
    if (dlErr || !blob) return fail(`Could not download file: ${dlErr?.message ?? 'unknown'}`, 500)
    const b64 = encodeBase64(new Uint8Array(await blob.arrayBuffer()))

    const hints = FIELD_HINTS[doc.category] ?? FIELD_HINTS.other
    const prompt = `You are analyzing a student's "${doc.category}" document ("${doc.original_name}") for a UK university admissions consultancy.
Extract the important information. Likely fields: ${hints}.
Also list any issues: expired dates, missing pages, unreadable sections, name mismatches, low balances (bank), weak grades (academic).
Return JSON exactly as: {"summary": "<3-4 sentences an advisor would want>", "fields": {"<snake_case_key>": "<string value>"}, "issues": ["<string>"]}`

    const out = await gemini([{ text: prompt }, { inlineData: { mimeType: mime, data: b64 } }])
    let parsed: { summary?: string; fields?: Record<string, unknown>; issues?: string[] }
    try { parsed = JSON.parse(out) } catch { return fail('Extraction model returned invalid JSON', 502) }

    await db.from('document_facts').upsert({
      document_id: doc.id,
      student_id: doc.student_id,
      category: doc.category,
      extracted_fields: { ...(parsed.fields ?? {}), ...(parsed.issues?.length ? { issues: parsed.issues } : {}) },
      summary: parsed.summary ?? '',
      model_used: 'gemini-2.5-flash',
      extracted_at: new Date().toISOString(),
    }, { onConflict: 'document_id' })
    await db.from('documents').update({ ai_analysis: parsed.summary ?? '' }).eq('id', doc.id)

    // Memory must reflect the new document immediately; extraction already
    // succeeded, so a memory failure is reported but not fatal.
    let memoryUpdated = true
    try { await regenerateMemory(doc.student_id) } catch { memoryUpdated = false }

    return new Response(JSON.stringify({ ok: true, summary: parsed.summary, memory_updated: memoryUpdated }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error', 500)
  }
})
