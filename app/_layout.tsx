'use client'
import { useEffect, useState, useRef } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Animated, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { supabase } from '@/lib/supabase'
import { ThemeProvider, useTheme } from '@/lib/theme'
import type { Session } from '@supabase/supabase-js'

// How long the GIF plays before fading out (ms)
const INTRO_MS = 2500

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
  const [showIntro, setShowIntro] = useState(true)
  const fadeAnim   = useRef(new Animated.Value(1)).current
  const router     = useRouter()
  const segments   = useSegments()
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

  // After INTRO_MS, fade out over 400ms then unmount the overlay
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setShowIntro(false))
    }, INTRO_MS)
    return () => clearTimeout(t)
  }, [fadeAnim])

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
      {showIntro && (
        <Animated.View style={[styles.intro, { opacity: fadeAnim }]}>
          <Image
            source={require('../assets/intro.gif')}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
          />
        </Animated.View>
      )}
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  intro: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 999,
  },
})
