import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { AppHeader } from '@/components/AppHeader'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}: ${msg}`)
  } else {
    Alert.alert(title, msg)
  }
}

export default function SettingsScreen() {
  const C = useColors()
  const s = mkS(C)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  // Notification Prefs
  const [pushEnabled, setPushEnabled] = useState(true)
  const [emailDigest, setEmailDigest] = useState(false)
  const [marketing, setEmailMarketing] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('users').select('preferences').eq('id', user.id).maybeSingle()
        const p = (data as any)?.preferences ?? {}
        setPushEnabled(p.push_enabled !== false)
        setEmailDigest(!!p.email_digest)
        setEmailMarketing(!!p.marketing_emails)
      }
      setLoading(false)
    }
    load()
  }, [])

  const togglePref = async (key: string, val: boolean) => {
    if (key === 'push_enabled') setPushEnabled(val)
    if (key === 'email_digest') setEmailDigest(val)
    if (key === 'marketing_emails') setEmailMarketing(val)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('users').select('preferences').eq('id', user.id).maybeSingle()
    const p = { ...((data as any)?.preferences ?? {}), [key]: val }
    await supabase.from('users').update({ preferences: p }).eq('id', user.id)
  }

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to sign out?')) {
        setSigningOut(true)
        supabase.auth.signOut()
      }
      return
    }

    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => { setSigningOut(true); await supabase.auth.signOut() },
      },
    ])
  }

  const handleDeleteAccount = () => {
    if (Platform.OS === 'web') {
      if (confirm('This is permanent. All your data will be deleted. Are you sure?')) {
        supabase.functions.invoke('delete-own-account').then(res => {
          if (!res.error) supabase.auth.signOut()
          else showAlert('Error', res.error.message)
        })
      }
      return
    }

    Alert.alert(
      'Delete Account',
      'This is permanent. All your data will be deleted. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            const { data, error } = await supabase.functions.invoke('delete-own-account')
            if (error) showAlert('Error', error.message)
            else await supabase.auth.signOut()
          }
        }
      ]
    )
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>

  return (
    <View style={s.bg}>
      <AppHeader title="Settings" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <Text style={s.sectionLabel}>NOTIFICATIONS</Text>
        <View style={s.card}>
          <View style={[s.row, s.border]}>
            <View style={s.info}>
              <Text style={s.rowLabel}>Push Notifications</Text>
              <Text style={s.rowSub}>Alerts about messages and status</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={v => togglePref('push_enabled', v)}
              trackColor={{ false: C.slate200, true: C.blue + '66' }}
              thumbColor={pushEnabled ? C.blue : C.slate400}
            />
          </View>
          <View style={[s.row, s.border]}>
            <View style={s.info}>
              <Text style={s.rowLabel}>Email Digest</Text>
              <Text style={s.rowSub}>Weekly summary of your progress</Text>
            </View>
            <Switch
              value={emailDigest}
              onValueChange={v => togglePref('email_digest', v)}
              trackColor={{ false: C.slate200, true: C.blue + '66' }}
              thumbColor={emailDigest ? C.blue : C.slate400}
            />
          </View>
          <View style={s.row}>
            <View style={s.info}>
              <Text style={s.rowLabel}>University News</Text>
              <Text style={s.rowSub}>Occasional scholarship & event alerts</Text>
            </View>
            <Switch
              value={marketing}
              onValueChange={v => togglePref('marketing_emails', v)}
              trackColor={{ false: C.slate200, true: C.blue + '66' }}
              thumbColor={marketing ? C.blue : C.slate400}
            />
          </View>
        </View>

        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <View style={s.card}>
          <TouchableOpacity style={[s.row, s.border]} onPress={handleSignOut}>
            <Text style={[s.rowLabel, { color: C.red500 }]}>Sign Out</Text>
            <Ionicons name="log-out-outline" size={18} color={C.red500} />
          </TouchableOpacity>
          <TouchableOpacity style={s.row} onPress={handleDeleteAccount}>
            <Text style={[s.rowLabel, { color: C.red500 }]}>Delete Account</Text>
            <Ionicons name="trash-outline" size={18} color={C.red500} />
          </TouchableOpacity>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Connect v1.0.8</Text>
          <Text style={s.footerText}>Premium UK Student Placement</Text>
        </View>
      </ScrollView>
      {signingOut && (
        <View style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.blue} size="large" />
          </View>
        </View>
      )}
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:           { flex: 1, backgroundColor: C.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.slate400, marginLeft: 20, marginTop: 24, marginBottom: 8, letterSpacing: 1 },
  card:         { backgroundColor: C.white, borderRadius: 16, marginHorizontal: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  row:          { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  border:       { borderBottomWidth: 1, borderColor: C.slate100 },
  info:         { flex: 1 },
  rowLabel:     { fontSize: 15, fontWeight: '600', color: C.navy },
  rowSub:       { fontSize: 12, color: C.slate400, marginTop: 2 },
  footer:       { marginTop: 40, alignItems: 'center', gap: 4 },
  footerText:   { fontSize: 11, color: C.slate400, fontWeight: '600' },
})
