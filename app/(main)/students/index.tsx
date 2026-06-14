import { useEffect, useState, useCallback } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

const STAGES = ['lead','application_submitted','offer_received','deposit_paid','cas_requested','cas_issued','visa_submitted','visa_decision']
const STAGE_LABEL: Record<string,string> = { lead:'Lead', application_submitted:'Applied', offer_received:'Offer', deposit_paid:'Deposit', cas_requested:'CAS', cas_issued:'CAS Issued', visa_submitted:'Visa', visa_decision:'Decision' }
const FILTERS = [{ key:'all', label:'All' },{ key:'application_submitted', label:'Applied' },{ key:'offer_received', label:'Offer' },{ key:'cas_requested', label:'CAS' },{ key:'visa_submitted', label:'Visa' }]

export default function StudentsScreen() {
  const router = useRouter()
  const [students, setStudents]   = useState<any[]>([])
  const [convMap, setConvMap]     = useState<Record<string, string>>({})
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all')
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [role, setRole]           = useState('agent')
  const [myId, setMyId]           = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)
    const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single()
    const r = dbUser?.role ?? 'agent'
    setRole(r)

    if (r === 'student') { setLoading(false); setRefreshing(false); return }

    const { data: convData } = await supabase
      .from('conversations')
      .select('id, student:student_id(*, profile:student_profiles(*))')
      .or(`agent_id.eq.${user.id},counselor_id.eq.${user.id}`)
    const studs = (convData ?? []).map((c: any) => c.student).filter(Boolean)
    const map: Record<string, string> = {}
    ;(convData ?? []).forEach((c: any) => { if (c.student?.id) map[c.student.id] = c.id })
    setStudents(studs)
    setConvMap(map)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Realtime: refresh when conversations or profiles change
  useEffect(() => {
    const sub = supabase.channel('students-screen-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_profiles' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [load])

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.profile?.school?.toLowerCase().includes(q)
    const matchFilter = filter === 'all' || s.profile?.stage === filter
    return matchSearch && matchFilter
  })

  const casAlerts  = students.filter(s => s.profile?.stage === 'cas_requested').length
  const visaAlerts = students.filter(s => s.profile?.stage === 'visa_submitted').length

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>
  if (role === 'student') return (
    <View style={s.center}><Text style={s.emptyText}>Students section is for staff only</Text></View>
  )

  return (
    <View style={s.bg}>
      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={C.slate400} />
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search students, universities..." placeholderTextColor={C.slate400} />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.slate400} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <View style={s.filtersWrap}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} style={[s.chip, filter === f.key && s.chipActive]}>
            <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* AI alert */}
      {(casAlerts > 0 || visaAlerts > 0) && (
        <View style={s.alertBanner}>
          <Ionicons name="warning-outline" size={16} color="#FCD34D" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.alertTitle}>{casAlerts > 0 ? `CAS Alert: ${casAlerts} Pending` : `Visa Alert: ${visaAlerts} Pending`}</Text>
            <Text style={s.alertSub}>AI suggests immediate follow-up.</Text>
          </View>
        </View>
      )}

      <View style={s.listHeader}>
        <Text style={s.listTitle}>My Students <Text style={s.listCount}>({filtered.length})</Text></Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={st => st.id}
        contentContainerStyle={{ padding: 14, paddingTop: 0, paddingBottom: 80 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={C.blue} />}
        ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>No students found</Text></View>}
        renderItem={({ item }) => {
          const stage    = item.profile?.stage ?? 'lead'
          const idx      = STAGES.indexOf(stage)
          const pct      = Math.round((idx / (STAGES.length - 1)) * 100)
          const initials = item.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()
          const cid      = convMap[item.id]
          return (
            <TouchableOpacity style={s.studentCard} onPress={() => router.push(`/(main)/students/${item.id}`)}>
              <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={s.row}>
                  <Text style={s.studentName}>{item.name}</Text>
                  <View style={s.stageBadge}><Text style={s.stageBadgeText}>{STAGE_LABEL[stage]}</Text></View>
                </View>
                {item.profile?.school && <Text style={s.school} numberOfLines={1}>{item.profile.school}</Text>}
                <View style={s.progressRow}>
                  <View style={s.barBg}><View style={[s.barFg, { width: `${Math.max(pct, 4)}%` as any }]} /></View>
                  <Text style={s.pctText}>{pct}%</Text>
                </View>
              </View>
              {cid && (
                <TouchableOpacity
                  style={s.msgBtn}
                  onPress={() => router.push(`/(main)/messages/${cid}`)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chatbubble-outline" size={16} color={C.blue} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )
        }}
      />

      {role === 'admin' && (
        <TouchableOpacity style={s.fab} onPress={() => router.push('/(admin)/invites' as any)}>
          <Ionicons name="person-add-outline" size={20} color={C.white} />
        </TouchableOpacity>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  bg:           { flex: 1, backgroundColor: C.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText:    { fontSize: 14, color: C.slate400, fontWeight: '600' },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', margin: 12, backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.slate100 },
  searchInput:  { flex: 1, fontSize: 14, color: C.navy, marginLeft: 8 },
  filtersWrap:  { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 10 },
  chip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.slate200 },
  chipActive:   { backgroundColor: C.blue, borderColor: C.blue },
  chipText:     { fontSize: 12, fontWeight: '600', color: C.slate500 },
  chipTextActive:{ color: C.white },
  alertBanner:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.blue, marginHorizontal: 12, borderRadius: 16, padding: 14, marginBottom: 10 },
  alertTitle:   { fontSize: 14, fontWeight: '700', color: C.white },
  alertSub:     { fontSize: 12, color: '#BFDBFE', marginTop: 2 },
  listHeader:   { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  listTitle:    { fontSize: 15, fontWeight: '800', color: C.navy },
  listCount:    { fontWeight: '400', color: C.slate400 },
  studentCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  avatar:       { width: 52, height: 52, borderRadius: 14, backgroundColor: C.slate200, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText:   { fontSize: 18, fontWeight: '700', color: C.slate600 },
  row:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  studentName:  { fontSize: 14, fontWeight: '700', color: C.navy, flex: 1 },
  school:       { fontSize: 12, color: C.slate500, marginBottom: 6 },
  stageBadge:   { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 6 },
  stageBadgeText:{ fontSize: 10, fontWeight: '700', color: C.blue },
  progressRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barBg:        { flex: 1, height: 5, backgroundColor: C.slate100, borderRadius: 3, overflow: 'hidden' },
  barFg:        { height: 5, backgroundColor: C.blue, borderRadius: 3 },
  pctText:      { fontSize: 10, fontWeight: '700', color: C.slate500, width: 28 },
  fab:          { position: 'absolute', bottom: 20, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  msgBtn:       { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
})
