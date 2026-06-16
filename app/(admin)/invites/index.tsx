import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { C } from '@/constants/colors'

const ROLE_OPTIONS = ['student', 'counselor', 'agent'] as const
const ROLE_COLOR: Record<string, string> = {
  student: C.blue, counselor: '#7C3AED', agent: '#059669',
}

function codeStatus(code: any): { label: string; color: string } {
  if (code.used_by)                             return { label: 'Used',    color: C.slate400 }
  if (new Date(code.expires_at) < new Date())   return { label: 'Expired', color: C.red500  }
  return                                               { label: 'Active',  color: '#059669'  }
}

export default function AdminInvitesScreen() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()
  const [codes, setCodes]           = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal]   = useState(false)
  const [selectedRole, setSelectedRole] = useState<typeof ROLE_OPTIONS[number]>('student')
  const [generating, setGenerating] = useState(false)
  const [myId, setMyId]             = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setMyId(user.id)
    const { data } = await supabase
      .from('invite_codes')
      .select('*, used_user:used_by(name)')
      .order('created_at', { ascending: false })
    setCodes(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const generateCode = async () => {
    setGenerating(true)
    const code      = `WR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase.from('invite_codes').insert({
      code, role: selectedRole, created_by: myId, expires_at: expiresAt,
    })
    if (error) Alert.alert('Error', error.message)
    else { await load(); setShowModal(false) }
    setGenerating(false)
  }

  const revokeCode = (codeItem: any) => {
    Alert.alert('Revoke Code', `Expire ${codeItem.code} now?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive',
        onPress: async () => {
          await supabase.from('invite_codes')
            .update({ expires_at: new Date().toISOString() })
            .eq('id', codeItem.id)
          await load()
        },
      },
    ])
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>

  const active  = codes.filter(c => !c.used_by && new Date(c.expires_at) > new Date()).length
  const used    = codes.filter(c => c.used_by).length

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.title}>Invite Codes</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={22} color={C.white} />
        </TouchableOpacity>
      </View>

      {/* Stats strip */}
      <View style={s.statsStrip}>
        <View style={s.stripStat}>
          <Text style={[s.stripNum, { color: '#059669' }]}>{active}</Text>
          <Text style={s.stripLabel}>Active</Text>
        </View>
        <View style={s.stripDivider} />
        <View style={s.stripStat}>
          <Text style={[s.stripNum, { color: C.slate400 }]}>{used}</Text>
          <Text style={s.stripLabel}>Used</Text>
        </View>
        <View style={s.stripDivider} />
        <View style={s.stripStat}>
          <Text style={[s.stripNum, { color: C.navy }]}>{codes.length}</Text>
          <Text style={s.stripLabel}>Total</Text>
        </View>
      </View>

      <FlatList
        data={codes}
        keyExtractor={c => c.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={C.blue} />
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="ticket-outline" size={40} color={C.slate200} />
            <Text style={s.emptyText}>No invite codes yet</Text>
            <Text style={s.emptySub}>Tap + to generate your first code</Text>
          </View>
        }
        renderItem={({ item }) => {
          const st = codeStatus(item)
          const rc = ROLE_COLOR[item.role] ?? C.slate400
          const canRevoke = !item.used_by && new Date(item.expires_at) > new Date()
          return (
            <View style={s.codeCard}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <Text style={s.code}>{item.code}</Text>
                  <View style={[s.roleBadge, { backgroundColor: rc + '18' }]}>
                    <Text style={[s.roleText, { color: rc }]}>{item.role}</Text>
                  </View>
                </View>
                <Text style={s.codeMeta}>
                  Expires {new Date(item.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {item.used_user ? ` · Used by ${item.used_user.name}` : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {canRevoke && (
                  <TouchableOpacity onPress={() => revokeCode(item)} style={s.revokeBtn}>
                    <Ionicons name="close" size={14} color={C.red500} />
                  </TouchableOpacity>
                )}
                <View style={[s.statusBadge, { backgroundColor: st.color + '18' }]}>
                  <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
            </View>
          )
        }}
      />

      {/* Generate modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Generate Invite Code</Text>
            <Text style={s.modalSub}>Valid for 7 days from creation</Text>

            <Text style={s.pickerLabel}>Role this code grants</Text>
            <View style={s.roleRow}>
              {ROLE_OPTIONS.map(r => {
                const rc = ROLE_COLOR[r]
                const active = selectedRole === r
                return (
                  <TouchableOpacity
                    key={r}
                    style={[s.roleBtn, active && { backgroundColor: rc, borderColor: rc }]}
                    onPress={() => setSelectedRole(r)}
                  >
                    <Text style={[s.roleBtnText, active && { color: C.white }]}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <TouchableOpacity
              style={[s.generateBtn, generating && { opacity: 0.6 }]}
              onPress={generateCode}
              disabled={generating}
            >
              {generating
                ? <ActivityIndicator color={C.white} size="small" />
                : <Text style={s.generateBtnText}>Generate Code</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={() => setShowModal(false)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header:          { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:         { marginRight: 12 },
  title:           { flex: 1, fontSize: 18, fontWeight: '800', color: C.navy },
  addBtn:          { width: 36, height: 36, borderRadius: 10, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  statsStrip:      { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100, paddingVertical: 12 },
  stripStat:       { flex: 1, alignItems: 'center' },
  stripNum:        { fontSize: 20, fontWeight: '900' },
  stripLabel:      { fontSize: 10, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  stripDivider:    { width: 1, backgroundColor: C.slate100 },
  empty:           { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText:       { fontSize: 14, color: C.slate500, fontWeight: '700' },
  emptySub:        { fontSize: 12, color: C.slate400 },
  codeCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  code:            { fontSize: 15, fontWeight: '900', color: C.navy, letterSpacing: 1 },
  codeMeta:        { fontSize: 11, color: C.slate400 },
  roleBadge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  roleText:        { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  statusBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText:      { fontSize: 10, fontWeight: '700' },
  revokeBtn:       { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  modalBg:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal:           { backgroundColor: C.white, borderRadius: 24, padding: 24, margin: 12 },
  modalTitle:      { fontSize: 18, fontWeight: '800', color: C.navy },
  modalSub:        { fontSize: 12, color: C.slate400, marginTop: 2, marginBottom: 20 },
  pickerLabel:     { fontSize: 11, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  roleRow:         { flexDirection: 'row', gap: 8, marginBottom: 20 },
  roleBtn:         { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.slate200, alignItems: 'center' },
  roleBtnText:     { fontSize: 13, fontWeight: '700', color: C.slate500 },
  generateBtn:     { height: 48, backgroundColor: C.blue, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  generateBtnText: { fontSize: 14, fontWeight: '700', color: C.white },
  cancelBtn:       { padding: 12, alignItems: 'center' },
  cancelText:      { fontSize: 14, fontWeight: '600', color: C.slate400 },
})
