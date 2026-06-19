import { useEffect, useState, useRef } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Animated, Image, StyleSheet, View } from 'react-native'
import { supabase } from '@/lib/supabase'
import { ThemeProvider, useTheme } from '@/lib/theme'
import type { Session } from '@supabase/supabase-js'

// Total intro duration in ms (logo visible → fade-out starts)
const HOLD_MS  = 1700
const FADE_MS  = 500
const INTRO_MS = HOLD_MS + FADE_MS   // ~2.2s visible, gone by 2.5s

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
  const [session,   setSession]   = useState<Session | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [showIntro, setShowIntro] = useState(true)

  const logoScale   = useRef(new Animated.Value(0.82)).current
  const logoOpacity = useRef(new Animated.Value(0)).current
  const bgOpacity   = useRef(new Animated.Value(1)).current

  const router     = useRouter()
  const segments   = useSegments()
  const navigating = useRef(false)

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Intro animation: logo scales + fades in, then whole overlay fades out
  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale,   { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      const t = setTimeout(() => {
        Animated.timing(bgOpacity, {
          toValue: 0,
          duration: FADE_MS,
          useNativeDriver: true,
        }).start(() => setShowIntro(false))
      }, HOLD_MS)
      return () => clearTimeout(t)
    })
  }, [])

  // Navigation
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
  // NOTE: 'role' deliberately excluded — re-running after setRole() caused
  // double-navigation and crashes on login.
  }, [session, loading, segments])

  return (
    <ThemeProvider>
      <ThemedRoot />
      {showIntro && (
        <Animated.View style={[s.overlay, { opacity: bgOpacity }]}>
          <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
            <Image
              source={require('../assets/icon.png')}
              style={s.logo}
              resizeMode="contain"
            />
          </Animated.View>
        </Animated.View>
      )}
    </ThemeProvider>
  )
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logo: {
    width: 140,
    height: 140,
  },
})
