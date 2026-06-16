import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, RefreshControl, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AppHeader } from '@/components/AppHeader'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Skeleton, SkeletonCard, EmptyState } from '@/components/Skeleton'

const EVENT_TYPES = [
  { key: 'consultation',  label: 'Consultation',  icon: 'chatbubbles-outline',    color: '#1D4ED8' },
  { key: 'document',      label: 'Document',       icon: 'document-text-outline',  color: '#7C3AED' },
  { key: 'interview',     label: 'Interview',      icon: 'mic-outline',            color: '#059669' },
  { key: 'follow_up',     label: 'Follow-up',      icon: 'refresh-outline',        color: '#F59E0B' },
  { key: 'visa',          label: 'Visa',           icon: 'globe-outline',           color: '#0E7490' },
  { key: 'other',         label: 'Other',          icon: 'ellipsis-horizontal-outline', color: '#64748B' },
] as const

type EventType = typeof EVENT_TYPES[number]['key']

const TYPE_MAP = Object.fromEntries(EVENT_TYPES.map(t => [t.key, t])) as Record<EventType, typeof EVENT_TYPES[number]>

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const isUpcoming = (iso: string) => new Date(iso) > new Date()

export default function AppointmentsScreen() {
  const C                            = useColors()
  const [events, setEvents]         = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [myId, setMyId]             = useState('')
  const [myRole, setMyRole]         = useState('student')
  const [students, setStudents]     = useState<any[]>([])
  const [showModal, setShowModal]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [tab, setTab]               = useState<'upcoming' | 'past'>('upcoming')
  const insets                      = useSafeAreaInsets()

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'consultation' as EventType,
    student_id: '',
    starts_at: '',
    ends_at: '',
  })

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single()
    const r = dbUser?.role ?? 'student'
    setMyRole(r)

    let query = supabase
      .from('calendar_events')
      .select('*, student:student_id(id, name), creator:created_by(id, name)')
      .order('starts_at', { ascending: true })

    if (r === 'student') {
      query = query.eq('student_id', user.id)
    } else {
      query = query.eq('created_by', user.id)
    }

    const { data } = await query
    setEvents(data ?? [])

    if (r !== 'student') {
      const { data: convs } = await supabase
        .from('conversations')
        .select('student:student_id(id, name)')
        .or(`counselor_id.eq.${user.id},agent_id.eq.${user.id}`)
      const studs = (convs ?? []).map((c: any) => c.student).filter(Boolean)
      const uniq = Object.values(Object.fromEntries(studs.map((s: any) => [s.id, s])))
      setStudents(uniq as any[])
    }

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createEvent = async () => {
    if (!form.title.trim()) { Alert.alert('Title required'); return }
    if (!form.starts_at)    { Alert.alert('Start date/time required'); return }
    setSaving(true)
    const { error } = await supabase.from('calendar_events').insert({
      title:       form.title.trim(),
      description: form.description.trim() || null,
      type:        form.type,
      student_id:  form.student_id || null,
      starts_at:   form.starts_at,
      ends_at:     form.ends_at || null,
      created_by:  myId,
    })
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    setShowModal(false)
    setForm({ title: '', description: '', type: 'consultation', student_id: '', starts_at: '', ends_at: '' })
    load()
  }

  const deleteEvent = (id: string) => {
    Alert.alert('Delete appointment?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('calendar_events').delete().eq('id', id)
          setEvents(prev => prev.filter(e => e.id !== id))
        },
      },
    ])
  }

  const displayed = events.filter(e =>
    tab === 'upcoming' ? isUpcoming(e.starts_at) : !isUpcoming(e.starts_at)
  )

  const s = mkS(C)
  if (loading) return (
    <View style={s.bg}>
      <AppHeader title="Appointments" />
      <View style={{ padding: 14, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
          <Skeleton height={32} width={90} radius={20} />
          <Skeleton height={32} width={90} radius={20} />
        </View>
        {[0, 1, 2].map(i => (
          <SkeletonCard key={i}>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
              <Skeleton height={38} width={38} radius={10} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton height={13} width={'60%'} radius={4} />
                <Skeleton height={11} width={'40%'} radius={4} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Skeleton height={24} width={90} radius={20} />
              <Skeleton height={24} width={70} radius={20} />
            </View>
          </SkeletonCard>
        ))}
      </View>
    </View>
  )

  return (
    <View style={s.bg}>
      <AppHeader title="Appointments" />

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['upcoming', 'past'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={e => e.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 100 + insets.bottom }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={C.blue} />}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title={tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
            subtitle={myRole !== 'student' && tab === 'upcoming' ? 'Tap + to schedule one' : undefined}
          />
        }
        renderItem={({ item }) => {
          const meta = TYPE_MAP[item.type as EventType] ?? TYPE_MAP['other']
          const upcoming = isUpcoming(item.starts_at)
          return (
            <View style={[s.card, !upcoming && s.cardPast]}>
              <View style={[s.typeTag, { backgroundColor: meta.color + '18' }]}>
                <Ionicons name={meta.icon as any} size={14} color={meta.color} />
                <Text style={[s.typeLabel, { color: meta.color }]}>{meta.label}</Text>
              </View>

              <Text style={s.eventTitle}>{item.title}</Text>

              <View style={s.timeRow}>
                <Ionicons name="time-outline" size={13} color={C.slate400} />
                <Text style={s.timeText}>
                  {formatDate(item.starts_at)} · {formatTime(item.starts_at)}
                  {item.ends_at ? ` – ${formatTime(item.ends_at)}` : ''}
                </Text>
              </View>

              {item.student?.name && (
                <View style={s.studentRow}>
                  <Ionicons name="person-outline" size={13} color={C.slate400} />
                  <Text style={s.studentName}>{item.student.name}</Text>
                </View>
              )}

              {item.description ? (
                <Text style={s.desc} numberOfLines={2}>{item.description}</Text>
              ) : null}

              {myRole !== 'student' && (
                <TouchableOpacity style={s.deleteBtn} onPress={() => deleteEvent(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={14} color={C.slate400} />
                </TouchableOpacity>
              )}
            </View>
          )
        }}
      />

      {myRole !== 'student' && (
        <TouchableOpacity style={s.fab} onPress={() => setShowModal(true)} accessibilityLabel="New appointment">
          <Ionicons name="add" size={26} color={C.white} />
        </TouchableOpacity>
      )}

      {/* Create modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalBg}>
            <View style={s.modalSheet}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>New Appointment</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={20} color={C.slate400} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }} showsVerticalScrollIndicator={false}>
                {/* Type */}
                <Text style={s.fieldLabel}>Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {EVENT_TYPES.map(t => (
                    <TouchableOpacity
                      key={t.key}
                      style={[s.typeChip, form.type === t.key && { backgroundColor: t.color, borderColor: t.color }]}
                      onPress={() => setForm(f => ({ ...f, type: t.key }))}
                    >
                      <Ionicons name={t.icon as any} size={12} color={form.type === t.key ? C.white : C.slate500} />
                      <Text style={[s.typeChipText, form.type === t.key && { color: C.white }]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Student */}
                {students.length > 0 && (
                  <>
                    <Text style={s.fieldLabel}>Student (optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {students.map((st: any) => (
                        <TouchableOpacity
                          key={st.id}
                          style={[s.studentChip, form.student_id === st.id && s.studentChipActive]}
                          onPress={() => setForm(f => ({ ...f, student_id: f.student_id === st.id ? '' : st.id }))}
                        >
                          <Text style={[s.studentChipText, form.student_id === st.id && { color: C.white }]}>
                            {st.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}

                {/* Title */}
                <Text style={s.fieldLabel}>Title *</Text>
                <TextInput
                  style={s.input}
                  value={form.title}
                  onChangeText={t => setForm(f => ({ ...f, title: t }))}
                  placeholder="e.g. CAS Document Review"
                  placeholderTextColor={C.slate400}
                  maxLength={100}
                />

                {/* Description */}
                <Text style={s.fieldLabel}>Notes</Text>
                <TextInput
                  style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                  value={form.description}
                  onChangeText={t => setForm(f => ({ ...f, description: t }))}
                  placeholder="Any additional notes..."
                  placeholderTextColor={C.slate400}
                  multiline
                  maxLength={500}
                />

                {/* Start */}
                <Text style={s.fieldLabel}>Start (ISO 8601) *</Text>
                <TextInput
                  style={s.input}
                  value={form.starts_at}
                  onChangeText={t => setForm(f => ({ ...f, starts_at: t }))}
                  placeholder="2026-06-20T10:00:00"
                  placeholderTextColor={C.slate400}
                  autoCapitalize="none"
                />

                {/* End */}
                <Text style={s.fieldLabel}>End (optional)</Text>
                <TextInput
                  style={s.input}
                  value={form.ends_at}
                  onChangeText={t => setForm(f => ({ ...f, ends_at: t }))}
                  placeholder="2026-06-20T11:00:00"
                  placeholderTextColor={C.slate400}
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={[s.saveBtn, (saving || !form.title.trim() || !form.starts_at) && { opacity: 0.4 }]}
                  onPress={createEvent}
                  disabled={saving || !form.title.trim() || !form.starts_at}
                >
                  {saving
                    ? <ActivityIndicator color={C.white} />
                    : <Text style={s.saveBtnText}>Schedule Appointment</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:             { flex: 1, backgroundColor: C.bg },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabRow:         { flexDirection: 'row', marginHorizontal: 14, marginBottom: 12, backgroundColor: C.white, borderRadius: 14, padding: 4, gap: 4 },
  tabBtn:         { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabBtnActive:   { backgroundColor: C.blue },
  tabBtnText:     { fontSize: 13, fontWeight: '700', color: C.slate500 },
  tabBtnTextActive:{ color: C.white },
  emptyBox:       { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle:     { fontSize: 15, fontWeight: '700', color: C.slate500 },
  emptySub:       { fontSize: 13, color: C.slate400 },
  card:           { backgroundColor: C.white, borderRadius: 18, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, position: 'relative' },
  cardPast:       { opacity: 0.65 },
  typeTag:        { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 8 },
  typeLabel:      { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  eventTitle:     { fontSize: 15, fontWeight: '800', color: C.navy, marginBottom: 8 },
  timeRow:        { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  timeText:       { fontSize: 12, color: C.slate500, fontWeight: '600' },
  studentRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  studentName:    { fontSize: 12, color: C.slate500 },
  desc:           { fontSize: 12, color: C.slate400, marginTop: 6, lineHeight: 18 },
  deleteBtn:      { position: 'absolute', top: 14, right: 14, padding: 4 },
  fab:            { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: C.blue, shadowOpacity: 0.35, shadowRadius: 8 },
  modalBg:        { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:     { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderColor: C.slate100 },
  modalTitle:     { fontSize: 16, fontWeight: '800', color: C.navy },
  fieldLabel:     { fontSize: 11, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input:          { backgroundColor: C.slate100, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.navy, borderWidth: 1, borderColor: C.slate200 },
  typeChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.slate200, backgroundColor: C.white },
  typeChipText:   { fontSize: 12, fontWeight: '600', color: C.slate500 },
  studentChip:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.slate200, backgroundColor: C.white },
  studentChipActive: { backgroundColor: C.blue, borderColor: C.blue },
  studentChipText:{ fontSize: 12, fontWeight: '600', color: C.slate500 },
  saveBtn:        { height: 50, backgroundColor: C.blue, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnText:    { fontSize: 15, fontWeight: '700', color: C.white },
})
