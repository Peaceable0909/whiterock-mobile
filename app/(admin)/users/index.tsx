import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

const ROLE_FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'student',   label: 'Students' },
  { key: 'counselor', label: 'Counselors' },
  { key: 'agent',     label: 'Agents' },
  { key: 'admin',     label: 'Admins' },
]

const ROLE_COLOR: Record<string, string> = {
  student: C.blue, counselor: '#7C3AED', agent: '#059669', admin: '#DC2626',
}

export default function AdminUsersScreen() {
  const router = useRouter()
  const [users, setUsers]         = useState<any[]>([])
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all')
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, role, is_online, created_at')
      .order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchFilter = filter === 'all' || u.role === filter
    return matchSearch && matchFilter
  })

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>

  return (
    <View style={s.bg}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.title}>Users</Text>
        <Text style={s.headerCount}>{filtered.length} shown</Text>
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={C.slate400} />
        <TextInput
          style={s.searchInput} value={search} onChangeText={setSearch}
          placeholder="Search name or email" placeholderTextColor={C.slate400}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.slate400} />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.chipsRow}>
        {ROLE_FILTERS.map(f => (
          <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)}
            style={[s.chip, filter === f.key && s.chipActive]}>
            <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={u => u.id}
        contentContainerStyle={{ padding: 14, paddingTop: 4, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={C.blue} />
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="people-outline" size={40} color={C.slate200} />
            <Text style={s.emptyText}>No users found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const initials = item.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
          const roleColor = ROLE_COLOR[item.role] ?? C.slate400
          return (
            <TouchableOpacity style={s.userCard} onPress={() => router.push(`/(admin)/users/${item.id}` as any)}>
              <View style={[s.avatar, { backgroundColor: roleColor + '22' }]}>
                <Text style={[s.avatarText, { color: roleColor }]}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.userName}>{item.name}</Text>
                  {item.is_online && <View style={s.onlineDot} />}
                </View>
                <Text style={s.userEmail} numberOfLines={1}>{item.email}</Text>
              </View>
              <View style={[s.roleBadge, { backgroundColor: roleColor + '18' }]}>
                <Text style={[s.roleText, { color: roleColor }]}>{item.role}</Text>
              </View>
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  bg:          { flex: 1, backgroundColor: C.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:     { marginRight: 12 },
  title:       { flex: 1, fontSize: 18, fontWeight: '800', color: C.navy },
  headerCount: { fontSize: 12, color: C.slate400 },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', margin: 12, backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.slate200 },
  searchInput: { flex: 1, fontSize: 14, color: C.navy, marginLeft: 8 },
  chipsRow:    { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  chip:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.slate200 },
  chipActive:  { backgroundColor: C.blue, borderColor: C.blue },
  chipText:    { fontSize: 12, fontWeight: '600', color: C.slate500 },
  chipTextActive: { color: C.white },
  userCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 14, padding: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  avatar:      { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 15, fontWeight: '800' },
  userName:    { fontSize: 14, fontWeight: '700', color: C.navy },
  userEmail:   { fontSize: 11, color: C.slate400, marginTop: 1 },
  roleBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  roleText:    { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  onlineDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  empty:       { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText:   { fontSize: 14, color: C.slate400, fontWeight: '600' },
})
