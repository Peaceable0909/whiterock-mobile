import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

const STAGES = ['lead','application_submitted','offer_received','deposit_paid','cas_requested','cas_issued','visa_submitted','visa_decision']
const STAGE_LABEL: Record<string,string> = {
  lead:'Lead', application_submitted:'Applied', offer_received:'Offer',
  deposit_paid:'Deposit', cas_requested:'CAS Pend.', cas_issued:'CAS Issued',
  visa_submitted:'Visa Sub.', visa_decision:'Decided',
}

const ACTIONS = [
  { label: 'Users',     icon: 'people-outline',    route: '/(admin)/users/index',   color: C.blue },
  { label: 'Invites',   icon: 'ticket-outline',    route: '/(admin)/invites/index', color: '#7C3AED' },
  { label: 'Assign',    icon: 'git-merge-outline', route: '/(admin)/assign',        color: '#0891B2' },
  { label: 'Broadcast', icon: 'megaphone-outline', route: '/(admin)/broadcast',     color: '#059669' },
  { label: 'Analytics', icon: 'bar-chart-outline', route: '/(admin)/analytics',     color: '#D97706' },
  { label: 'Post',      icon: 'create-outline',    route: '/(main)/update-compose', color: '#BE185D' },
] as const

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats]       = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const [
      { count: totalStudents },
      { count: totalCounselors },
      { count: totalAgents },
      { count: pendingInvites },
      { data: stageData },
    ] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'counselor'),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'agent'),
      supabase.from('invite_codes')
        .select('id', { count: 'exact', head: true })
        .is('used_by', null)
        .gt('expires_at', new Date().toISOString()),
      supabase.from('student_profiles').select('stage'),
    ])

    const stageCounts: Record<string, number> = {}
    STAGES.forEach(s => { stageCounts[s] = 0 })
    ;(stageData ?? []).forEach((p: any) => {
      if (p.stage && stageCounts[p.stage] !== undefined) stageCounts[p.stage]++
    })

    setStats({ totalStudents: totalStudents ?? 0, totalCounselors: totalCounselors ?? 0, totalAgents: totalAgents ?? 0, pendingInvites: pendingInvites ?? 0, stageCounts })
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>

  const maxStage = Math.max(...Object.values(stats.stageCounts as Record<string, number>), 1)

  return (
    <ScrollView
      style={s.bg}
      contentContainerStyle={{ padding: 16, paddingTop: 56, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={C.blue} />}
    >
      <Text style={s.overline}>Admin Console</Text>
      <Text style={s.heading}>WhiteRock Connect</Text>

      {/* Summary stats */}
      <View style={s.statsRow}>
        {[
          { label: 'Students',   val: stats.totalStudents,   color: C.blue },
          { label: 'Counselors', val: stats.totalCounselors, color: '#7C3AED' },
          { label: 'Agents',     val: stats.totalAgents,     color: '#059669' },
          { label: 'Open Codes', val: stats.pendingInvites,  color: '#D97706' },
        ].map(st => (
          <View key={st.label} style={[s.statCard, { borderTopColor: st.color }]}>
            <Text style={[s.statVal, { color: st.color }]}>{st.val}</Text>
            <Text style={s.statLabel}>{st.label}</Text>
          </View>
        ))}
      </View>

      {/* Quick actions */}
      <Text style={s.sectionTitle}>Admin Actions</Text>
      <View style={s.actionsGrid}>
        {ACTIONS.map(a => (
          <TouchableOpacity key={a.label} style={s.actionCard} onPress={() => router.push(a.route as any)}>
            <View style={[s.actionIcon, { backgroundColor: a.color + '18' }]}>
              <Ionicons name={a.icon as any} size={22} color={a.color} />
            </View>
            <Text style={s.actionLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Application pipeline */}
      <Text style={s.sectionTitle}>Application Pipeline</Text>
      <View style={s.card}>
        {STAGES.map(stage => (
          <View key={stage} style={s.stageRow}>
            <Text style={s.stageName}>{STAGE_LABEL[stage]}</Text>
            <View style={s.stageBarBg}>
              <View style={[s.stageBarFg, {
                width: `${Math.max((stats.stageCounts[stage] / maxStage) * 100, stats.stageCounts[stage] > 0 ? 5 : 0)}%` as any,
              }]} />
            </View>
            <Text style={s.stageCount}>{stats.stageCounts[stage]}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={s.logoutBtn} onPress={() => supabase.auth.signOut()}>
        <Ionicons name="log-out-outline" size={16} color={C.red500} />
        <Text style={s.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  bg:          { flex: 1, backgroundColor: C.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  overline:    { fontSize: 11, fontWeight: '700', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 },
  heading:     { fontSize: 24, fontWeight: '900', color: C.navy, marginBottom: 20 },
  sectionTitle:{ fontSize: 11, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 20 },
  statsRow:    { flexDirection: 'row', gap: 8 },
  statCard:    { flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 12, alignItems: 'center', borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  statVal:     { fontSize: 22, fontWeight: '900', lineHeight: 26 },
  statLabel:   { fontSize: 9, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2, textAlign: 'center' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard:  { width: '30%', backgroundColor: C.white, borderRadius: 16, padding: 14, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  actionIcon:  { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '700', color: C.navy, textAlign: 'center' },
  card:        { backgroundColor: C.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  stageRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  stageName:   { fontSize: 10, fontWeight: '700', color: C.slate500, width: 66, textAlign: 'right' },
  stageBarBg:  { flex: 1, height: 8, backgroundColor: C.slate100, borderRadius: 4, overflow: 'hidden' },
  stageBarFg:  { height: 8, backgroundColor: C.blue, borderRadius: 4 },
  stageCount:  { fontSize: 11, fontWeight: '700', color: C.navy, width: 22, textAlign: 'right' },
  logoutBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 32, padding: 14 },
  logoutText:  { fontSize: 14, fontWeight: '700', color: C.red500 },
})
