import { useEffect, useState, useRef } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '@/lib/supabase'
import { ThemeProvider, useTheme } from '@/lib/theme'
import type { Session } from '@supabase/supabase-js'

function ThemedRoot() {
  const { isDark } = useTheme()
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Slot />
    </>
  )
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router    = useRouter()
  const segments  = useSegments()
  // Guard against re-entrant navigation while a redirect is in flight
  const navigating = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (loading) return

    const inAuth = segments[0] === '(auth)'

    if (!session) {
      if (!inAuth && !navigating.current) {
        navigating.current = true
        router.replace('/(auth)/login')
        setTimeout(() => { navigating.current = false }, 1500)
      }
      return
    }

    if (inAuth && !navigating.current) {
      navigating.current = true
      supabase.from('users').select('role').eq('id', session.user.id).single()
        .then(({ data }) => {
          const r = data?.role ?? 'student'
          if (r === 'admin') router.replace('/(admin)/dashboard')
          else router.replace('/(main)/home')
        })
        .catch(() => router.replace('/(main)/home'))
        .finally(() => { setTimeout(() => { navigating.current = false }, 1500) })
    }
  // NOTE: 'role' deliberately excluded — including it caused the effect to
  // re-run after setRole(), double-navigating and crashing on login.
  // Each screen fetches its own role from Supabase directly.
  }, [session, loading, segments])

  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  )
}
