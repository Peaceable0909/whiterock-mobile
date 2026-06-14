import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Sentry from '@sentry/react-native'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,
  tracesSampleRate: 0.1,
  attachScreenshot: true,
})

export default function RootLayout() {
  const [session, setSession]   = useState<Session | null>(null)
  const [loading, setLoading]   = useState(true)
  const router  = useRouter()
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (loading) return
    const inAuth = segments[0] === '(auth)'
    if (!session && !inAuth) router.replace('/(auth)/login')
    if (session  &&  inAuth) router.replace('/(main)/home')
  }, [session, loading, segments])

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  )
}
