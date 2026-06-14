import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole]       = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router   = useRouter()
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) setRole(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (loading) return
    const inAuth  = segments[0] === '(auth)'
    const inAdmin = segments[0] === '(admin)'

    if (!session) {
      if (!inAuth) router.replace('/(auth)/login')
      return
    }

    if (inAuth) {
      supabase.from('users').select('role').eq('id', session.user.id).single()
        .then(({ data }) => {
          const r = data?.role ?? 'student'
          setRole(r)
          if (r === 'admin') router.replace('/(admin)/dashboard')
          else router.replace('/(main)/home')
        })
      return
    }

    // Guard admin routes from non-admins once role is known
    if (inAdmin && role !== null && role !== 'admin') {
      router.replace('/(main)/home')
    }
  }, [session, loading, segments, role])

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  )
}
