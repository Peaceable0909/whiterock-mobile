import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

const VERSION = Constants.expoConfig?.version ?? '1.0.0'

export default function RegisterScreen() {
  const router = useRouter()
  const [code, setCode]         = useState('')
  const [codeRole, setCodeRole] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)

  const verifyCode = async () => {
    if (!code.trim()) { Alert.alert('Invite Code', 'Enter your invite code first'); return }
    setChecking(true)
    const { data, error } = await supabase.rpc('check_invite', { p_code: code })
    setChecking(false)
    if (error || !data) {
      setCodeRole(null)
      Alert.alert('Invalid Code', 'This invite code is invalid or expired. Ask your agent for a new one.')
      return
    }
    setCodeRole(data)
  }

  const handleRegister = async () => {
    if (!codeRole) { Alert.alert('Invite Code', 'Verify your invite code first'); return }
    if (!name || !email || !password) { Alert.alert('Error', 'Please fill in all fields'); return }
    if (password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return }
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { name } },
    })
    if (error) { Alert.alert('Registration Failed', error.message); setLoading(false); return }

    if (data.session) {
      const { error: redeemErr } = await supabase.rpc('redeem_invite', { p_code: code, p_name: name })
      setLoading(false)
      if (redeemErr) { Alert.alert('Setup Failed', redeemErr.message); return }
      router.replace('/(main)/home')
    } else {
      setLoading(false)
      Alert.alert('Confirm Email', 'Check your email to confirm your account, then sign in. Keep your invite code handy.')
      router.back()
    }
  }

  return (
    <ScrollView style={s.bg} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <View style={s.hero}>
        <View style={s.iconBox}>
          <Ionicons name="airplane-outline" size={30} color="#fff" />
        </View>
        <Text style={s.wordmark}>WhiteRock Connect</Text>
        <Text style={s.title}>Create Account</Text>
        <Text style={s.subtitle}>Invite-only access · UK Student Placement</Text>
      </View>

      <View style={s.card}>
        {/* Invite code */}
        <Text style={s.label}>INVITE CODE</Text>
        <View style={s.codeRow}>
          <View style={s.codeInputWrap}>
            <Ionicons name="key-outline" size={16} color={C.slate400} />
            <TextInput
              style={s.codeInput} value={code}
              onChangeText={t => { setCode(t.toUpperCase()); setCodeRole(null) }}
              placeholder="WR-XXXXXX" placeholderTextColor={C.slate400}
              autoCapitalize="characters"
            />
          </View>
          <TouchableOpacity
            style={[s.verifyBtn, !!codeRole && s.verifyBtnOk]}
            onPress={verifyCode}
            disabled={checking || !!codeRole}
          >
            {checking
              ? <ActivityIndicator color="#fff" size="small" />
              : codeRole
                ? <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
                : <Text style={s.verifyText}>Verify</Text>}
          </TouchableOpacity>
        </View>
        {codeRole
          ? <Text style={s.codeOk}>✓ You&apos;ll join as: <Text style={{ textTransform: 'capitalize' }}>{codeRole}</Text></Text>
          : <Text style={s.codeHint}>Don&apos;t have a code? Ask your WhiteRock agent.</Text>}

        <Text style={[s.label, { marginTop: 20 }]}>FULL NAME</Text>
        <View style={s.inputWrap}>
          <Ionicons name="person-outline" size={16} color={C.slate400} style={s.inputIcon} />
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor={C.slate400} autoComplete="name" />
        </View>

        <Text style={[s.label, { marginTop: 16 }]}>EMAIL ADDRESS</Text>
        <View style={s.inputWrap}>
          <Ionicons name="mail-outline" size={16} color={C.slate400} style={s.inputIcon} />
          <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={C.slate400} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        </View>

        <Text style={[s.label, { marginTop: 16 }]}>PASSWORD</Text>
        <View style={s.inputWrap}>
          <Ionicons name="lock-closed-outline" size={16} color={C.slate400} style={s.inputIcon} />
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={password} onChangeText={setPassword}
            placeholder="At least 6 characters" placeholderTextColor={C.slate400}
            secureTextEntry={!showPw}
          />
          <TouchableOpacity onPress={() => setShowPw(!showPw)} style={s.eyeBtn}>
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.slate400} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[s.btn, (!codeRole || loading) && { opacity: 0.5 }]}
          onPress={handleRegister}
          disabled={loading || !codeRole}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={s.switchRow}>
          <Text style={s.loginLink}>Already have an account? <Text style={s.loginBold}>Sign in</Text></Text>
        </TouchableOpacity>
      </View>

      <Text style={s.version}>v{VERSION} · WhiteRock Connect</Text>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  bg:            { flex: 1, backgroundColor: C.bg },
  container:     { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hero:          { alignItems: 'center', marginBottom: 24 },
  iconBox:       { width: 72, height: 72, borderRadius: 22, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: C.blue, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  wordmark:      { fontSize: 13, fontWeight: '700', color: C.blue, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  title:         { fontSize: 28, fontWeight: '800', color: C.navy },
  subtitle:      { fontSize: 14, color: C.slate500, marginTop: 6, textAlign: 'center' },
  card:          { width: '100%', backgroundColor: C.white, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  label:         { fontSize: 10, fontWeight: '800', color: C.slate500, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  codeRow:       { flexDirection: 'row', gap: 8 },
  codeInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: C.slate200 },
  codeInput:     { flex: 1, fontSize: 14, color: C.navy, letterSpacing: 2, fontWeight: '700' },
  verifyBtn:     { height: 50, paddingHorizontal: 18, borderRadius: 14, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  verifyBtnOk:   { backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#BBF7D0' },
  verifyText:    { color: C.white, fontWeight: '700', fontSize: 13 },
  codeOk:        { fontSize: 12, color: '#16A34A', fontWeight: '700', marginTop: 8 },
  codeHint:      { fontSize: 11, color: C.slate400, marginTop: 8 },
  inputWrap:     { flexDirection: 'row', alignItems: 'center', height: 50, backgroundColor: C.bg, borderRadius: 14, borderWidth: 1, borderColor: C.slate200, marginBottom: 4 },
  inputIcon:     { marginLeft: 14, marginRight: 4 },
  input:         { flex: 1, height: 50, paddingHorizontal: 10, fontSize: 14, color: C.navy },
  eyeBtn:        { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  btn:           { height: 52, backgroundColor: C.blue, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20, shadowColor: C.blue, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  btnText:       { color: C.white, fontWeight: '800', fontSize: 16 },
  switchRow:     { marginTop: 16 },
  loginLink:     { fontSize: 14, color: C.slate500, textAlign: 'center' },
  loginBold:     { color: C.blue, fontWeight: '700' },
  version:       { fontSize: 10, color: C.slate400, textAlign: 'center', marginTop: 20, letterSpacing: 0.5 },
})
