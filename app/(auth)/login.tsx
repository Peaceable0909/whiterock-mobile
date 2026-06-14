import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

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
          <Ionicons name="school-outline" size={32} color="#fff" />
        </View>
        <Text style={s.title}>Welcome Back</Text>
        <Text style={s.subtitle}>Secure access to your global{'\n'}recruitment dashboard</Text>
      </View>

      {/* Card */}
      <View style={s.card}>
        <Text style={s.label}>EMAIL ADDRESS</Text>
        <TextInput
          style={s.input} value={email} onChangeText={setEmail}
          placeholder="you@example.com" placeholderTextColor={C.slate400}
          keyboardType="email-address" autoCapitalize="none" autoComplete="email"
        />

        <Text style={[s.label, { marginTop: 16 }]}>PASSWORD</Text>
        <View style={s.pwWrap}>
          <TextInput
            style={[s.input, { flex: 1, marginBottom: 0 }]}
            value={password} onChangeText={setPassword}
            placeholder="Enter your password" placeholderTextColor={C.slate400}
            secureTextEntry={!showPw} autoComplete="password"
          />
          <TouchableOpacity onPress={() => setShowPw(!showPw)} style={s.eyeBtn}>
            {showPw
              ? <Ionicons name="eye-off-outline" size={18} color={C.slate400} />
              : <Ionicons name="eye-outline"     size={18} color={C.slate400} />}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Login</Text>}
        </TouchableOpacity>

        {/* OR divider */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>OR</Text>
          <View style={s.dividerLine} />
        </View>

        <TouchableOpacity style={s.googleBtn} onPress={() => Alert.alert('Google Sign-In', 'Use Google Sign-In via browser on the web app.')}>
          <Text style={s.googleText}>Sign In With Google</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
        <Text style={s.registerLink}>
          New to WhiteRock Connect?{' '}
          <Text style={s.registerBold}>Create account</Text>
        </Text>
      </TouchableOpacity>

      <Text style={s.version}>WhiteRock Connect v1.0.0{'\n'}Premium UK Student Placement</Text>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  bg:          { flex: 1, backgroundColor: C.bg },
  container:   { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hero:        { alignItems: 'center', marginBottom: 28 },
  iconBox:     { width: 64, height: 64, borderRadius: 18, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: C.blue, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  title:       { fontSize: 26, fontWeight: '800', color: C.navy, textAlign: 'center' },
  subtitle:    { fontSize: 14, color: C.slate500, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  card:        { width: '100%', backgroundColor: C.white, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3, marginBottom: 16 },
  label:       { fontSize: 10, fontWeight: '800', color: C.slate500, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  input:       { height: 48, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 16, fontSize: 14, color: C.navy, borderWidth: 1, borderColor: C.slate200, marginBottom: 4 },
  pwWrap:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.slate200, borderRadius: 12, backgroundColor: C.bg, marginBottom: 4 },
  eyeBtn:      { paddingHorizontal: 14 },
  btn:         { height: 48, backgroundColor: C.blue, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20, shadowColor: C.blue, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  btnText:     { color: C.white, fontWeight: '700', fontSize: 15 },
  divider:     { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.slate100 },
  dividerText: { fontSize: 12, color: C.slate400, fontWeight: '600', marginHorizontal: 12 },
  googleBtn:   { height: 48, backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.slate200, alignItems: 'center', justifyContent: 'center' },
  googleText:  { fontSize: 14, fontWeight: '600', color: C.navy },
  registerLink:{ fontSize: 14, color: C.slate500, textAlign: 'center', marginTop: 8 },
  registerBold:{ color: C.blue, fontWeight: '700' },
  version:     { fontSize: 10, color: C.slate400, textAlign: 'center', marginTop: 24, lineHeight: 16 },
})
