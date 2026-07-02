import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'
import { showAlert } from '@/lib/ui'

// Gate for accounts that are authenticated but not yet provisioned
// (Google sign-ups, or email sign-ups confirmed after registration).
// Requires a counselor/admin invite code and privacy-policy acceptance
// before the account row is created via redeem_invite.
export default function CompleteSetupScreen() {
  const C      = useColors()
  const s      = mkS(C)
  const router = useRouter()

  const [booting, setBooting]   = useState(true)
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [code, setCode]         = useState('')
  const [codeRole, setCodeRole] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    const boot = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/(auth)/login'); return }

      // Self-heal: if the account is already provisioned, route by role.
      const { data: row } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
      if (row) {
        router.replace(row.role === 'admin' ? '/(admin)/dashboard' : '/(main)/home')
        return
      }

      const meta = user.user_metadata ?? {}
      setName(meta.full_name ?? meta.name ?? '')
      setEmail(user.email ?? '')

      // Email-confirmation flow stores the code at registration time.
      if (user.email) {
        const pending = await AsyncStorage.getItem(`pending_invite_${user.email.toLowerCase()}`)
        if (pending) setCode(pending.toUpperCase())
      }
      setBooting(false)
    }
    boot()
  }, [])

  const verifyCode = async () => {
    if (!code.trim()) { showAlert('Invite Code', 'Enter your invite code first'); return }
    setChecking(true)
    const { data, error } = await supabase.rpc('check_invite', { p_code: code })
    setChecking(false)
    if (error || !data) {
      setCodeRole(null)
      showAlert('Invalid Code', 'This invite code is invalid or expired. Ask your counselor or admin for a new one.')
      return
    }
    setCodeRole(data)
  }

  const complete = async () => {
    if (!codeRole || !accepted || saving) return
    if (!name.trim()) { showAlert('Name required', 'Please enter your full name.'); return }
    setSaving(true)
    const { data: role, error } = await supabase.rpc('redeem_invite', { p_code: code, p_name: name.trim() })
    if (error) { setSaving(false); showAlert('Setup Failed', error.message); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('users').update({ privacy_accepted_at: new Date().toISOString() }).eq('id', user.id)
      if (user.email) AsyncStorage.removeItem(`pending_invite_${user.email.toLowerCase()}`)
    }
    setSaving(false)
    router.replace(role === 'admin' ? '/(admin)/dashboard' : '/(main)/home')
  }

  const cancel = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  if (booting) return (
    <View style={[s.bg, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={C.blue} size="large" />
    </View>
  )

  return (
    <ScrollView style={s.bg} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      <View style={s.hero}>
        <View style={s.logoContainer}>
          <Image source={require('../../assets/icon.png')} style={s.logo} resizeMode="contain" />
        </View>
        <Text style={s.brandName}>WhiteRock Connect</Text>
        <Text style={s.title}>Almost there</Text>
        <Text style={s.subtitle}>Connect is invite-only. Enter the code from your counselor or admin to activate {email ? `\n${email}` : 'your account'}.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.label}>FULL NAME</Text>
        <View style={s.inputWrap}>
          <Ionicons name="person-outline" size={16} color={C.slate400} style={s.inputIcon} />
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Your full name" placeholderTextColor={C.slate400} />
        </View>

        <Text style={[s.label, { marginTop: 16 }]}>INVITE CODE</Text>
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
          : <Text style={s.codeHint}>No code? Ask your counselor or admin.</Text>}

        <TouchableOpacity style={s.acceptRow} onPress={() => setAccepted(a => !a)} activeOpacity={0.8}>
          <View style={[s.checkbox, accepted && s.checkboxOn]}>
            {accepted && <Ionicons name="checkmark" size={13} color={C.white} />}
          </View>
          <Text style={s.acceptTxt}>
            I have read and agree to the{' '}
            <Text style={s.link} onPress={() => router.push('/(auth)/policy?type=privacy')}>Privacy Policy</Text>
            {' '}and{' '}
            <Text style={s.link} onPress={() => router.push('/(auth)/policy?type=company')}>Company Policy</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btn, (!codeRole || !accepted || saving) && { opacity: 0.5 }]}
          onPress={complete}
          disabled={!codeRole || !accepted || saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Activate Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={cancel} style={s.switchRow}>
          <Text style={s.cancelLink}>Use a different account? <Text style={s.cancelBold}>Sign out</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:            { flex: 1, backgroundColor: C.bg },
  container:     { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingTop: 60 },
  hero:          { alignItems: 'center', marginBottom: 28 },
  logoContainer: { width: 80, height: 80, borderRadius: 20, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  logo:          { width: 50, height: 50 },
  brandName:     { fontSize: 13, fontWeight: '700', color: C.blue, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  title:         { fontSize: 28, fontWeight: '800', color: C.navy },
  subtitle:      { fontSize: 14, color: C.slate500, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  card:          { width: '100%', maxWidth: 400, backgroundColor: C.white, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  label:         { fontSize: 10, fontWeight: '800', color: C.slate500, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  inputWrap:     { flexDirection: 'row', alignItems: 'center', height: 54, backgroundColor: C.bg, borderRadius: 18, borderWidth: 1, borderColor: C.slate200 },
  inputIcon:     { marginLeft: 14, marginRight: 4 },
  input:         { flex: 1, height: 52, paddingHorizontal: 10, fontSize: 14, color: C.navy },
  codeRow:       { flexDirection: 'row', gap: 8 },
  codeInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 54, backgroundColor: C.bg, borderRadius: 18, paddingHorizontal: 14, borderWidth: 1, borderColor: C.slate200 },
  codeInput:     { flex: 1, fontSize: 14, color: C.navy, letterSpacing: 2, fontWeight: '700' },
  verifyBtn:     { height: 52, paddingHorizontal: 18, borderRadius: 18, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  verifyBtnOk:   { backgroundColor: C.green400 + '18', borderWidth: 1.5, borderColor: C.green400 + '40' },
  verifyText:    { color: C.white, fontWeight: '700', fontSize: 13 },
  codeOk:        { fontSize: 12, color: C.green400, fontWeight: '700', marginTop: 8 },
  codeHint:      { fontSize: 11, color: C.slate400, marginTop: 8 },
  acceptRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 20 },
  checkbox:      { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: C.slate200, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxOn:    { backgroundColor: C.blue, borderColor: C.blue },
  acceptTxt:     { flex: 1, fontSize: 12, color: C.slate500, lineHeight: 18 },
  link:          { color: C.blue, fontWeight: '700' },
  btn:           { height: 54, backgroundColor: C.blue, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20, shadowColor: C.blue, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  btnText:       { color: C.white, fontWeight: '800', fontSize: 16 },
  switchRow:     { marginTop: 16, paddingVertical: 12 },
  cancelLink:    { fontSize: 14, color: C.slate500, textAlign: 'center' },
  cancelBold:    { color: C.red500, fontWeight: '700' },
})
