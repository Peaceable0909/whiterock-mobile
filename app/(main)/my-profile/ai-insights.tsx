import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const TYPE_META = {
  document_check:   { label: 'Document Check',   icon: 'document-text-outline', color: '#3B82F6' },
  case_summary:     { label: 'Case Summary',     icon: 'document-outline',      color: '#10B981' },
  risk_assessment:  { label: 'Risk Assessment',  icon: 'alert-circle-outline',  color: '#F59E0B' },
  recommendation:   { label: 'Recommendation',   icon: 'lightbulb-outline',     color: '#8B5CF6' },
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const ms = now.getTime() - d.getTime()
  if (ms < 86400000) return 'Today'
  if (ms < 172800000) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function AIInsightsTab() {
  const C      = useColors()
  const s      = mkS(C)
  const insets = useSafeAreaInsets()

  const [insights, setInsights] = useState<any[]>([])
  const [memory,   setMemory]   = useState<any>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [{ data: insightData }, { data: memData }] = await Promise.all([
      supabase.from('ai_insights').select('*').eq('student_id', user.id).order('created_at', { ascending: false }),
      supabase.from('ai_student_memory').select('*').eq('student_id', user.id).single(),
    ])

    setInsights(insightData ?? [])
    setMemory(memData)
    setLoading(false)
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>

  const data: any[] = []
  if (memory?.summary) {
    data.push({ _id: 'memory', type: 'memory' })
  }
  if (memory?.facts && Array.isArray(memory.facts) && memory.facts.length > 0) {
    data.push({ _id: 'facts', type: 'facts' })
  }
  data.push(...insights)

  return (
    <FlatList
      data={data}
      keyExtractor={item => item._id ?? item.id}
      contentContainerStyle={[s.content, { paddingBottom: 32 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={s.empty}>
          <View style={s.emptyIcon}><Ionicons name="bulb-outline" size={40} color={C.slate300} /></View>
          <Text style={s.emptyTitle}>No AI insights yet</Text>
        </View>
      }
      renderItem={({ item }) => {
        if (item.type === 'memory') {
          return (
            <View style={[s.card, s.cardMem]}>
              <View style={s.cardHeader}>
                <Ionicons name="hardware-chip-outline" size={20} color="#8B5CF6" />
                <Text style={s.memTitle}>AI Memory</Text>
              </View>
              <Text style={s.memText}>{memory.summary}</Text>
              <Text style={s.memUpdated}>Last updated: {formatDate(memory.updated_at)}</Text>
            </View>
          )
        }
        if (item.type === 'facts') {
          return (
            <View style={[s.card, s.cardFacts]}>
              <View style={s.cardHeader}>
                <Ionicons name="sparkles-outline" size={20} color="#F59E0B" />
                <Text style={s.factsTitle}>Key Facts</Text>
              </View>
              {memory.facts.map((f: string, i: number) => (
                <View key={i} style={s.factItem}>
                  <Text style={s.factBullet}>•</Text>
                  <Text style={s.factText}>{f}</Text>
                </View>
              ))}
            </View>
          )
        }

        const typeMeta = TYPE_META[item.type as keyof typeof TYPE_META] ?? TYPE_META.recommendation
        return (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.insightType}>{typeMeta.label}</Text>
                <Text style={s.insightDate}>{formatDate(item.created_at)}</Text>
              </View>
              <View style={[s.typeDot, { backgroundColor: typeMeta.color + '18' }]}>
                <Ionicons name={typeMeta.icon as any} size={14} color={typeMeta.color} />
              </View>
            </View>
            <Text style={s.insightContent}>{item.content}</Text>
          </View>
        )
      }}
    />
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:        { padding: 16 },
  card:           { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardMem:        { backgroundColor: '#F3F0FF', borderLeftWidth: 4, borderLeftColor: '#8B5CF6' },
  cardFacts:      { backgroundColor: '#FFFBEB', borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  memTitle:       { fontSize: 15, fontWeight: '800', color: '#8B5CF6' },
  factsTitle:     { fontSize: 15, fontWeight: '800', color: '#F59E0B' },
  insightType:    { fontSize: 13, fontWeight: '700', color: C.navy },
  insightDate:    { fontSize: 11, color: C.slate400, marginTop: 2 },
  typeDot:        { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  memText:        { fontSize: 13, color: '#6B21A8', lineHeight: 20, marginBottom: 6 },
  memUpdated:     { fontSize: 10, color: '#8B5CF6', fontWeight: '600' },
  factItem:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  factBullet:     { fontSize: 16, color: '#D97706', fontWeight: '600' },
  factText:       { flex: 1, fontSize: 13, color: '#78350F', lineHeight: 18 },
  insightContent: { fontSize: 13, color: C.slate600, lineHeight: 20 },
  empty:          { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon:      { width: 80, height: 80, borderRadius: 40, backgroundColor: C.slate100, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:     { fontSize: 14, color: C.slate400 },
})
