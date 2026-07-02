import { supabase, SUPABASE_URL, SUPABASE_ANON } from './supabase'

// Client for the AI pipeline edge functions (ai-extract-document,
// ai-update-memory). Both require the caller's JWT; authorization
// (owner / assigned staff / admin) is enforced inside the functions.

const call = async (fn: string, body: object) => {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON,
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `${fn} failed (${res.status})`)
  return json
}

/** Extract structured facts from an uploaded document and fold them into the student's memory. */
export const extractDocument = (documentId: string) =>
  call('ai-extract-document', { documentId })

/** Recompute a student's AI memory from current sources (documents, chats, profile). */
export const refreshStudentMemory = (studentId?: string) =>
  call('ai-update-memory', studentId ? { studentId } : {})
