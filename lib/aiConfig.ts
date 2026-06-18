import { supabase } from './supabase'

// Module-level cache — fetched once per app session from ai_rules table.
let _cached: string | null = null
let _pending: Promise<string | null> | null = null

export async function getAiAvatarUrl(): Promise<string | null> {
  if (_cached !== null) return _cached
  if (!_pending) {
    _pending = supabase
      .from('ai_rules')
      .select('value')
      .eq('key', 'ai_avatar_url')
      .single()
      .then(({ data }) => { _cached = data?.value ?? null; return _cached })
      .catch(() => null)
  }
  return _pending
}
