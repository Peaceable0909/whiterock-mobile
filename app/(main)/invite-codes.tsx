import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Clipboard, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'
import { EmptyState } from '@/components/Skeleton'

type InviteCode = {
  id: string
  code: string
  role: string
  email: string | null
  used_by: string | null
  used_at: string | null
  expires_at: string | null
  created_at: string
}

const ROLE_OPTIONS: { key: string; label: string; color: string; bg: string }[] = [
  { key: 'student',   label: 'Student',   color: '#1D4ED8', bg: '#EFF6FF' },
  { key: 'agent',     label: 'Agent',     color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'counselor', label: 'Counselor', color: '#059669', bg: '#F0FDF4' },
]

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function InviteCodesScreen() {
  const C      = useColors()
  const s      = mkS(C)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [codes, setCodes]         = useState<InviteCode[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [creating, setCreating]   = useState(false)
  const [selectedRole, setSelectedRole] = useState('student')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false })
    setCodes(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createCode = async () => {
    setCreating(true)
    const code = genCode()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('invite_codes').insert({
      code,
      role: selectedRole,
      created_by: user?.id,
    })
    setCreating(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Clipboard.setString(code)
      Alert.alert('Code Created', `${code}\n\nCopied to clipboard.`)
      load()
    }
  }

  const copyCode = (code: string) => {
    Clipboard.setString(code)
    Alert.alert('Copied', `${code} copied to clipboard.`)
  }

  const deleteCode = (id: string, code: string) => {
    Alert.alert('Delete Code', `Delete invite code "${code}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('invite_codes').delete().eq('id', id)
          setCodes(prev => prev.filter(c => c.id !== id))
        },
      },
    ])
  }

  const isExpired = (code: InviteCode) =>
    !!code.expires_at && new Date(code.expires_at) < new Date()

  const statusOf = (code: InviteCode) => {
    if (code.used_by)   return { label: 'Used',    color: '#94A3B8', bg: '#F1F5F9' }
    if (isExpired(code)) return { label: 'Expired', color: '#EF4444', bg: '#FEF2F2' }
    return { label: 'Active', color: '#059669', bg: '#F0FDF4' }
  }

  const roleColor = (role: string) => ROLE_OPTIONS.find(r => r.key === role) ?? ROLE_OPTIONS[0]

  const renderItem = ({ item }: { item: InviteCode }) => {
    const st = statusOf(item)
    const rc = roleColor(item.role)
    const usable = !item.used_by && !isExpired(item)
    return (
      <View style={s.codeCard}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.codeText}>{item.code}</Text>
            <View style={[s.badge, { backgroundColor: st.bg }]}>
              <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: rc.bg }]}>
              <Text style={[s.badgeText, { color: rc.color }]}>{rc.label}</Text>
            </View>
          </View>
          {item.email ? <Text style={s.codeMeta}>For: {item.email}</Text> : null}
          {item.used_at
            ? <Text style={s.codeMeta}>Used {new Date(item.used_at).toLocaleDateString()}</Text>
            : <Text style={s.codeMeta}>Created {new Date(item.created_at).toLocaleDateString()}</Text>}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {usable && (
            <TouchableOpacity style={s.iconBtn} onPress={() => copyCode(item.code)}>
              <Ionicons name="copy-outline" size={17} color={C.blue} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: '#FEF2F2' }]} onPress={() => deleteCode(item.id, item.code)}>
            <Ionicons name="trash-outline" size={17} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={[s.bg, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.title}>Invite Codes</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Create panel */}
      <View style={s.createPanel}>
        <Text style={s.createLabel}>ROLE</Text>
        <View style={s.roleRow}>
          {ROLE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[s.roleChip, selectedRole === opt.key && { backgroundColor: opt.color, borderColor: opt.color }]}
              onPress={() => setSelectedRole(opt.key)}
            >
              <Text style={[s.roleChipText, selectedRole === opt.key && { color: '#fff' }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.createBtn} onPress={createCode} disabled={creating}>
          {creating
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Ionicons name="add" size={18} color="#fff" /><Text style={s.createBtnText}>Generate Code</Text></>}
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>
      ) : (
        <FlatList
          data={codes}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={C.blue} />}
          ListEmptyComponent={
            <EmptyState
              icon="ticket-outline"
              title="No invite codes"
              subtitle="Generate a code above to invite a new user."
            />
          }
        />
      )}
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:           { flex: 1, backgroundColor: C.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  back:         { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 17, fontWeight: '800', color: C.navy },

  createPanel:  { backgroundColor: C.white, padding: 16, borderBottomWidth: 1, borderColor: C.slate100, gap: 10 },
  createLabel:  { fontSize: 10, fontWeight: '800', color: C.slate400, letterSpacing: 1.2, textTransform: 'uppercase' },
  roleRow:      { flexDirection: 'row', gap: 8 },
  roleChip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: C.slate200, backgroundColor: C.bg },
  roleChipText: { fontSize: 13, fontWeight: '700', color: C.slate600 },
  createBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.blue, borderRadius: 14, paddingVertical: 12 },
  createBtnText:{ fontSize: 14, fontWeight: '800', color: '#fff' },

  codeCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  codeText:     { fontSize: 16, fontWeight: '800', color: C.navy, letterSpacing: 1.5, fontVariant: ['tabular-nums'] },
  codeMeta:     { fontSize: 11, color: C.slate400 },
  badge:        { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText:    { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  iconBtn:      { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
})
