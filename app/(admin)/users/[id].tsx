import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, Platform
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const ROLES = ['student', 'counselor', 'agent', 'admin']
const ROLE_COLOR: Record<string, string> = {
  student: '#1B4FD8', counselor: '#7C3AED', agent: '#059669', admin: '#DC2626',
}
const STAGE_LABEL: Record<string,string> = {
  lead:'Lead', application_submitted:'Applied', offer_received:'Offer Received',
  deposit_paid:'Deposit Paid', cas_requested:'CAS Requested', cas_issued:'CAS Issued',
  visa_submitted:'Visa Submitted', visa_decision:'Visa Decision',
}

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') alert(`${title}: ${msg}`)
  else Alert.alert(title, msg)
}

export default function AdminUserDetailScreen() {
  const C        = useColors()
  const { id }   = useLocalSearchParams<{ id: string }>()
  const router   = useRouter()
  const insets   = useSafeAreaInsets()
  const [user, setUser]           = useState<any>(null)
  const [profile, setProfile]     = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [roleModal, setRoleModal] = useState(false)
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    const load = async () => {
      const [{ data: u }, { data: p }] = await Promise.all([
        supabase.from('users').select('*').eq('id', id).single(),
        supabase.from('student_profiles').select('*').eq('user_id', id).maybeSingle(),
      ])
      setUser(u)
      setProfile(p)
      setLoading(false)
    }
    load()
  }, [id])

  const changeRole = async (newRole: string) => {
    setSaving(true)
    await supabase.from('users').update({ role: newRole }).eq('id', id)
    setUser((prev: any) => ({ ...prev, role: newRole }))
    setSaving(false)
    setRoleModal(false)
  }

  const toggleDeactivation = () => {
    const action = user?.is_deactivated ? 'Reactivate' : 'Deactivate'

    if (Platform.OS === 'web') {
      if (confirm(`${action} ${user?.name}?`)) {
        supabase.from('users').update({ is_deactivated: !user?.is_deactivated }).eq('id', id).then(() => {
          setUser((prev: any) => ({ ...prev, is_deactivated: !prev.is_deactivated }))
          showAlert('Done', `${user?.name} has been ${action.toLowerCase()}d.`)
        })
      }
      return
    }

    Alert.alert(
      `${action} User`,
      `${action} ${user?.name}'s access?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action, style: user?.is_deactivated ? 'default' : 'destructive',
          onPress: async () => {
            await supabase.from('users').update({ is_deactivated: !user?.is_deactivated }).eq('id', id)
            setUser((prev: any) => ({ ...prev, is_deactivated: !prev.is_deactivated }))
            showAlert('Done', `${user?.name} has been ${action.toLowerCase()}d.`)
          },
        },
      ]
    )
  }

  const s = mkS(C)
  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>
  if (!user)   return <View style={s.center}><Text style={s.emptyText}>User not found</Text></View>

  const initials  = user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const roleColor = ROLE_COLOR[user.role] ?? C.slate400

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>User Detail</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, alignItems: 'center' }}>
        <View style={s.profileCard}>
          <View style={[s.avatar, { backgroundColor: roleColor + '22' }]}>
            <Text style={[s.avatarText, { color: roleColor }]}>{initials}</Text>
          </View>
          <Text style={s.name}>{user.name}</Text>
          <Text style={s.email}>{user.email}</Text>
          {user.phone ? <Text style={s.meta}>{user.phone}</Text> : null}
          <View style={[s.roleBadge, { backgroundColor: roleColor + '18' }]}>
            <Text style={[s.roleText, { color: roleColor }]}>{user.role}</Text>
          </View>
          {user.is_deactivated && (
            <View style={[s.roleBadge, { backgroundColor: C.red500 + '18', marginTop: 6 }]}>
              <Text style={[s.roleText, { color: C.red500 }]}>DEACTIVATED</Text>
            </View>
          )}
          <Text style={s.meta}>Joined {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        </View>

        {profile && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Student Profile</Text>
            {([
              ['Stage',       STAGE_LABEL[profile.stage] ?? profile.stage ?? '—'],
              ['School',      profile.school ?? '—'],
              ['Nationality', profile.nationality ?? '—'],
              ['Program',     profile.program_of_interest ?? '—'],
              ['Intake',      profile.intake ?? '—'],
              ['Student #',   profile.student_number ?? '—'],
            ] as [string, string][]).map(([label, val]) => (
              <View key={label} style={s.infoRow}>
                <Text style={s.infoLabel}>{label}</Text>
                <Text style={s.infoVal}>{val}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.card}>
          <Text style={s.cardTitle}>Admin Actions</Text>
          <TouchableOpacity style={s.actionRow} onPress={() => setRoleModal(true)}>
            <Ionicons name="shield-outline" size={18} color={C.blue} />
            <Text style={s.actionText}>Change Role</Text>
            <Ionicons name="chevron-forward" size={14} color={C.slate400} />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.actionRow} onPress={toggleDeactivation}>
            <Ionicons name={user.is_deactivated ? "checkmark-circle-outline" : "ban-outline"} size={18} color={user.is_deactivated ? C.green400 : C.red500} />
            <Text style={[s.actionText, { color: user.is_deactivated ? C.green400 : C.red500 }]}>
              {user.is_deactivated ? 'Reactivate Account' : 'Deactivate Account'}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={C.slate400} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={roleModal} transparent animationType="slide" onRequestClose={() => setRoleModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Change Role</Text>
            {saving && <ActivityIndicator color={C.blue} style={{ marginBottom: 12 }} />}
            {ROLES.map(r => {
              const rc = ROLE_COLOR[r] ?? C.slate400
              return (
                <TouchableOpacity
                  key={r}
                  style={[s.roleOption, user.role === r && { backgroundColor: rc, borderColor: rc }]}
                  onPress={() => changeRole(r)}
                  disabled={saving}
                >
                  <Text style={[s.roleOptionText, user.role === r && { color: C.white }]}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                  {user.role === r && <Ionicons name="checkmark" size={16} color={C.white} />}
                </TouchableOpacity>
              )
            })}
            <TouchableOpacity style={s.cancelBtn} onPress={() => setRoleModal(false)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  emptyText:      { fontSize: 14, color: C.slate400, fontWeight: '600' },
  header:         { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:        { marginRight: 12 },
  headerTitle:    { fontSize: 18, fontWeight: '800', color: C.navy },
  profileCard:    { width: '100%', maxWidth: 500, backgroundColor: C.white, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  avatar:         { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:     { fontSize: 26, fontWeight: '900' },
  name:           { fontSize: 18, fontWeight: '800', color: C.navy },
  email:          { fontSize: 13, color: C.slate400, marginTop: 2 },
  meta:           { fontSize: 12, color: C.slate400, marginTop: 4 },
  roleBadge:      { marginTop: 10, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  roleText:       { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  card:           { width: '100%', maxWidth: 500, backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  cardTitle:      { fontSize: 11, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  infoRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: C.slate100 },
  infoLabel:      { fontSize: 12, color: C.slate400, fontWeight: '600' },
  infoVal:        { fontSize: 12, color: C.navy, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  actionRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  actionText:     { flex: 1, fontSize: 14, fontWeight: '600', color: C.navy },
  divider:        { height: 1, backgroundColor: C.slate100 },
  modalBg:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', alignItems: 'center' },
  modal:          { width: '100%', maxWidth: 400, backgroundColor: C.white, borderRadius: 24, padding: 24, margin: 12 },
  modalTitle:     { fontSize: 16, fontWeight: '800', color: C.navy, marginBottom: 16 },
  roleOption:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, backgroundColor: C.slate100, borderWidth: 1, borderColor: C.slate100, marginBottom: 8 },
  roleOptionText: { fontSize: 14, fontWeight: '600', color: C.navy, textTransform: 'capitalize' },
  cancelBtn:      { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelText:     { fontSize: 14, fontWeight: '700', color: C.slate400 },
})
