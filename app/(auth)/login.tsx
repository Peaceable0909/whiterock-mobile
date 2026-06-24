import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, Modal, Image, Platform
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as GoogleSignin from '@react-native-google-signin/google-signin'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const VERSION = '1.0.8'

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

    try {
      setGoogleLoading(true)
      await GoogleSignin.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
      const response = await GoogleSignin.GoogleSignin.signIn()
      const idToken = (response as any).data?.idToken ?? (response as any).idToken
      if (!idToken) throw new Error('No ID token returned from Google')

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      })
      if (error) throw error

      if (data.user) {
        const meta = data.user.user_metadata
        const name = meta?.full_name ?? meta?.name ?? data.user.email?.split('@')[0] ?? 'User'
        await supabase.from('users').upsert(
          { id: data.user.id, email: data.user.email ?? '', name },
          { onConflict: 'id', ignoreDuplicates: true }
        )
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
    <ScrollView style={s.bg} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <View style={s.hero}>
        <View style={s.logoContainer}>
          <Image
            source={require('../../assets/icon.png')}
            style={s.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={s.brandName}>WhiteRock Connect</Text>
        <Text style={s.title}>Welcome Back</Text>
        <Text style={s.subtitle}>Secure access to your global{'\n'}placement dashboard</Text>
      </View>

      <View style={s.card}>
        <Text style={s.label}>EMAIL ADDRESS</Text>
        <View style={s.inputWrap}>
          <Ionicons name="mail-outline" size={16} color={C.slate400} style={s.inputIcon} />
          <TextInput
            style={s.input} value={email} onChangeText={setEmail}
            placeholder="you@example.com" placeholderTextColor={C.slate400}
            keyboardType="email-address" autoCapitalize="none" autoComplete="email"
          />
        </View>

        <Text style={[s.label, { marginTop: 16 }]}>PASSWORD</Text>
        <View style={s.inputWrap}>
          <Ionicons name="lock-closed-outline" size={16} color={C.slate400} style={s.inputIcon} />
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={password} onChangeText={setPassword}
            placeholder="Enter your password" placeholderTextColor={C.slate400}
            secureTextEntry={!showPw} autoComplete="password"
          />
          <TouchableOpacity onPress={() => setShowPw(!showPw)} style={s.eyeBtn}>
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.slate400} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.forgotLink} onPress={() => { setResetEmail(email); setForgotModal(true) }}>
          <Text style={s.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading || googleLoading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Sign In</Text>}
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
          New to Connect?{' '}
          <Text style={s.registerBold}>Create account</Text>
        </Text>
      </TouchableOpacity>

      <Text style={s.version}>v{VERSION} · Premium UK Student Placement</Text>

      <Modal visible={forgotModal} transparent animationType="slide" onRequestClose={() => setForgotModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Reset Password</Text>
            <Text style={s.modalSub}>Enter your email and we'll send you a reset link</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={16} color={C.slate400} style={s.inputIcon} />
              <TextInput
                style={s.input}
                value={resetEmail}
                onChangeText={setResetEmail}
                placeholder="you@example.com"
                placeholderTextColor={C.slate400}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[s.btn, (resetSending || !resetEmail.trim()) && { opacity: 0.5 }]}
              onPress={handleForgotPassword}
              disabled={resetSending || !resetEmail.trim()}
            >
              {resetSending
                ? <ActivityIndicator color={C.white} />
                : <Text style={s.btnText}>Send Reset Link</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.switchRow} onPress={() => setForgotModal(false)}>
              <Text style={s.registerLink}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:           { flex: 1, backgroundColor: C.bg },
  container:    { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingTop: 60 },
  hero:         { alignItems: 'center', marginBottom: 32 },
  logoContainer:{ width: 80, height: 80, borderRadius: 20, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  logo:         { width: 50, height: 50 },
  brandName:    { fontSize: 13, fontWeight: '700', color: C.blue, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  title:        { fontSize: 28, fontWeight: '800', color: C.navy, textAlign: 'center' },
  subtitle:     { fontSize: 14, color: C.slate500, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  card:         { width: '100%', maxWidth: 400, backgroundColor: C.white, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3, marginBottom: 16 },
  label:        { fontSize: 10, fontWeight: '800', color: C.slate500, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', height: 52, backgroundColor: C.bg, borderRadius: 14, borderWidth: 1, borderColor: C.slate200, marginBottom: 4 },
  inputIcon:    { marginLeft: 14, marginRight: 4 },
  input:        { flex: 1, height: 52, paddingHorizontal: 10, fontSize: 14, color: C.navy },
  eyeBtn:       { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  btn:          { height: 54, backgroundColor: C.blue, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20, shadowColor: C.blue, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  btnText:      { color: C.white, fontWeight: '800', fontSize: 16 },
  divider:      { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: C.slate100 },
  dividerText:  { fontSize: 12, color: C.slate400, fontWeight: '600', marginHorizontal: 12 },
  googleBtn:    { backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5, borderColor: C.slate200, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, height: 54 },
  googleG:      { width: 24, height: 24, borderRadius: 12, backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center' },
  googleGText:  { fontSize: 13, fontWeight: '800', color: C.white },
  googleText:   { fontSize: 15, fontWeight: '700', color: C.navy },
  forgotLink:   { alignSelf: 'flex-end', paddingVertical: 8, marginTop: 4 },
  forgotText:   { fontSize: 13, color: C.blue, fontWeight: '600' },
  switchRow:    { paddingVertical: 12 },
  registerLink: { fontSize: 14, color: C.slate500, textAlign: 'center' },
  registerBold: { color: C.blue, fontWeight: '700' },
  version:      { fontSize: 10, color: C.slate400, textAlign: 'center', marginTop: 24, letterSpacing: 0.5 },
  modalBg:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  modal:        { backgroundColor: C.white, borderRadius: 28, padding: 24, margin: 16, marginBottom: 40, width: '100%', maxWidth: 400 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: C.navy, marginBottom: 4 },
  modalSub:     { fontSize: 14, color: C.slate500, marginBottom: 24 },
})
