import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

type EventType = 'interview' | 'deadline' | 'appointment' | 'meeting' | 'other'
type CalEvent = {
  id: string; title: string; type: EventType
  starts_at: string; ends_at?: string; description?: string
  student_id?: string; created_by: string
}

const EV = {
  interview:   { label: 'Interview',   color: '#8B5CF6', bg: '#EDE9FE', icon: 'mic-outline'                   },
  deadline:    { label: 'Deadline',    color: '#EF4444', bg: '#FEE2E2', icon: 'hourglass-outline'             },
  appointment: { label: 'Appointment', color: '#3B82F6', bg: '#DBEAFE', icon: 'calendar-outline'              },
  meeting:     { label: 'Meeting',     color: '#10B981', bg: '#D1FAE5', icon: 'people-outline'                },
  other:       { label: 'Other',       color: '#64748B', bg: '#F1F5F9', icon: 'ellipsis-horizontal-outline'   },
} as const

function dateLabel(iso: string): string {
  const d   = new Date(iso)
  const now = new Date()
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tgt     = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffMs  = tgt.getTime() - today.getTime()
  const diffDay = Math.round(diffMs / 86400000)
  if (diffDay === 0) return 'Today'
  if (diffDay === 1) return 'Tomorrow'
  if (diffDay === -1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

type GroupedSection = { date: string; events: CalEvent[] }

function groupByDate(events: CalEvent[]): GroupedSection[] {
  const map = new Map<string, CalEvent[]>()
  events.forEach(e => {
    const key = new Date(e.starts_at).toDateString()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  })
  return Array.from(map.entries()).map(([, evs]) => ({
    date: evs[0].starts_at,
    events: evs,
  }))
}

export default function CalendarScreen() {
  const C      = useColors()
  const s      = mkS(C)
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [events,    setEvents]   = useState<CalEvent[]>([])
  const [loading,   setLoading]  = useState(true)
  const [upcoming,  setUpcoming] = useState(true)
  const [myId,      setMyId]     = useState<string | null>(null)
  const [myRole,    setMyRole]   = useState<string>('student')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setMyId(user.id)
    const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single()
    const role = dbUser?.role ?? 'student'
    setMyRole(role)

    let q = supabase.from('calendar_events').select('*').order('starts_at', { ascending: true })
    if (role === 'student') q = q.eq('student_id', user.id)
    const { data } = await q
    setEvents(data ?? [])
    setLoading(false)
  }

  const shown = upcoming
    ? events.filter(e => new Date(e.starts_at) >= new Date())
    : events

  const sections = groupByDate(shown)

  const flatData: (GroupedSection | CalEvent)[] = []
  sections.forEach(sec => {
    flatData.push(sec)
    sec.events.forEach(e => flatData.push(e))
  })

  return (
    <View style={s.bg}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Calendar</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Toggle */}
      <View style={s.toggleWrap}>
        <View style={s.toggle}>
          <TouchableOpacity
            style={[s.toggleBtn, upcoming && s.toggleBtnActive]}
            onPress={() => { setUpcoming(true); Haptics.selectionAsync() }}>
            <Text style={[s.toggleTxt, upcoming && s.toggleTxtActive]}>Upcoming</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, !upcoming && s.toggleBtnActive]}
            onPress={() => { setUpcoming(false); Haptics.selectionAsync() }}>
            <Text style={[s.toggleTxt, !upcoming && s.toggleTxtActive]}>All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item: any) => item.id ?? item.date}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}><Ionicons name="calendar-outline" size={40} color={C.slate300} /></View>
              <Text style={s.emptyTitle}>{upcoming ? 'No upcoming events' : 'No events'}</Text>
              <Text style={s.emptySub}>Events created by your team will appear here</Text>
            </View>
          }
          renderItem={({ item }: any) => {
            // Section header
            if ('events' in item) {
              return (
                <View style={s.dateHeader}>
                  <Text style={s.dateTxt}>{dateLabel(item.date)}</Text>
                  <View style={s.dateLine} />
                </View>
              )
            }
            // Event card
            const ev = item as CalEvent
            const meta = EV[ev.type] ?? EV.other
            const isPast = new Date(ev.starts_at) < new Date()
            return (
              <View style={[s.card, isPast && s.cardPast]}>
                <View style={[s.typeDot, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                </View>
                <View style={s.cardBody}>
                  <Text style={s.cardTitle} numberOfLines={2}>{ev.title}</Text>
                  <View style={s.cardRow}>
                    <View style={[s.typeTag, { backgroundColor: meta.bg }]}>
                      <Text style={[s.typeTxt, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <Text style={s.timeTxt}>
                      {formatTime(ev.starts_at)}
                      {ev.ends_at ? ` – ${formatTime(ev.ends_at)}` : ''}
                    </Text>
                  </View>
                  {!!ev.description && (
                    <Text style={s.descTxt} numberOfLines={2}>{ev.description}</Text>
                  )}
                </View>
                {isPast && (
                  <View style={s.pastBadge}>
                    <Text style={s.pastBadgeTxt}>Past</Text>
                  </View>
                )}
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:           { flex: 1, backgroundColor: C.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  header:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.navy },

  toggleWrap:   { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  toggle:       { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 12, padding: 4 },
  toggleBtn:    { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  toggleBtnActive: { backgroundColor: C.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  toggleTxt:    { fontSize: 13, fontWeight: '600', color: C.slate400 },
  toggleTxtActive: { color: C.navy, fontWeight: '700' },

  dateHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, marginTop: 6 },
  dateTxt:      { fontSize: 13, fontWeight: '800', color: C.navy, flexShrink: 0 },
  dateLine:     { flex: 1, height: 1, backgroundColor: C.slate200 },

  card:         { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardPast:     { opacity: 0.6 },
  typeDot:      { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardBody:     { flex: 1 },
  cardTitle:    { fontSize: 14, fontWeight: '700', color: C.navy, lineHeight: 20, marginBottom: 6 },
  cardRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeTag:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeTxt:      { fontSize: 11, fontWeight: '700' },
  timeTxt:      { fontSize: 12, color: C.slate500, fontWeight: '600' },
  descTxt:      { fontSize: 12, color: C.slate500, marginTop: 6, lineHeight: 17 },
  pastBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: C.slate100, alignSelf: 'flex-start' },
  pastBadgeTxt: { fontSize: 10, fontWeight: '700', color: C.slate500 },

  empty:        { alignItems: 'center', paddingTop: 60 },
  emptyIcon:    { width: 80, height: 80, borderRadius: 40, backgroundColor: C.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:   { fontSize: 18, fontWeight: '800', color: C.navy, marginBottom: 6 },
  emptySub:     { fontSize: 13, color: C.slate400, textAlign: 'center', paddingHorizontal: 32 },
})
