import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, RefreshControl,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const formatConvTime = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const msgDay    = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (msgDay.getTime() === today.getTime()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday'
  const daysDiff = Math.floor((today.getTime() - msgDay.getTime()) / 86400000)
  if (daysDiff < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function MessagesScreen() {
  const C = useColors()
  const s = mkS(C)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [search, setSearch]       = useState('')
  const [convs, setConvs]         = useState<any[]>([])
  const [role, setRole]           = useState<string>('student')
  const [myId, setMyId]           = useState('')
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // New conversation modal (staff only — pick a student)
  const [newConvModal, setNewConvModal]   = useState(false)
  const [students, setStudents]           = useState<any[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [creating, setCreating]           = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)
    const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single()
    const r = dbUser?.role ?? 'student'
    setRole(r)

    const { data } = r === 'student'
      ? await supabase.from('conversations')
          .select('*, agent:agent_id(id,name,avatar_url,is_online), counselor:counselor_id(id,name,avatar_url,is_online)')
          .eq('student_id', user.id)
          .order('last_message_at', { ascending: false, nullsFirst: false })
      : await supabase.from('conversations')
          .select('*, student:student_id(id,name,avatar_url,is_online)')
          .or(`agent_id.eq.${user.id},counselor_id.eq.${user.id}`)
          .order('last_message_at', { ascending: false, nullsFirst: false })
    setConvs(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Realtime: re-fetch when conversations change
  useEffect(() => {
    const sub = supabase.channel('conv-list-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        load()
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [load])

  // Refresh list whenever this screen comes into focus (e.g. returning from a chat)
  useFocusEffect(useCallback(() => { load() }, [load]))

  // Load students for staff new-conversation modal
  const openNewConvModal = async () => {
    setNewConvModal(true)
    if (students.length === 0) {
      const { data: convData } = await supabase
        .from('conversations')
        .select('student:student_id(id, name, email)')
        .or(`agent_id.eq.${myId},counselor_id.eq.${myId}`)
      setStudents((convData ?? []).map((c: any) => c.student).filter(Boolean))
    }
  }

  const startOrOpenConv = async (studentId: string) => {
    setCreating(true)
    // Check if conversation already exists with this student + me
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('student_id', studentId)
      .or(`counselor_id.eq.${myId},agent_id.eq.${myId}`)
      .maybeSingle()

    if (existing) {
      setNewConvModal(false)
      setCreating(false)
      router.push(`/(main)/messages/${existing.id}`)
      return
    }
    // Create new
    const { data: newConv } = await supabase.from('conversations')
      .insert({ student_id: studentId, counselor_id: myId })
      .select('id').single()
    setNewConvModal(false)
    setCreating(false)
    if (newConv) router.push(`/(main)/messages/${newConv.id}`)
  }

  const filtered = convs.filter(c => {
    const other = role === 'student' ? (c.agent || c.counselor) : c.student
    if (!other) return false
    return !search || other.name.toLowerCase().includes(search.toLowerCase())
  })

  const getInitials = (name: string) => (name ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const getUnread   = (c: any) => role === 'student' ? (c.unread_student ?? 0) : (c.unread_staff ?? 0)

  const filteredStudents = students.filter(s => !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase()))

  if (loading) return <View style={[s.center, { paddingTop: insets.top }]}><ActivityIndicator color={C.blue} /></View>

  return (
    <View style={[s.bg, { paddingTop: insets.top }]}>
      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={C.slate400} />
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search messages" placeholderTextColor={C.slate400} />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.slate400} />
          </TouchableOpacity>
        )}
      </View>

      {/* AI pinned row (students only) */}
      {role === 'student' && (
        <TouchableOpacity style={s.aiRow} onPress={() => router.push('/(main)/ai')}>
          <View style={s.aiAvatar}>
            <Ionicons name="hardware-chip-outline" size={22} color={C.white} />
            <View style={s.onlineDot} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.row}>
              <Text style={s.aiName}>AI Assistant</Text>
              <View style={s.proBadge}><Text style={s.proText}>PRO</Text></View>
            </View>
            <Text style={s.aiSub}>Analyzing your visa documents...</Text>
          </View>
          <Text style={s.time}>Online</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={C.blue} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="chatbubbles-outline" size={44} color={C.slate200} />
            <Text style={s.emptyText}>No conversations yet</Text>
            <Text style={s.emptySub}>{role === 'student' ? 'Messages from your agent will appear here' : 'Tap + to start a conversation'}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const other = role === 'student' ? (item.agent || item.counselor) : item.student
          if (!other) return null
          const unread = getUnread(item)
          const timeStr = item.last_message_at ? formatConvTime(item.last_message_at) : ''
          return (
            <TouchableOpacity style={s.convRow} onPress={() => router.push(`/(main)/messages/${item.id}`)}>
              <View style={s.avatarWrap}>
                <View style={[s.avatar, unread > 0 && s.avatarActive]}>
                  <Text style={[s.avatarText, unread > 0 && { color: C.white }]}>{getInitials(other.name)}</Text>
                </View>
                {other.is_online && <View style={s.onlineDotSmall} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.row}>
                  <Text style={[s.name, unread > 0 && { fontWeight: '800' }]}>{other.name}</Text>
                  <Text style={s.time}>{timeStr}</Text>
                </View>
                <View style={s.row}>
                  <Text style={[s.lastMsg, unread > 0 && { color: C.navy, fontWeight: '600' }]} numberOfLines={1}>
                    {item.last_message ?? 'Start a conversation'}
                  </Text>
                  {unread > 0 && (
                    <View style={s.badge}><Text style={s.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )
        }}
      />

      {/* FAB — staff: new conversation; student: go to AI */}
      <TouchableOpacity
        style={s.fab}
        onPress={role === 'student' ? () => router.push('/(main)/ai') : openNewConvModal}
        accessibilityLabel={role === 'student' ? 'Open AI' : 'New conversation'}
      >
        <Ionicons name={role === 'student' ? 'hardware-chip-outline' : 'create-outline'} size={22} color={C.white} />
      </TouchableOpacity>

      {/* New conversation modal (staff) */}
      <Modal visible={newConvModal} transparent animationType="slide" onRequestClose={() => setNewConvModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Conversation</Text>
              <TouchableOpacity onPress={() => setNewConvModal(false)}>
                <Ionicons name="close" size={20} color={C.slate400} />
              </TouchableOpacity>
            </View>
            <View style={s.modalSearch}>
              <Ionicons name="search-outline" size={14} color={C.slate400} />
              <TextInput
                style={s.modalSearchInput}
                value={studentSearch}
                onChangeText={setStudentSearch}
                placeholder="Search students..."
                placeholderTextColor={C.slate400}
                autoFocus
              />
            </View>
            {creating && <ActivityIndicator color={C.blue} style={{ padding: 12 }} />}
            <FlatList
              data={filteredStudents}
              keyExtractor={s => s.id}
              style={{ maxHeight: 320 }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.slate100 }} />}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', padding: 24 }}>
                  <Text style={{ color: C.slate400, fontSize: 13 }}>No assigned students found</Text>
                </View>
              }
              renderItem={({ item }) => {
                const initials = item.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <TouchableOpacity
                    style={s.studentRow}
                    onPress={() => startOrOpenConv(item.id)}
                    disabled={creating}
                  >
                    <View style={s.studentAvatar}><Text style={s.studentAvatarText}>{initials}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.studentName}>{item.name}</Text>
                      <Text style={s.studentEmail} numberOfLines={1}>{item.email}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={C.slate400} />
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:             { flex: 1, backgroundColor: C.bg },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchWrap:     { flexDirection: 'row', alignItems: 'center', margin: 12, backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.slate100 },
  searchInput:    { flex: 1, fontSize: 14, color: C.navy, marginLeft: 8 },
  aiRow:          { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: C.slate100 },
  aiAvatar:       { width: 48, height: 48, borderRadius: 24, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  aiName:         { fontSize: 14, fontWeight: '700', color: C.navy },
  aiSub:          { fontSize: 12, color: C.slate400, marginTop: 2 },
  row:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  proBadge:       { backgroundColor: '#22C55E', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  proText:        { fontSize: 9, fontWeight: '700', color: C.white },
  onlineDot:      { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: C.green400, borderWidth: 2, borderColor: C.white },
  onlineDotSmall: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: C.green400, borderWidth: 2, borderColor: C.white },
  sep:            { height: 1, backgroundColor: C.slate100 },
  convRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  avatarWrap:     { position: 'relative', marginRight: 12 },
  avatar:         { width: 48, height: 48, borderRadius: 24, backgroundColor: C.slate200, alignItems: 'center', justifyContent: 'center' },
  avatarActive:   { backgroundColor: C.blue },
  avatarText:     { fontSize: 16, fontWeight: '700', color: C.slate600 },
  name:           { fontSize: 14, fontWeight: '700', color: C.navy },
  time:           { fontSize: 11, color: C.slate400 },
  lastMsg:        { fontSize: 12, color: C.slate400, flex: 1, marginTop: 2 },
  badge:          { backgroundColor: C.blue, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText:      { fontSize: 10, fontWeight: '700', color: C.white },
  empty:          { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText:      { fontSize: 15, fontWeight: '600', color: C.slate500 },
  emptySub:       { fontSize: 12, color: C.slate400, marginTop: 4 },
  fab:            { position: 'absolute', bottom: 20, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: C.blue, shadowOpacity: 0.35, shadowRadius: 8 },
  modalBg:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal:          { backgroundColor: C.white, borderRadius: 24, padding: 20, margin: 12, maxHeight: '65%' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle:     { fontSize: 16, fontWeight: '800', color: C.navy },
  modalSearch:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, gap: 8 },
  modalSearchInput: { flex: 1, fontSize: 14, color: C.navy },
  studentRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, gap: 12 },
  studentAvatar:  { width: 40, height: 40, borderRadius: 12, backgroundColor: C.blue + '20', alignItems: 'center', justifyContent: 'center' },
  studentAvatarText: { fontSize: 14, fontWeight: '700', color: C.blue },
  studentName:    { fontSize: 14, fontWeight: '700', color: C.navy },
  studentEmail:   { fontSize: 11, color: C.slate400, marginTop: 1 },
})
