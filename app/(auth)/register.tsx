import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { useRouter } from 'expo-router'
import { GraduationCap, KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

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
          <GraduationCap color="#fff" size={32} />
        </View>
        <Text style={s.title}>Create Account</Text>
        <Text style={s.subtitle}>WhiteRock Connect is invite-only</Text>
      </View>

      <View style={s.card}>
        {/* Invite code */}
        <Text style={s.label}>INVITE CODE</Text>
        <View style={s.codeRow}>
          <View style={s.codeInputWrap}>
            <KeyRound size={16} color={C.slate400} />
            <TextInput
              style={s.codeInput} value={code}
              onChangeText={t => { setCode(t.toUpperCase()); setCodeRole(null) }}
              placeholder="WR-XXXXXX" placeholderTextColor={C.slate400}
              autoCapitalize="characters"
            />
          </View>
          <TouchableOpacity style={[s.verifyBtn, codeRole && s.verifyBtnOk]} onPress={verifyCode} disabled={checking || !!codeRole}>
            {checking ? <ActivityIndicator color="#fff" size="small" />
              : codeRole ? <CheckCircle2 size={16} color="#16A34A" />
              : <Text style={s.verifyText}>Verify</Text>}
          </TouchableOpacity>
        </View>
        {codeRole
          ? <Text style={s.codeOk}>✓ You&apos;ll join as: {codeRole}</Text>
          : <Text style={s.codeHint}>Don&apos;t have a code? Ask your WhiteRock agent.</Text>}

        <Text style={[s.label, { marginTop: 16 }]}>FULL NAME</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor={C.slate400} autoComplete="name" />

        <Text style={[s.label, { marginTop: 16 }]}>EMAIL ADDRESS</Text>
        <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={C.slate400} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />

        <Text style={[s.label, { marginTop: 16 }]}>PASSWORD</Text>
        <View style={s.pwWrap}>
          <TextInput
            style={[s.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
            value={password} onChangeText={setPassword}
            placeholder="At least 6 characters" placeholderTextColor={C.slate400}
            secureTextEntry={!showPw}
          />
          <TouchableOpacity onPress={() => setShowPw(!showPw)} style={s.eyeBtn}>
            {showPw ? <EyeOff color={C.slate400} size={18} /> : <Eye color={C.slate400} size={18} />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[s.btn, !codeRole && { opacity: 0.5 }]} onPress={handleRegister} disabled={loading || !codeRole}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={s.loginLink}>Already have an account? <Text style={s.loginBold}>Sign in</Text></Text>
        </TouchableOpacity>
      </View>

      <Text style={s.version}>WhiteRock Connect v1.1.0</Text>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  bg:            { flex: 1, backgroundColor: C.bg },
  container:     { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hero:          { alignItems: 'center', marginBottom: 24 },
  iconBox:       { width: 64, height: 64, borderRadius: 18, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: C.blue, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  title:         { fontSize: 26, fontWeight: '800', color: C.navy },
  subtitle:      { fontSize: 14, color: C.slate500, marginTop: 6 },
  card:          { width: '100%', backgroundColor: C.white, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  label:         { fontSize: 10, fontWeight: '800', color: C.slate500, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  codeRow:       { flexDirection: 'row', gap: 8 },
  codeInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: C.slate200 },
  codeInput:     { flex: 1, fontSize: 14, color: C.navy, letterSpacing: 2, fontWeight: '700' },
  verifyBtn:     { height: 48, paddingHorizontal: 16, borderRadius: 12, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  verifyBtnOk:   { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  verifyText:    { color: C.white, fontWeight: '700', fontSize: 13 },
  codeOk:        { fontSize: 11, color: '#16A34A', fontWeight: '700', marginTop: 8, textTransform: 'capitalize' },
  codeHint:      { fontSize: 11, color: C.slate400, marginTop: 8 },
  input:         { height: 48, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 16, fontSize: 14, color: C.navy, borderWidth: 1, borderColor: C.slate200, marginBottom: 4 },
  pwWrap:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.slate200, borderRadius: 12, backgroundColor: C.bg },
  eyeBtn:        { paddingHorizontal: 14 },
  btn:           { height: 48, backgroundColor: C.blue, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20, elevation: 3 },
  btnText:       { color: C.white, fontWeight: '700', fontSize: 15 },
  loginLink:     { fontSize: 14, color: C.slate500, textAlign: 'center' },
  loginBold:     { color: C.blue, fontWeight: '700' },
  version:       { fontSize: 10, color: C.slate400, textAlign: 'center', marginTop: 20 },
})
