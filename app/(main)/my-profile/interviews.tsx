import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const STATUS_META = {
  scheduled:  { label: 'Scheduled', color: '#3B82F6', bg: '#DBEAFE' },
  completed:  { label: 'Completed', color: '#10B981', bg: '#D1FAE5' },
  cancelled:  { label: 'Cancelled', color: '#EF4444', bg: '#FEE2E2' },
}

const TYPE_META = {
  phone:     { label: 'Phone', icon: 'call-outline' },
  video:     { label: 'Video', icon: 'videocam-outline' },
  in_person: { label: 'In-Person', icon: 'person-outline' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function InterviewsTab() {
  const C      = useColors()
  const s      = mkS(C)
  const insets = useSafeAreaInsets()

  const [interviews, setInterviews] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('interviews')
      .select('*')
      .eq('student_id', user.id)
      .order('scheduled_at', { ascending: false })
    setInterviews(data ?? [])
    setLoading(false)
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>

  return (
    <FlatList
      data={interviews}
      keyExtractor={i => i.id}
      contentContainerStyle={[s.content, { paddingBottom: 32 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={s.empty}>
          <View style={s.emptyIcon}><Ionicons name="mic-outline" size={40} color={C.slate300} /></View>
          <Text style={s.emptyTitle}>No interviews yet</Text>
        </View>
      }
      renderItem={({ item }) => {
        const statusMeta = STATUS_META[item.status as keyof typeof STATUS_META] ?? STATUS_META.scheduled
        const typeMeta = TYPE_META[item.type as keyof typeof TYPE_META] ?? { label: item.type, icon: 'information-outline' }
        return (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{item.title}</Text>
                <View style={s.typeBadge}>
                  <Ionicons name={typeMeta.icon as any} size={12} color={C.slate500} />
                  <Text style={s.typeTxt}>{typeMeta.label}</Text>
                </View>
              </View>
              <View style={[s.statusTag, { backgroundColor: statusMeta.bg }]}>
                <Text style={[s.statusTxt, { color: statusMeta.color }]}>{statusMeta.label}</Text>
              </View>
            </View>

            {item.scheduled_at && (
              <View style={s.infoRow}>
                <Ionicons name="calendar-outline" size={14} color={C.slate400} />
                <Text style={s.infoTxt}>{formatDate(item.scheduled_at)}</Text>
              </View>
            )}

            {item.status === 'completed' && item.score !== null && (
              <View style={s.infoRow}>
                <Ionicons name="star-outline" size={14} color={C.slate400} />
                <Text style={s.infoTxt}>Score: {item.score}/100</Text>
              </View>
            )}

            {item.feedback && (
              <>
                <Text style={s.feedbackLabel}>Feedback</Text>
                <Text style={s.feedbackText}>{item.feedback}</Text>
              </>
            )}
          </View>
        )
      }}
    />
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:      { padding: 16 },
  card:         { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  cardTitle:    { fontSize: 15, fontWeight: '700', color: C.navy, marginBottom: 4 },
  typeBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typeTxt:      { fontSize: 11, color: C.slate500, fontWeight: '600' },
  statusTag:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusTxt:    { fontSize: 11, fontWeight: '700' },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  infoTxt:      { fontSize: 12, color: C.slate500 },
  feedbackLabel:{ fontSize: 11, fontWeight: '700', color: C.slate400, marginTop: 8, marginBottom: 4 },
  feedbackText: { fontSize: 12, color: C.slate600, lineHeight: 18 },
  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon:    { width: 80, height: 80, borderRadius: 40, backgroundColor: C.slate100, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:   { fontSize: 14, color: C.slate400 },
})
