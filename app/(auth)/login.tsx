import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Modal, Image, Platform
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as GoogleSignin from '@react-native-google-signin/google-signin'
import Constants from 'expo-constants'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

// Web OAuth client (client_type 3 in google-services.json) — required by
// GoogleSignin.configure so Google returns an ID token Supabase can verify.
const GOOGLE_WEB_CLIENT_ID = '149816206182-anl9ku2qei82mbgu1kih5s54nh09k59p.apps.googleusercontent.com'
const IS_EXPO_GO = Constants.appOwnership === 'expo'

const isErrorWithCode = (error: any): error is { code: string } => {
  return typeof error === 'object' && error !== null && 'code' in error
}

const statusCodes = (GoogleSignin as any).statusCodes ?? {}

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}: ${msg}`)
  } else {
    Alert.alert(title, msg)
  }
}

// Guard against invalid addresses before triggering a reset email — bounced
// emails threaten the project's sending privileges.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Lighten an #RRGGBB color toward white — used for the CTA gradient's end stop.
const lighten = (hex: string, amt: number) => {
  const n = parseInt(hex.replace('#', ''), 16)
  const mix = (c: number) => Math.min(255, Math.round(c + (255 - c) * amt))
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export default function LoginScreen() {
  const C = useColors()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  // Forgot password
  const [forgotModal, setForgotModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSending, setResetSending] = useState(false)

  const s = mkS(C)

  useEffect(() => {
    // configure() is mandatory before signIn(); without it every attempt
    // fails. Skipped on web (web uses Supabase OAuth) and in Expo Go
    // (native module not present there).
    if (Platform.OS === 'web' || IS_EXPO_GO) return
    try {
      GoogleSignin.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID })
    } catch {}
  }, [])

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('Required', 'Please enter both email and password.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      showAlert('Sign In Failed', error.message)
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) return
    if (!EMAIL_RE.test(resetEmail.trim())) { showAlert('Invalid Email', 'Please double-check the email address.'); return }
    setResetSending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: 'whiterock://reset-password',
    })
    setResetSending(false)
    if (error) {
      showAlert('Error', error.message)
    } else {
      setForgotModal(false)
      showAlert('Email Sent', `A reset link has been sent to ${resetEmail.trim()}.`)
    }
  }

  const handleGoogleSignIn = async () => {
    if (Platform.OS === 'web') {
      try {
        setGoogleLoading(true)
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        })
        if (error) throw error
      } catch (err: any) {
        showAlert('Sign In Failed', err.message ?? 'Could not sign in with Google')
        setGoogleLoading(false)
      }
      return
    }

    if (IS_EXPO_GO) {
      showAlert(
        'Not available in Expo Go',
        'Google Sign-In needs the installed app. Download the APK from the releases page, or sign in with email and password here.',
      )
      return
    }

    try {
      setGoogleLoading(true)
      await GoogleSignin.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
      // Drop any lingering native Google session so the account picker always
      // shows — otherwise Google silently reuses the previous account.
      await GoogleSignin.GoogleSignin.signOut().catch(() => {})
      const response = await GoogleSignin.GoogleSignin.signIn()
      const idToken = (response as any).data?.idToken ?? (response as any).idToken
      if (!idToken) throw new Error('No ID token returned from Google')

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      })
      if (error) throw error

      // Accounts are invite-only: never auto-provision a users row here.
      // First-time Google sign-ins must redeem a counselor/admin invite
      // code (and accept the policies) on the complete-setup gate.
      if (data.user) {
        const { data: row } = await supabase.from('users').select('id').eq('id', data.user.id).maybeSingle()
        if (!row) router.replace('/(auth)/complete-setup')
      }
    } catch (err: any) {
      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.SIGN_IN_CANCELLED) return
        if (err.code === statusCodes.IN_PROGRESS) return
        if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          showAlert('Error', 'Google Play Services not available on this device.')
          return
        }
      }
      showAlert('Sign In Failed', err.message ?? 'Could not sign in with Google')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <View style={s.bg}>
      {/* Decorative wave glow, bottom-left */}
      <View pointerEvents="none" style={s.glowWrap}>
        <View style={[s.glowRing, { width: 340, height: 340, borderRadius: 170 }]} />
        <View style={[s.glowRing, { width: 260, height: 260, borderRadius: 130, left: 40, bottom: 40 }]} />
        <View style={[s.glowRing, { width: 180, height: 180, borderRadius: 90, left: 80, bottom: 80 }]} />
        <View style={s.glowFill} />
      </View>

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          <Image source={require('../../assets/icon.png')} style={s.logo} resizeMode="contain" />
          <Text style={s.brandName}>WHITEROCK CONNECT</Text>
          <Text style={s.title}>Welcome Back</Text>
          <Text style={s.subtitle}>Secure access to your global{'\n'}placement dashboard</Text>
        </View>

        <View style={s.form}>
          <View style={s.field}>
            <View style={s.fieldIcon}><Ionicons name="mail-outline" size={18} color={C.blue} /></View>
            <View style={s.fieldBody}>
              <Text style={s.fieldLabel}>Email Address</Text>
              <TextInput
                style={s.fieldInput} value={email} onChangeText={setEmail}
                placeholder="you@example.com" placeholderTextColor={C.slate400}
                keyboardType="email-address" autoCapitalize="none" autoComplete="email"
              />
            </View>
          </View>

          <View style={s.field}>
            <View style={s.fieldIcon}><Ionicons name="lock-closed-outline" size={18} color={C.blue} /></View>
            <View style={s.fieldBody}>
              <Text style={s.fieldLabel}>Password</Text>
              <TextInput
                style={s.fieldInput}
                value={password} onChangeText={setPassword}
                placeholder="Enter your password" placeholderTextColor={C.slate400}
                secureTextEntry={!showPw} autoComplete="password"
              />
            </View>
            <TouchableOpacity onPress={() => setShowPw(!showPw)} style={s.eyeBtn}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={19} color={C.slate400} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.forgotLink} onPress={() => { setResetEmail(email); setForgotModal(true) }}>
            <Text style={s.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLogin} disabled={loading || googleLoading} activeOpacity={0.85}>
            <LinearGradient
              colors={[C.blue, lighten(C.blue, 0.35)]}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={s.btn}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Text style={s.btnText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={19} color="#fff" />
                  </>}
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>OR</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity
            style={[s.googleBtn, (loading || googleLoading) && { opacity: 0.6 }]}
            onPress={handleGoogleSignIn}
            disabled={loading || googleLoading}
            activeOpacity={0.75}
          >
            {googleLoading ? (
              <ActivityIndicator color={C.navy} size="small" style={{ marginRight: 4 }} />
            ) : (
              <View style={s.googleG}>
                <Text style={s.googleGText}>G</Text>
              </View>
            )}
            <Text style={s.googleText}>Sign In With Google</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={s.switchRow}>
          <Text style={s.registerLink}>
            New to Connect?{'  '}
            <Text style={s.registerBold}>Create account  →</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={forgotModal} transparent animationType="slide" onRequestClose={() => setForgotModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Reset Password</Text>
            <Text style={s.modalSub}>Enter your email and we'll send you a reset link</Text>
            <View style={s.field}>
              <View style={s.fieldIcon}><Ionicons name="mail-outline" size={18} color={C.blue} /></View>
              <View style={s.fieldBody}>
                <Text style={s.fieldLabel}>Email Address</Text>
                <TextInput
                  style={s.fieldInput}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={C.slate400}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                />
              </View>
            </View>
            <TouchableOpacity onPress={handleForgotPassword} disabled={resetSending || !resetEmail.trim()} activeOpacity={0.85}>
              <LinearGradient
                colors={[C.blue, lighten(C.blue, 0.35)]}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                style={[s.btn, (resetSending || !resetEmail.trim()) && { opacity: 0.5 }]}
              >
                {resetSending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnText}>Send Reset Link</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={s.switchRow} onPress={() => setForgotModal(false)}>
              <Text style={s.registerLink}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:           { flex: 1, backgroundColor: 'transparent' },
  glowWrap:     { position: 'absolute', left: -90, bottom: -90 },
  glowRing:     { position: 'absolute', left: 0, bottom: 0, borderWidth: 1, borderColor: C.blue + '26' },
  glowFill:     { position: 'absolute', left: -30, bottom: -30, width: 300, height: 300, borderRadius: 150, backgroundColor: C.blue + '0A' },
  container:    { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 40 },
  hero:         { alignItems: 'center', marginBottom: 34 },
  logo:         { width: 96, height: 96, marginBottom: 14 },
  brandName:    { fontSize: 13, fontWeight: '700', color: C.blue, letterSpacing: 4, marginBottom: 14 },
  title:        { fontSize: 34, fontWeight: '800', color: C.navy, textAlign: 'center', letterSpacing: -0.5 },
  subtitle:     { fontSize: 15, color: C.slate500, textAlign: 'center', marginTop: 10, lineHeight: 23 },
  form:         { width: '100%', maxWidth: 420, alignSelf: 'center' },
  field:        { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 19, borderWidth: 1, borderColor: C.slate200, backgroundColor: C.white + '66', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  fieldIcon:    { width: 42, height: 42, borderRadius: 13, backgroundColor: C.blue + '14', alignItems: 'center', justifyContent: 'center' },
  fieldBody:    { flex: 1 },
  fieldLabel:   { fontSize: 12, fontWeight: '600', color: C.slate400, marginBottom: 1 },
  fieldInput:   { fontSize: 15.5, color: C.navy, paddingVertical: Platform.OS === 'ios' ? 3 : 0, paddingHorizontal: 0 },
  eyeBtn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  forgotLink:   { alignSelf: 'flex-end', paddingVertical: 6, marginBottom: 12 },
  forgotText:   { fontSize: 13.5, color: C.blue, fontWeight: '600' },
  btn:          { height: 56, borderRadius: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: C.blue, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  btnText:      { color: '#fff', fontWeight: '800', fontSize: 17 },
  divider:      { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  dividerLine:  { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.slate200 },
  dividerText:  { fontSize: 12, color: C.slate400, fontWeight: '600', marginHorizontal: 14, letterSpacing: 1 },
  googleBtn:    { borderRadius: 19, borderWidth: 1, borderColor: C.slate200, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54 },
  googleG:      { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 },
  googleGText:  { fontSize: 14, fontWeight: '800', color: '#4285F4' },
  googleText:   { fontSize: 15.5, fontWeight: '700', color: C.navy },
  switchRow:    { paddingVertical: 18, marginTop: 6 },
  registerLink: { fontSize: 14.5, color: C.slate500, textAlign: 'center' },
  registerBold: { color: C.blue, fontWeight: '700' },
  modalBg:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  modal:        { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, width: '100%', maxWidth: 480 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: C.navy, marginBottom: 4 },
  modalSub:     { fontSize: 14, color: C.slate500, marginBottom: 22 },
})
