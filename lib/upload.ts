import { supabase, SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'

// RN's fetch(uri).blob() cannot be serialized by supabase-js on Android;
// XHR + FormData is the only upload path that works reliably in Expo Go.
export const xhrUpload = async (bucket: string, path: string, uri: string, name: string, type: string) => {
  const { data: { session } } = await supabase.auth.getSession()
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`)
    xhr.setRequestHeader('apikey', SUPABASE_ANON)
    xhr.setRequestHeader('x-upsert', 'true')
    const fd = new FormData()
    fd.append('file', { uri, name, type } as any)
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText)))
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(fd)
  })
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
