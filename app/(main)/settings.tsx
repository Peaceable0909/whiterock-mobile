import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const VERSION = Constants.expoConfig?.version ?? '1.0.0'
const SUPABASE_URL = 'https://bpranhebhhtvcgcmuegd.supabase.co'

export default function SettingsScreen() {
  const C = useColors()
  const s = mkS(C)
  const router  = useRouter()
  const insets  = useSafeAreaInsets()
  const [user, setUser]           = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) return
      supabase.from('users').select('*').eq('id', authUser.id).single()
        .then(({ data }) => { setUser(data); setLoading(false) })
    })
  }, [])

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          await supabase.auth.signOut()
        },
      },
    ])
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever', style: 'destructive',
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            try {
              const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-own-account`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
              })
              if (res.ok) {
                await supabase.auth.signOut()
              } else {
                const body = await res.json().catch(() => ({}))
                Alert.alert('Error', body.error ?? 'Deletion failed. Contact support.')
              }
            } catch {
              Alert.alert('Error', 'Could not reach the server. Try again later.')
            }
          },
        },
      ]
    )
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>

  const initials = (user?.name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const roleLabel = (user?.role ?? 'student')
  const roleCap   = roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)

  return (
    <View style={[s.bg, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={20} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{user?.name ?? 'User'}</Text>
            <Text style={s.profileEmail}>{user?.email ?? ''}</Text>
            <View style={s.roleBadge}>
              <Text style={s.roleText}>{roleCap}</Text>
            </View>
          </View>
        </View>

        {/* Account section */}
        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <View style={s.section}>
          <TouchableOpacity style={s.row} onPress={handleSignOut} disabled={signingOut}>
            <View style={[s.iconBox, { backgroundColor: '#FEF2F2' }]}>
              {signingOut
                ? <ActivityIndicator size="small" color="#EF4444" />
                : <Ionicons name="log-out-outline" size={18} color="#EF4444" />}
            </View>
            <Text style={[s.rowLabel, { color: '#EF4444' }]}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={16} color={C.slate400} />
          </TouchableOpacity>
        </View>

        {/* App info */}
        <Text style={s.sectionLabel}>APP</Text>
        <View style={s.section}>
          <View style={[s.row, s.borderBottom]}>
            <View style={[s.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="information-circle-outline" size={18} color={C.blue} />
            </View>
            <Text style={s.rowLabel}>Version</Text>
            <Text style={s.rowValue}>v{VERSION}</Text>
          </View>
          <View style={s.row}>
            <View style={[s.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#16A34A" />
            </View>
            <Text style={s.rowLabel}>WhiteRock Connect</Text>
            <Text style={s.rowValue}>UK Student Placement</Text>
          </View>
        </View>

        {/* Danger zone */}
        <Text style={s.sectionLabel}>DANGER ZONE</Text>
        <View style={s.section}>
          <TouchableOpacity style={s.row} onPress={handleDeleteAccount}>
            <View style={[s.iconBox, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: '#DC2626' }]}>Delete Account</Text>
              <Text style={s.rowSub}>Permanently deletes all your data</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.slate400} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:           { flex: 1, backgroundColor: C.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  back:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: C.navy },
  content:      { padding: 16, paddingBottom: 48 },
  profileCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatar:       { width: 56, height: 56, borderRadius: 28, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 18, fontWeight: '800', color: C.white },
  profileInfo:  { flex: 1 },
  profileName:  { fontSize: 16, fontWeight: '800', color: C.navy },
  profileEmail: { fontSize: 12, color: C.slate500, marginTop: 2 },
  roleBadge:    { marginTop: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start' },
  roleText:     { fontSize: 10, fontWeight: '700', color: C.blue, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: C.slate400, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 4, paddingHorizontal: 4 },
  section:      { backgroundColor: C.white, borderRadius: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, overflow: 'hidden' },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  borderBottom: { borderBottomWidth: 1, borderColor: C.slate100 },
  iconBox:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel:     { flex: 1, fontSize: 14, fontWeight: '600', color: C.navy },
  rowValue:     { fontSize: 12, color: C.slate400 },
  rowSub:       { fontSize: 11, color: C.slate400, marginTop: 1 },
})
