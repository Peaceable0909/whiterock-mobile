import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, TextInput,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'
import { EmptyState } from '@/components/Skeleton'

type StaffUser = { id: string; name: string; role: string; avatar_url: string | null }
type Conversation = {
  id: string
  student_id: string
  counselor_id: string | null
  student: { name: string; email: string; avatar_url: string | null }
}

export default function AssignCounselorScreen() {
  const C      = useColors()
  const s      = mkS(C)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [convs, setConvs]         = useState<Conversation[]>([])
  const [staff, setStaff]         = useState<StaffUser[]>([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [{ data: convData }, { data: staffData }] = await Promise.all([
      supabase
        .from('conversations')
        .select('id, student_id, counselor_id, student:student_id(name, email, avatar_url)')
        .order('created_at', { ascending: false }),
      supabase
        .from('users')
        .select('id, name, role, avatar_url')
        .in('role', ['counselor', 'admin']),
    ])
    setConvs((convData ?? []) as Conversation[])
    setStaff(staffData ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const assign = (convId: string, studentName: string) => {
    const counselors = staff.filter(u => u.role === 'counselor' || u.role === 'admin')
    if (!counselors.length) {
      Alert.alert('No counselors', 'No counselor accounts found.')
      return
    }
    Alert.alert(
      `Assign Counselor`,
      `Choose a counselor for ${studentName}:`,
      [
        ...counselors.map(c => ({
          text: c.name,
          onPress: async () => {
            setAssigning(convId)
            const { error } = await supabase
              .from('conversations')
              .update({ counselor_id: c.id })
              .eq('id', convId)
            setAssigning(null)
            if (error) {
              Alert.alert('Error', error.message)
            } else {
              setConvs(prev => prev.map(cv =>
                cv.id === convId ? { ...cv, counselor_id: c.id } : cv
              ))
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    )
  }

  const filtered = convs.filter(c => {
    const q = search.toLowerCase()
    return !q || c.student?.name?.toLowerCase().includes(q) || c.student?.email?.toLowerCase().includes(q)
  })

  const counselorName = (id: string | null) => staff.find(u => u.id === id)?.name ?? null

  const renderItem = ({ item }: { item: Conversation }) => {
    const cn = counselorName(item.counselor_id)
    const isAssigning = assigning === item.id
    const initial = (item.student?.name ?? 'S')[0].toUpperCase()
    return (
      <View style={s.card}>
        <View style={s.avatarCircle}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.studentName} numberOfLines={1}>{item.student?.name ?? 'Unknown'}</Text>
          <Text style={s.studentEmail} numberOfLines={1}>{item.student?.email ?? ''}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Ionicons
              name={cn ? 'person-circle-outline' : 'person-add-outline'}
              size={13}
              color={cn ? '#059669' : C.slate400}
            />
            <Text style={[s.counselorLabel, { color: cn ? '#059669' : C.slate400 }]}>
              {cn ?? 'No counselor assigned'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[s.assignBtn, cn && s.assignBtnSecondary]}
          onPress={() => assign(item.id, item.student?.name ?? 'student')}
          disabled={isAssigning}
        >
          {isAssigning
            ? <ActivityIndicator size="small" color={cn ? C.navy : '#fff'} />
            : <Text style={[s.assignBtnText, cn && { color: C.navy }]}>{cn ? 'Change' : 'Assign'}</Text>}
        </TouchableOpacity>
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
        <Text style={s.title}>Assign Counselor</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={C.slate400} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search students…"
          placeholderTextColor={C.slate400}
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={C.blue} />}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No students found"
              subtitle={search ? 'Try a different search term.' : 'No conversations exist yet.'}
            />
          }
        />
      )}
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:              { flex: 1, backgroundColor: C.bg },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  back:            { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  title:           { fontSize: 17, fontWeight: '800', color: C.navy },

  searchWrap:      { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.slate200 },
  searchInput:     { flex: 1, fontSize: 14, color: C.navy, padding: 0 },

  card:            { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  avatarCircle:    { width: 44, height: 44, borderRadius: 22, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:      { fontSize: 17, fontWeight: '800', color: '#fff' },
  studentName:     { fontSize: 14, fontWeight: '700', color: C.navy },
  studentEmail:    { fontSize: 11, color: C.slate400 },
  counselorLabel:  { fontSize: 11, fontWeight: '600' },

  assignBtn:       { backgroundColor: C.blue, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  assignBtnSecondary: { backgroundColor: C.slate100 },
  assignBtnText:   { fontSize: 12, fontWeight: '800', color: '#fff' },
})
