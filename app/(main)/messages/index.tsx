import { useEffect, useState } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

export default function MessagesScreen() {
  const router = useRouter()
  const [search, setSearch]   = useState('')
  const [convs, setConvs]     = useState<any[]>([])
  const [role, setRole]       = useState<string>('student')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single()
      const r = dbUser?.role ?? 'student'
      setRole(r)

      const { data } = r === 'student'
        ? await supabase.from('conversations')
            .select('*, agent:agent_id(id,name,avatar_url,is_online), counselor:counselor_id(id,name,avatar_url,is_online)')
            .eq('student_id', user.id)
        : await supabase.from('conversations')
            .select('*, student:student_id(id,name,avatar_url,is_online)')
            .or(`agent_id.eq.${user.id},counselor_id.eq.${user.id}`)
            .order('last_message_at', { ascending: false, nullsFirst: false })
      setConvs(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = convs.filter(c => {
    const other = role === 'student' ? (c.agent || c.counselor) : c.student
    if (!other) return false
    return !search || other.name.toLowerCase().includes(search.toLowerCase())
  })

  const getInitials = (name: string) => name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const getUnread   = (c: any) => role === 'student' ? (c.unread_student ?? 0) : (c.unread_staff ?? 0)

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>

  return (
    <View style={s.bg}>
      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={C.slate400} />
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search messages" placeholderTextColor={C.slate400} />
      </View>

      {/* AI pinned (students) */}
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
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>No conversations yet</Text>
            <Text style={s.emptySub}>Messages from your agent will appear here</Text>
          </View>
        }
        renderItem={({ item }) => {
          const other = role === 'student' ? (item.agent || item.counselor) : item.student
          if (!other) return null
          const unread = getUnread(item)
          return (
            <TouchableOpacity style={s.convRow} onPress={() => router.push(`/(main)/messages/${item.id}`)}>
              <View style={s.avatarWrap}>
                <View style={s.avatar}><Text style={s.avatarText}>{getInitials(other.name)}</Text></View>
                {other.is_online && <View style={s.onlineDotSmall} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.row}>
                  <Text style={s.name}>{other.name}</Text>
                  <Text style={s.time}>{item.last_message_at ? new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                </View>
                <View style={s.row}>
                  <Text style={s.lastMsg} numberOfLines={1}>{item.last_message ?? 'Start a conversation'}</Text>
                  {unread > 0 && <View style={s.badge}><Text style={s.badgeText}>{unread}</Text></View>}
                </View>
              </View>
            </TouchableOpacity>
          )
        }}
      />

      <TouchableOpacity style={s.fab}>
        <Ionicons name="create-outline" size={20} color={C.white} />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  bg:           { flex: 1, backgroundColor: C.white },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', margin: 12, backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.slate100 },
  searchInput:  { flex: 1, fontSize: 14, color: C.navy, marginLeft: 8 },
  aiRow:        { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: C.slate100 },
  aiAvatar:     { width: 48, height: 48, borderRadius: 24, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  aiName:       { fontSize: 14, fontWeight: '700', color: C.navy },
  aiSub:        { fontSize: 12, color: C.slate400, marginTop: 2 },
  row:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  proBadge:     { backgroundColor: '#22C55E', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  proText:      { fontSize: 9, fontWeight: '700', color: C.white },
  onlineDot:    { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: C.green400, borderWidth: 2, borderColor: C.white },
  onlineDotSmall:{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: C.green400, borderWidth: 2, borderColor: C.white },
  sep:          { height: 1, backgroundColor: C.slate100 },
  convRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  avatarWrap:   { position: 'relative', marginRight: 12 },
  avatar:       { width: 48, height: 48, borderRadius: 24, backgroundColor: C.slate200, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 16, fontWeight: '700', color: C.slate600 },
  name:         { fontSize: 14, fontWeight: '700', color: C.navy },
  time:         { fontSize: 11, color: C.slate400 },
  lastMsg:      { fontSize: 12, color: C.slate400, flex: 1, marginTop: 2 },
  badge:        { backgroundColor: C.blue, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText:    { fontSize: 10, fontWeight: '700', color: C.white },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText:    { fontSize: 15, fontWeight: '600', color: C.slate500 },
  emptySub:     { fontSize: 12, color: C.slate400, marginTop: 4 },
  fab:          { position: 'absolute', bottom: 20, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', elevation: 6 },
})
