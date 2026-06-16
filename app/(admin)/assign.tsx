import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { C } from '@/constants/colors'

export default function AdminAssignScreen() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()
  const [students, setStudents]       = useState<any[]>([])
  const [counselors, setCounselors]   = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [assigning, setAssigning]     = useState(false)

  const load = useCallback(async () => {
    const [{ data: studs }, { data: couns }] = await Promise.all([
      supabase.from('users')
        .select('id, name, email')
        .eq('role', 'student')
        .order('created_at', { ascending: false }),
      supabase.from('users')
        .select('id, name, role')
        .in('role', ['counselor', 'agent'])
        .order('name'),
    ])

    // Get profiles separately to avoid array vs object ambiguity
    const studentIds = (studs ?? []).map((s: any) => s.id)
    const { data: profiles } = studentIds.length
      ? await supabase.from('student_profiles').select('user_id, stage, school, counselor_id, agent_id').in('user_id', studentIds)
      : { data: [] }
    const profileMap: Record<string, any> = {}
    ;(profiles ?? []).forEach((p: any) => { profileMap[p.user_id] = p })

    setStudents((studs ?? []).map((s: any) => ({ ...s, profile: profileMap[s.id] ?? null })))
    setCounselors(couns ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const assign = async (student: any, counselor: any) => {
    setAssigning(true)
    try {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('student_id', student.id)
        .maybeSingle()

      const field = counselor.role === 'counselor' ? 'counselor_id' : 'agent_id'

      if (existing) {
        await supabase.from('conversations').update({ [field]: counselor.id }).eq('id', existing.id)
      } else {
        await supabase.from('conversations').insert({ student_id: student.id, [field]: counselor.id })
      }

      await supabase.from('student_profiles')
        .update({ [field]: counselor.id })
        .eq('user_id', student.id)

      await supabase.from('notifications').insert({
        user_id: student.id, type: 'info', is_read: false,
        title: 'Counselor Assigned',
        body: `${counselor.name} has been assigned to your application.`,
      })

      Alert.alert('Assigned ✓', `${counselor.name} is now assigned to ${student.name}.`)
      setSelectedStudent(null)
      await load()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
    setAssigning(false)
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>

  // Counselor picker view
  if (selectedStudent) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => setSelectedStudent(null)} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.navy} />
          </TouchableOpacity>
          <Text style={s.title}>Choose Counselor</Text>
        </View>
        <View style={s.banner}>
          <Ionicons name="person-outline" size={14} color={C.blue} />
          <Text style={s.bannerText}>Assigning: <Text style={{ fontWeight: '800' }}>{selectedStudent.name}</Text></Text>
        </View>
        {assigning && <ActivityIndicator color={C.blue} style={{ padding: 20 }} />}
        <FlatList
          data={counselors}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>No counselors or agents found</Text>
            </View>
          }
          renderItem={({ item }) => {
            const initials = item.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
            const color    = item.role === 'counselor' ? '#7C3AED' : '#059669'
            return (
              <TouchableOpacity
                style={[s.userCard, assigning && { opacity: 0.5 }]}
                onPress={() => assign(selectedStudent, item)}
                disabled={assigning}
              >
                <View style={[s.avatar, { backgroundColor: color + '22' }]}>
                  <Text style={[s.avatarText, { color }]}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{item.name}</Text>
                  <Text style={[s.userSub, { color }]}>{item.role}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.slate400} />
              </TouchableOpacity>
            )
          }}
        />
      </View>
    )
  }

  // Student list view
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.title}>Assign Students</Text>
        <Text style={s.headerCount}>{students.length}</Text>
      </View>
      <FlatList
        data={students}
        keyExtractor={st => st.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={C.blue} />
        }
        ListHeaderComponent={
          <Text style={s.hint}>Tap a student to assign or reassign a counselor.</Text>
        }
        ListEmptyComponent={
          <View style={s.empty}><Text style={s.emptyText}>No students found</Text></View>
        }
        renderItem={({ item }) => {
          const initials = item.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
          const assigned = item.profile?.counselor_id || item.profile?.agent_id
          return (
            <TouchableOpacity style={s.userCard} onPress={() => setSelectedStudent(item)}>
              <View style={[s.avatar, { backgroundColor: C.blue + '22' }]}>
                <Text style={[s.avatarText, { color: C.blue }]}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.userName}>{item.name}</Text>
                <Text style={s.userSub}>{item.profile?.school ?? item.email}</Text>
              </View>
              {assigned
                ? <View style={s.assignedBadge}><Text style={s.assignedText}>Assigned</Text></View>
                : <View style={s.unassignedBadge}><Text style={s.unassignedText}>Unassigned</Text></View>}
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header:          { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:         { marginRight: 12 },
  title:           { flex: 1, fontSize: 18, fontWeight: '800', color: C.navy },
  headerCount:     { fontSize: 12, color: C.slate400 },
  banner:          { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', padding: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#DBEAFE' },
  bannerText:      { fontSize: 13, color: C.blue },
  hint:            { fontSize: 12, color: C.slate400, marginBottom: 12 },
  userCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 14, padding: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  avatar:          { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText:      { fontSize: 15, fontWeight: '800' },
  userName:        { fontSize: 14, fontWeight: '700', color: C.navy },
  userSub:         { fontSize: 11, color: C.slate400, marginTop: 1, textTransform: 'capitalize' },
  assignedBadge:   { backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  assignedText:    { fontSize: 10, fontWeight: '700', color: '#059669' },
  unassignedBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  unassignedText:  { fontSize: 10, fontWeight: '700', color: '#D97706' },
  empty:           { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText:       { fontSize: 14, color: C.slate400, fontWeight: '600' },
})
