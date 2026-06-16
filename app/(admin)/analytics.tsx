import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { C } from '@/constants/colors'

const STAGES = [
  { key: 'lead',                   label: 'Lead',            color: '#94A3B8' },
  { key: 'application_submitted',  label: 'Applied',         color: '#60A5FA' },
  { key: 'offer_received',         label: 'Offer',           color: '#818CF8' },
  { key: 'deposit_paid',           label: 'Deposit Paid',    color: '#A78BFA' },
  { key: 'cas_requested',          label: 'CAS Requested',   color: '#F59E0B' },
  { key: 'cas_issued',             label: 'CAS Issued',      color: '#F97316' },
  { key: 'visa_submitted',         label: 'Visa Submitted',  color: '#EC4899' },
  { key: 'visa_decision',          label: 'Visa Decision',   color: '#22C55E' },
]

interface Stats {
  totalStudents: number
  totalCounselors: number
  totalAgents: number
  totalConversations: number
  totalMessages: number
  totalUpdates: number
  totalNotifications: number
  stageBreakdown: Record<string, number>
  counselorLoad: { name: string; count: number }[]
  recentSignups: number
}

export default function AdminAnalyticsScreen() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()
  const [stats, setStats]       = useState<Stats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const [
      { count: totalStudents },
      { count: totalCounselors },
      { count: totalAgents },
      { count: totalConversations },
      { count: totalMessages },
      { count: totalUpdates },
      { count: totalNotifications },
      { data: profiles },
      { data: counselors },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'counselor'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'agent'),
      supabase.from('conversations').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('updates').select('*', { count: 'exact', head: true }),
      supabase.from('notifications').select('*', { count: 'exact', head: true }),
      supabase.from('student_profiles').select('stage'),
      supabase.from('users').select('id, name').in('role', ['counselor', 'agent']),
    ])

    // Stage breakdown
    const stageBreakdown: Record<string, number> = {}
    ;(profiles ?? []).forEach((p: any) => {
      if (p.stage) stageBreakdown[p.stage] = (stageBreakdown[p.stage] ?? 0) + 1
    })

    // Counselor load
    const counselorIds = (counselors ?? []).map((c: any) => c.id)
    const loadCounts: Record<string, number> = {}
    if (counselorIds.length) {
      const { data: convs } = await supabase
        .from('conversations')
        .select('counselor_id, agent_id')
        .or(counselorIds.map((id: string) => `counselor_id.eq.${id},agent_id.eq.${id}`).join(','))
      ;(convs ?? []).forEach((c: any) => {
        const id = c.counselor_id || c.agent_id
        if (id) loadCounts[id] = (loadCounts[id] ?? 0) + 1
      })
    }
    const counselorLoad = (counselors ?? [])
      .map((c: any) => ({ name: c.name, count: loadCounts[c.id] ?? 0 }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 8)

    // Recent signups last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count: recentSignups } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo)

    setStats({
      totalStudents:     totalStudents ?? 0,
      totalCounselors:   totalCounselors ?? 0,
      totalAgents:       totalAgents ?? 0,
      totalConversations: totalConversations ?? 0,
      totalMessages:     totalMessages ?? 0,
      totalUpdates:      totalUpdates ?? 0,
      totalNotifications: totalNotifications ?? 0,
      stageBreakdown,
      counselorLoad,
      recentSignups:     recentSignups ?? 0,
    })
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>
  if (!stats) return null

  const maxStage = Math.max(1, ...STAGES.map(st => stats.stageBreakdown[st.key] ?? 0))
  const maxLoad  = Math.max(1, ...stats.counselorLoad.map(c => c.count))

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.title}>Analytics</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={C.blue} />}
      >
        {/* KPI Grid */}
        <Text style={s.sectionTitle}>Platform Overview</Text>
        <View style={s.kpiGrid}>
          {[
            { label: 'Students',       value: stats.totalStudents,       icon: 'school-outline',       color: C.blue    },
            { label: 'Counselors',     value: stats.totalCounselors,     icon: 'people-outline',       color: '#7C3AED' },
            { label: 'Agents',         value: stats.totalAgents,         icon: 'briefcase-outline',    color: '#059669' },
            { label: 'Conversations',  value: stats.totalConversations,  icon: 'chatbubbles-outline',  color: '#F59E0B' },
            { label: 'Messages',       value: stats.totalMessages,       icon: 'mail-outline',         color: '#EC4899' },
            { label: 'Updates',        value: stats.totalUpdates,        icon: 'newspaper-outline',    color: '#8B5CF6' },
          ].map(kpi => (
            <View key={kpi.label} style={[s.kpiCard, { borderTopColor: kpi.color }]}>
              <View style={[s.kpiIcon, { backgroundColor: kpi.color + '15' }]}>
                <Ionicons name={kpi.icon as any} size={18} color={kpi.color} />
              </View>
              <Text style={s.kpiValue}>{kpi.value.toLocaleString()}</Text>
              <Text style={s.kpiLabel}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        {/* New signups badge */}
        <View style={s.newSignupsCard}>
          <View style={s.newSignupsLeft}>
            <Text style={s.newSignupsNum}>{stats.recentSignups}</Text>
            <Text style={s.newSignupsLabel}>new signups in the last 7 days</Text>
          </View>
          <View style={s.newSignupsBadge}>
            <Ionicons name="trending-up-outline" size={22} color="#059669" />
          </View>
        </View>

        {/* Student Pipeline Funnel */}
        <Text style={s.sectionTitle}>Student Pipeline</Text>
        <View style={s.card}>
          {STAGES.map(st => {
            const count = stats.stageBreakdown[st.key] ?? 0
            const pct   = maxStage ? count / maxStage : 0
            return (
              <View key={st.key} style={s.stageRow}>
                <Text style={s.stageLabel} numberOfLines={1}>{st.label}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${Math.max(pct * 100, count > 0 ? 3 : 0)}%`, backgroundColor: st.color }]} />
                </View>
                <Text style={s.stageCount}>{count}</Text>
              </View>
            )
          })}
        </View>

        {/* Counselor Load */}
        {stats.counselorLoad.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Counselor Load</Text>
            <View style={s.card}>
              {stats.counselorLoad.map(c => {
                const pct = c.count / maxLoad
                return (
                  <View key={c.name} style={s.stageRow}>
                    <Text style={s.stageLabel} numberOfLines={1}>{c.name}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${Math.max(pct * 100, c.count > 0 ? 3 : 0)}%`, backgroundColor: C.blue }]} />
                    </View>
                    <Text style={s.stageCount}>{c.count}</Text>
                  </View>
                )
              })}
            </View>
          </>
        )}

        {/* Comms Stats */}
        <Text style={s.sectionTitle}>Communications</Text>
        <View style={s.commsRow}>
          {[
            { label: 'Avg msgs/conv', value: stats.totalConversations ? (stats.totalMessages / stats.totalConversations).toFixed(1) : '0', icon: 'chatbubble-ellipses-outline', color: '#F59E0B' },
            { label: 'Notifications', value: stats.totalNotifications.toLocaleString(), icon: 'notifications-outline', color: '#EC4899' },
          ].map(c => (
            <View key={c.label} style={[s.commCard, { flex: 1 }]}>
              <Ionicons name={c.icon as any} size={22} color={c.color} />
              <Text style={[s.commValue, { color: c.color }]}>{c.value}</Text>
              <Text style={s.commLabel}>{c.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header:          { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:         { marginRight: 12 },
  title:           { fontSize: 18, fontWeight: '800', color: C.navy },
  sectionTitle:    { fontSize: 11, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 20 },
  kpiGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard:         { width: '31.5%', backgroundColor: C.white, borderRadius: 14, padding: 12, alignItems: 'center', borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  kpiIcon:         { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiValue:        { fontSize: 20, fontWeight: '900', color: C.navy },
  kpiLabel:        { fontSize: 10, fontWeight: '600', color: C.slate400, marginTop: 2, textAlign: 'center' },
  newSignupsCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#BBF7D0' },
  newSignupsLeft:  { flex: 1 },
  newSignupsNum:   { fontSize: 26, fontWeight: '900', color: '#059669' },
  newSignupsLabel: { fontSize: 12, color: '#059669', marginTop: 2 },
  newSignupsBadge: { width: 44, height: 44, backgroundColor: '#DCFCE7', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card:            { backgroundColor: C.white, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  stageRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  stageLabel:      { fontSize: 11, fontWeight: '600', color: C.navy, width: 90 },
  barTrack:        { flex: 1, height: 8, backgroundColor: C.slate100, borderRadius: 4, overflow: 'hidden' },
  barFill:         { height: 8, borderRadius: 4 },
  stageCount:      { fontSize: 11, fontWeight: '700', color: C.navy, width: 24, textAlign: 'right' },
  commsRow:        { flexDirection: 'row', gap: 10 },
  commCard:        { backgroundColor: C.white, borderRadius: 16, padding: 16, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  commValue:       { fontSize: 22, fontWeight: '900', marginTop: 6 },
  commLabel:       { fontSize: 11, color: C.slate400, fontWeight: '600', textAlign: 'center' },
})
