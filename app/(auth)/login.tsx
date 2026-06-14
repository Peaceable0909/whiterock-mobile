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

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please fill in all fields'); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { Alert.alert('Login Failed', error.message); setLoading(false); return }

    if (data.user) {
      const meta = data.user.user_metadata
      await supabase.from('users').upsert({
        id: data.user.id, email: data.user.email ?? '',
        name: meta?.name ?? data.user.email?.split('@')[0] ?? 'User',
        role: meta?.role ?? 'student',
      }, { onConflict: 'id' })
    }
    setLoading(false)
  }

  return (
    <ScrollView style={s.bg} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      {/* Brand */}
      <View style={s.hero}>
        <View style={s.iconBox}>
          <Ionicons name="airplane-outline" size={30} color="#fff" />
        </View>
        <Text style={s.wordmark}>WhiteRock Connect</Text>
        <Text style={s.title}>Welcome Back</Text>
        <Text style={s.subtitle}>Secure access to your global{'\n'}recruitment dashboard</Text>
      </View>

      {/* Card */}
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

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Sign In</Text>}
        </TouchableOpacity>

        {/* OR divider */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>OR</Text>
          <View style={s.dividerLine} />
        </View>

        <View style={s.googleBtn}>
          <View style={s.googleG}>
            <Text style={s.googleGText}>G</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.googleText}>Continue with Google</Text>
            <Text style={s.googleSub}>Available on the web app only</Text>
          </View>
          <Ionicons name="open-outline" size={14} color={C.slate400} />
        </View>
      </View>

      <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={s.switchRow}>
        <Text style={s.registerLink}>
          New to WhiteRock?{' '}
          <Text style={s.registerBold}>Create account</Text>
        </Text>
      </TouchableOpacity>

      <Text style={s.version}>v{VERSION} · Premium UK Student Placement</Text>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  bg:           { flex: 1, backgroundColor: C.bg },
  container:    { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hero:         { alignItems: 'center', marginBottom: 28 },
  iconBox:      { width: 72, height: 72, borderRadius: 22, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: C.blue, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  wordmark:     { fontSize: 13, fontWeight: '700', color: C.blue, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  title:        { fontSize: 28, fontWeight: '800', color: C.navy, textAlign: 'center' },
  subtitle:     { fontSize: 14, color: C.slate500, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  card:         { width: '100%', backgroundColor: C.white, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3, marginBottom: 16 },
  label:        { fontSize: 10, fontWeight: '800', color: C.slate500, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', height: 50, backgroundColor: C.bg, borderRadius: 14, borderWidth: 1, borderColor: C.slate200, marginBottom: 4 },
  inputIcon:    { marginLeft: 14, marginRight: 4 },
  input:        { flex: 1, height: 50, paddingHorizontal: 10, fontSize: 14, color: C.navy },
  eyeBtn:       { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  btn:          { height: 52, backgroundColor: C.blue, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20, shadowColor: C.blue, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  btnText:      { color: C.white, fontWeight: '800', fontSize: 16 },
  divider:      { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: C.slate100 },
  dividerText:  { fontSize: 12, color: C.slate400, fontWeight: '600', marginHorizontal: 12 },
  googleBtn:    { backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5, borderColor: C.slate200, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  googleG:      { width: 24, height: 24, borderRadius: 12, backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center' },
  googleGText:  { fontSize: 13, fontWeight: '800', color: C.white },
  googleText:   { fontSize: 14, fontWeight: '600', color: C.navy },
  googleSub:    { fontSize: 11, color: C.slate400, marginTop: 1 },
  switchRow:    { paddingVertical: 8 },
  registerLink: { fontSize: 14, color: C.slate500, textAlign: 'center' },
  registerBold: { color: C.blue, fontWeight: '700' },
  version:      { fontSize: 10, color: C.slate400, textAlign: 'center', marginTop: 20, letterSpacing: 0.5 },
})
