import { useEffect, useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  TextInput, Modal, ActivityIndicator, Animated, LayoutAnimation, Alert, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

type Priority  = 'low' | 'normal' | 'high' | 'urgent'
type TStatus   = 'pending' | 'in_progress' | 'completed'
type Task = {
  id: string; title: string; description?: string
  priority: Priority; status: TStatus
  created_by: string; assigned_to?: string
  due_date?: string; created_at: string
}

const P_META = {
  low:    { label: 'Low',    color: '#10B981', bg: '#D1FAE5', icon: 'arrow-down-outline'   },
  normal: { label: 'Normal', color: '#3B82F6', bg: '#DBEAFE', icon: 'remove-outline'       },
  high:   { label: 'High',   color: '#F59E0B', bg: '#FEF3C7', icon: 'arrow-up-outline'     },
  urgent: { label: 'Urgent', color: '#EF4444', bg: '#FEE2E2', icon: 'alert-circle-outline' },
} as const

const FILTERS = [
  { key: 'all',         label: 'All'         },
  { key: 'pending',     label: 'Pending'     },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed',   label: 'Done'        },
]

export default function TasksScreen() {
  const C      = useColors()
  const s      = mkS(C)
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [tasks,   setTasks]     = useState<Task[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter,  setFilter]    = useState('all')
  const [modal,   setModal]     = useState(false)
  const [saving,  setSaving]    = useState(false)

  const [ttl,  setTtl]  = useState('')
  const [desc, setDesc] = useState('')
  const [prio, setPrio] = useState<Priority>('normal')
  const [due,  setDue]  = useState('')

  const fabAnim   = useRef(new Animated.Value(0)).current
  const sheetAnim = useRef(new Animated.Value(500)).current

  useEffect(() => {
    load()
    Animated.spring(fabAnim, { toValue: 1, tension: 180, friction: 12, delay: 300, useNativeDriver: true }).start()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('tasks')
      .select('*')
      .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
      .order('created_at', { ascending: false })
    setTasks(data ?? [])
    setLoading(false)
  }

  const openModal = () => {
    setTtl(''); setDesc(''); setPrio('normal'); setDue('')
    setModal(true)
    sheetAnim.setValue(500)
    Animated.spring(sheetAnim, { toValue: 0, tension: 200, friction: 22, useNativeDriver: true }).start()
  }

  const closeModal = () => {
    Animated.timing(sheetAnim, { toValue: 500, duration: 220, useNativeDriver: true }).start(() => setModal(false))
  }

  const createTask = async () => {
    if (!ttl.trim() || saving) return
    setSaving(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { data: created, error } = await supabase.from('tasks').insert({
      title: ttl.trim(),
      description: desc.trim() || null,
      priority: prio,
      status: 'pending',
      created_by: user.id,
      due_date: due || null,
    }).select().single()
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    if (created) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setTasks(prev => [created as Task, ...prev])
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
    closeModal()
  }

  const toggleDone = async (task: Task) => {
    const next: TStatus = task.status === 'completed' ? 'pending' : 'completed'
    Haptics.impactAsync(next === 'completed' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
    await supabase.from('tasks').update({ status: next }).eq('id', task.id)
  }

  const del = (id: string) => {
    Alert.alert('Delete task?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          setTasks(prev => prev.filter(t => t.id !== id))
          await supabase.from('tasks').delete().eq('id', id)
        },
      },
    ])
  }

  const formatDue = (d: string) => {
    const ms   = new Date(d).getTime() - Date.now()
    const days = Math.floor(ms / 86400000)
    if (days < 0)  return { label: 'Overdue', color: '#EF4444' }
    if (days === 0) return { label: 'Due today', color: '#F59E0B' }
    if (days === 1) return { label: 'Tomorrow', color: '#F59E0B' }
    return { label: `In ${days}d`, color: C.slate500 }
  }

  const counts: Record<string, number> = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  }
  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  return (
    <View style={s.bg}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Tasks</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.filterBar} contentContainerStyle={s.filterContent}>
        {FILTERS.map(f => {
          const active = filter === f.key
          return (
            <TouchableOpacity key={f.key}
              style={[s.chip, active && s.chipActive]}
              onPress={() => { setFilter(f.key); Haptics.selectionAsync() }}>
              <Text style={[s.chipTxt, active && s.chipTxtActive]}>{f.label}</Text>
              <View style={[s.badge, active && s.badgeActive]}>
                <Text style={[s.badgeTxt, active && s.badgeTxtActive]}>{counts[f.key]}</Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={t => t.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}><Ionicons name="checkbox-outline" size={40} color={C.slate300} /></View>
              <Text style={s.emptyTitle}>No tasks here</Text>
              <Text style={s.emptySub}>Tap + to create your first task</Text>
            </View>
          }
          renderItem={({ item }) => {
            const pm   = P_META[item.priority]
            const done = item.status === 'completed'
            const due  = item.due_date ? formatDue(item.due_date) : null
            return (
              <TouchableOpacity
                style={[s.card, done && s.cardDone]}
                onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); del(item.id) }}
                delayLongPress={500}
                activeOpacity={0.85}
              >
                <TouchableOpacity
                  style={[s.check, done && { backgroundColor: C.blue, borderColor: C.blue }]}
                  onPress={() => toggleDone(item)}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  {done && <Ionicons name="checkmark" size={14} color={C.white} />}
                </TouchableOpacity>

                <View style={s.cardBody}>
                  <Text style={[s.cardTitle, done && s.cardTitleDone]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {!!item.description && (
                    <Text style={s.cardDesc} numberOfLines={1}>{item.description}</Text>
                  )}
                  <View style={s.cardMeta}>
                    <View style={[s.prioTag, { backgroundColor: pm.bg }]}>
                      <Ionicons name={pm.icon as any} size={10} color={pm.color} />
                      <Text style={[s.prioTxt, { color: pm.color }]}>{pm.label}</Text>
                    </View>
                    {due && <Text style={[s.dueTxt, { color: due.color }]}>{due.label}</Text>}
                  </View>
                </View>

                {item.status === 'in_progress' && (
                  <View style={s.inProgDot} />
                )}
              </TouchableOpacity>
            )
          }}
        />
      )}

      {/* FAB */}
      <Animated.View style={[s.fab, { bottom: 20 + insets.bottom, transform: [{ scale: fabAnim }] }]}>
        <TouchableOpacity style={s.fabInner} onPress={openModal} activeOpacity={0.82}>
          <Ionicons name="add" size={28} color={C.white} />
        </TouchableOpacity>
      </Animated.View>

      {/* Create modal */}
      <Modal visible={modal} transparent animationType="none" onRequestClose={closeModal}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={closeModal}>
          <Animated.View style={[s.sheet, { transform: [{ translateY: sheetAnim }], paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={s.handle} />
              <Text style={s.sheetTitle}>New Task</Text>

              <TextInput
                style={s.input}
                placeholder="Task title *"
                placeholderTextColor={C.slate400}
                value={ttl}
                onChangeText={setTtl}
                autoFocus
                maxLength={120}
              />
              <TextInput
                style={[s.input, { height: 72, textAlignVertical: 'top' }]}
                placeholder="Description (optional)"
                placeholderTextColor={C.slate400}
                value={desc}
                onChangeText={setDesc}
                multiline
                maxLength={400}
              />

              <Text style={s.fieldLabel}>Priority</Text>
              <View style={s.prioRow}>
                {(['low', 'normal', 'high', 'urgent'] as Priority[]).map(p => {
                  const pm = P_META[p]
                  const act = prio === p
                  return (
                    <TouchableOpacity key={p}
                      style={[s.prioBtn, { borderColor: act ? pm.color : C.slate200, backgroundColor: act ? pm.bg : C.bg }]}
                      onPress={() => { setPrio(p); Haptics.selectionAsync() }}>
                      <Ionicons name={pm.icon as any} size={14} color={act ? pm.color : C.slate400} />
                      <Text style={[s.prioBtnTxt, { color: act ? pm.color : C.slate400 }]}>{pm.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <Text style={s.fieldLabel}>Due Date (optional)</Text>
              <TextInput
                style={s.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.slate400}
                value={due}
                onChangeText={setDue}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[s.saveBtn, (!ttl.trim() || saving) && { opacity: 0.45 }]}
                onPress={createTask}
                disabled={!ttl.trim() || saving}
              >
                {saving
                  ? <ActivityIndicator color={C.white} />
                  : <Text style={s.saveBtnTxt}>Create Task</Text>}
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:           { flex: 1, backgroundColor: C.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  header:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.navy },
  filterBar:    { flexShrink: 0, maxHeight: 54 },
  filterContent:{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.slate200 },
  chipActive:   { backgroundColor: C.blue, borderColor: C.blue },
  chipTxt:      { fontSize: 12, fontWeight: '700', color: C.slate500 },
  chipTxtActive:{ color: C.white },
  badge:        { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.slate100, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeActive:  { backgroundColor: 'rgba(255,255,255,0.25)' },
  badgeTxt:     { fontSize: 10, fontWeight: '800', color: C.slate500 },
  badgeTxtActive:{ color: C.white },

  card:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardDone:     { opacity: 0.55 },
  check:        { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.slate300, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  cardBody:     { flex: 1 },
  cardTitle:    { fontSize: 14, fontWeight: '700', color: C.navy, lineHeight: 20 },
  cardTitleDone:{ textDecorationLine: 'line-through', color: C.slate400 },
  cardDesc:     { fontSize: 12, color: C.slate500, marginTop: 2 },
  cardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  prioTag:      { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  prioTxt:      { fontSize: 10, fontWeight: '700' },
  dueTxt:       { fontSize: 11, fontWeight: '600' },
  inProgDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B', marginTop: 6, flexShrink: 0 },

  fab:          { position: 'absolute', right: 20 },
  fabInner:     { width: 56, height: 56, borderRadius: 28, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: C.blue, shadowOpacity: 0.4, shadowRadius: 12 },

  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: C.slate200, alignSelf: 'center', marginBottom: 18 },
  sheetTitle:   { fontSize: 20, fontWeight: '800', color: C.navy, marginBottom: 16 },
  input:        { backgroundColor: C.bg, borderRadius: 14, padding: 13, fontSize: 14, color: C.navy, marginBottom: 12, borderWidth: 1.5, borderColor: C.slate200 },
  fieldLabel:   { fontSize: 11, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  prioRow:      { flexDirection: 'row', gap: 8, marginBottom: 16 },
  prioBtn:      { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  prioBtnTxt:   { fontSize: 10, fontWeight: '700' },
  saveBtn:      { backgroundColor: C.blue, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  saveBtnTxt:   { fontSize: 15, fontWeight: '800', color: C.white },

  empty:        { alignItems: 'center', paddingTop: 60 },
  emptyIcon:    { width: 80, height: 80, borderRadius: 40, backgroundColor: C.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:   { fontSize: 18, fontWeight: '800', color: C.navy, marginBottom: 6 },
  emptySub:     { fontSize: 13, color: C.slate400 },
})
