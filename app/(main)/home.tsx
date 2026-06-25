import { useEffect, useState, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Image, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'

const JOURNEY_STAGES = ['lead','application_submitted','offer_received','deposit_paid','cas_requested','cas_issued','visa_submitted','visa_decision']
const STAGE_LABEL: Record<string,string> = { lead:'New Lead', application_submitted:'Applied', offer_received:'Offer', deposit_paid:'Deposit', cas_requested:'CAS Pending', cas_issued:'CAS Issued', visa_submitted:'Visa Submitted', visa_decision:'Visa Decision' }

export default function HomeScreen() {
  const C = useColors()
  const s = mkS(C)
  const router  = useRouter()
  const insets  = useSafeAreaInsets()
  const [user, setUser]           = useState<any>(null)
  const [profile, setProfile]     = useState<any>(null)
  const [agent, setAgent]         = useState<any>(null)
  const [convId, setConvId]       = useState<string|null>(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [notifUnread, setNotifUnread] = useState(0)
  const [recentUpdates, setRecentUpdates] = useState<any[]>([])

  const load = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return
    const { data: dbUser } = await supabase.from('users').select('*').eq('id', authUser.id).single()
    setUser(dbUser)

    const { count } = await supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', authUser.id).eq('is_read', false)
    setNotifUnread(count ?? 0)

    const { data: updatesData } = await supabase.from('updates')
      .select('id, title, category, created_at')
      .order('created_at', { ascending: false })
      .limit(2)
    setRecentUpdates(updatesData ?? [])

    if (dbUser?.role === 'student') {
      const { data: prof } = await supabase.from('student_profiles').select('*').eq('user_id', authUser.id).single()
      setProfile(prof)
      const { data: conv } = await supabase.from('conversations')
        .select('id, agent_id, counselor_id')
        .eq('student_id', authUser.id)
        .order('created_at', { ascending: true })
        .limit(1).maybeSingle()
      if (conv) {
        setConvId(conv.id)
        const staffId = conv.agent_id || conv.counselor_id
        if (staffId) {
          const { data: staffUser } = await supabase.from('users').select('*').eq('id', staffId).single()
          setAgent(staffUser)
        }
      }
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    load()
    let uid: string | null = null
    supabase.auth.getUser().then(({ data: { user: u } }) => { uid = u?.id ?? null })
    const sub = supabase.channel('home-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        payload => { if (uid && (payload.new as any).user_id === uid) setNotifUnread(n => n + 1) })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    load()
  }

  const isStudent  = user?.role === 'student'
  const isAgent    = user?.role === 'agent'
  const stageIdx   = profile ? Math.max(JOURNEY_STAGES.indexOf(profile.stage), 0) : 0
  const progress   = profile ? ((stageIdx + 1) / JOURNEY_STAGES.length) * 100 : 0

  if (loading) return (
    <View style={s.bg}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View style={{ flex: 1 }}><Skeleton width={120} height={20} /></View>
        <Skeleton width={44} height={44} radius={14} />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <SkeletonCard height={120} marginBottom={14} />
        <SkeletonCard height={180} marginBottom={14} />
        <SkeletonCard height={100} />
      </ScrollView>
    </View>
  )

  return (
    <View style={s.bg}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>{(user?.role ?? 'Student').toUpperCase()}</Text>
          <Text style={s.heading}>Welcome, {user?.name?.split(' ')[0] ?? 'User'}</Text>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.bellBtn} onPress={() => { setNotifUnread(0); router.push('/(main)/notifications') }}>
            <Ionicons name="notifications-outline" size={20} color={C.slate500} />
            {notifUnread > 0 && (
              <View style={s.bellBadge}>
                <Text style={s.bellBadgeText}>{notifUnread > 9 ? '9+' : notifUnread}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.avatarBtn} onPress={() => router.push('/(main)/more')}>
            {user?.avatar_url
              ? <Image source={{ uri: user.avatar_url }} style={s.headerAvatar} />
              : <View style={s.headerAvatarFallback}>
                  <Text style={s.headerAvatarText}>{(user?.name ?? 'U')[0].toUpperCase()}</Text>
                </View>
            }
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
      >
        {isAgent && <AiBriefing userId={user?.id} firstName={user?.name?.split(' ')[0]} />}
        {isAgent && <AgentPipeline userId={user?.id} />}

        {isStudent && profile && (
          <>
            <Text style={s.sectionLabel}>YOUR JOURNEY</Text>
            <View style={s.card}>
              <View style={s.row}>
                <View style={s.iconCircle}>
                  <Ionicons name="school-outline" size={20} color={C.blue} />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={s.cardTitle}>{STAGE_LABEL[profile.stage] ?? 'Application Active'}</Text>
                  <Text style={s.cardSub}>{profile.school || 'University Placement'}</Text>
                </View>
                <Text style={s.bigPct}>{Math.round(progress)}%</Text>
              </View>
              <View style={s.barBg}><View style={[s.barFg, { width: progress + '%' }]} /></View>
              <Text style={s.nextStep}>Next: <Text style={s.nextStepBold}>{JOURNEY_STAGES[stageIdx + 1] ? STAGE_LABEL[JOURNEY_STAGES[stageIdx + 1]] : 'Final Decision'}</Text></Text>
              <TouchableOpacity style={s.btn} onPress={() => router.push('/(main)/my-profile')}>
                <Text style={s.btnText}>View Journey Details</Text>
                <Ionicons name="chevron-forward" size={16} color="#fff" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {isStudent && agent && (
          <>
            <Text style={s.sectionLabel}>ASSIGNED AGENT</Text>
            <View style={s.card}>
              <View style={s.agentRow}>
                <View style={s.agentAvatar}>
                  <Text style={s.agentAvatarText}>{agent.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.agentName}>{agent.name}</Text>
                  <Text style={s.agentRole}>Senior Educational Consultant</Text>
                </View>
                <View style={s.onlineBadge}>
                  <View style={s.dot} />
                  <Text style={s.onlineText}>ONLINE</Text>
                </View>
              </View>
              <TouchableOpacity style={s.btn} onPress={() => convId && router.push(`/(main)/messages/${convId}`)}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={s.btnText}>Message Agent</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text style={s.sectionLabel}>QUICK ACCESS</Text>
        <View style={s.grid}>
          <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(main)/resources')}>
            <View style={[s.iconCircle, { backgroundColor: '#F0F9FF' }]}>
              <Ionicons name="library-outline" size={18} color="#0369A1" />
            </View>
            <Text style={s.gridLabel}>LIBRARY</Text>
            <Text style={s.gridTitle}>Resources</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(main)/documents')}>
            <View style={[s.iconCircle, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="document-text-outline" size={18} color="#15803D" />
            </View>
            <Text style={s.gridLabel}>FILES</Text>
            <Text style={s.gridTitle}>Documents</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionLabel}>LATEST UPDATES</Text>
        <View style={s.card}>
          {recentUpdates.length > 0 ? (
            recentUpdates.map((u, i) => (
              <TouchableOpacity key={u.id} style={[s.updateRow, i < recentUpdates.length - 1 && { marginBottom: 16 }]} onPress={() => router.push('/(main)/updates')}>
                <View style={[s.updateBar, { backgroundColor: u.category === 'visa' ? C.green400 : C.blue }]} />
                <View>
                  <Text style={s.updateTitle} numberOfLines={1}>{u.title}</Text>
                  <Text style={s.updateSub}>{new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {u.category}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={s.updateSub}>No recent updates</Text>
          )}
          <TouchableOpacity style={s.viewAll} onPress={() => router.push('/(main)/updates')}>
            <Text style={s.viewAllText}>View All Updates</Text>
            <Ionicons name="arrow-forward" size={14} color={C.blue} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

function AiBriefing({ userId, firstName }: { userId?: string, firstName?: string }) {
  const C = useColors()
  const [brief, setBrief] = useState('')
  const [displayed, setDisplayed] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!userId) return
    const go = async () => {
      const { count: total } = await supabase.from('student_profiles').select('id', { count: 'exact', head: true })
      const { data: activeConvs } = await supabase.from('conversations').select('id').gt('updated_at', new Date(Date.now() - 7*24*60*60*1000).toISOString())
      const { count: pending } = await supabase.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'pending')

      const h = new Date().getHours()
      const g = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
      let t = "Good " + g + ", " + firstName + ". "
      if (total)               t += total + " student" + (total !== 1 ? "s" : "") + " in your pipeline. "
      if (activeConvs?.length) t += activeConvs.length + " active conversation" + (activeConvs.length !== 1 ? "s" : "") + " this week. "
      if ((pending ?? 0) > 0)  t += "⚠ " + pending + " document" + (pending !== 1 ? "s" : "") + " pending review."
      else                     t += 'All documents are up to date.'
      setBrief(t)
    }
    go()
  }, [userId, firstName])

  useEffect(() => {
    if (!brief) return
    setDisplayed('')
    let i = 0
    timerRef.current = setInterval(() => {
      setDisplayed(brief.slice(0, ++i))
      if (i >= brief.length) { clearInterval(timerRef.current!); timerRef.current = null }
    }, 18)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [brief])

  if (!brief) return null
  const typing = displayed.length < brief.length
  return (
    <View style={{ backgroundColor: C.navy, borderRadius: 20, padding: 18, marginBottom: 20, shadowColor: C.navy, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sparkles-outline" size={13} color="#60A5FA" />
        </View>
        <Text style={{ fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, textTransform: 'uppercase' }}>AI Briefing</Text>
        {typing && (
          <View style={{ backgroundColor: C.blue, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 2 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: C.white, letterSpacing: 0.5 }}>LIVE</Text>
          </View>
        )}
      </View>
      <Text style={{ fontSize: 14, color: C.white, lineHeight: 22, fontWeight: '500' }}>
        {displayed}<Text style={{ color: typing ? 'rgba(255,255,255,0.6)' : 'transparent' }}>▌</Text>
      </Text>
    </View>
  )
}

function AgentPipeline({ userId }: { userId?: string }) {
  const C = useColors()
  const [stats, setStats] = useState({ leads: 0, inProgress: 0, converted: 0, total: 0 })

  useEffect(() => {
    if (!userId) return
    const load = async () => {
      const { data: convs } = await supabase
        .from('conversations').select('student_id').eq('agent_id', userId)
      if (!convs?.length) return
      const ids = convs.map((c: any) => c.student_id)
      const { data: profiles } = await supabase
        .from('student_profiles').select('stage').in('user_id', ids)
      const p = profiles ?? []
      setStats({
        total:      p.length,
        leads:      p.filter(x => ['lead','application_submitted'].includes(x.stage)).length,
        inProgress: p.filter(x => ['offer_received','deposit_paid','cas_requested','cas_issued','visa_submitted'].includes(x.stage)).length,
        converted:  p.filter(x => x.stage === 'visa_decision').length,
      })
    }
    load()
  }, [userId])

  const ss = mkSS(C)
  const items = [
    { label: 'Leads',       val: stats.leads,      color: C.blue },
    { label: 'In Progress', val: stats.inProgress, color: '#7C3AED' },
    { label: 'Converted',   val: stats.converted,  color: '#059669' },
  ]
  return (
    <View style={ss.statsCard}>
      {items.map((item, i) => (
        <View key={item.label} style={[ss.statItem, i < items.length - 1 && ss.statBorder]}>
          <Text style={[ss.statNum, { color: item.color }]}>{item.val}</Text>
          <Text style={ss.statLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}

const mkSS = (C: ColorPalette) => StyleSheet.create({
  statsCard:  { flexDirection: 'row', backgroundColor: C.white, borderRadius: 20, paddingVertical: 18, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statItem:   { flex: 1, alignItems: 'center' },
  statBorder: { borderRightWidth: 1, borderColor: C.slate100 },
  statNum:    { fontSize: 28, fontWeight: '900' },
  statLabel:  { fontSize: 11, color: C.slate400, fontWeight: '600', marginTop: 2 },
})

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:               { flex: 1, backgroundColor: C.bg },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  headerActions:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  content:          { padding: 20, paddingBottom: 40 },
  overline:         { fontSize: 10, fontWeight: '800', color: C.blue, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 },
  heading:          { fontSize: 22, fontWeight: '800', color: C.navy },
  bellBtn:          { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  bellBadge:        { position: 'absolute', top: 8, right: 8, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: C.red500, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.white },
  bellBadgeText:    { fontSize: 8, fontWeight: '900', color: C.white },
  avatarBtn:        { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: C.slate100 },
  headerAvatar:     { width: 40, height: 40 },
  headerAvatarFallback: { width: 40, height: 40, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontSize: 15, fontWeight: '800', color: C.white },
  sectionLabel:     { fontSize: 10, fontWeight: '800', color: C.slate400, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 4, paddingHorizontal: 4 },
  card:             { backgroundColor: C.white, borderRadius: 24, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  row:              { flexDirection: 'row', alignItems: 'center' },
  iconCircle:       { width: 44, height: 44, borderRadius: 14, backgroundColor: C.blue + '14', alignItems: 'center', justifyContent: 'center' },
  cardTitle:        { fontSize: 16, fontWeight: '700', color: C.navy },
  cardSub:          { fontSize: 12, color: C.slate500, marginTop: 2 },
  bigPct:           { fontSize: 26, fontWeight: '900', color: C.blue },
  barBg:            { height: 8, backgroundColor: C.slate100, borderRadius: 4, marginTop: 16, overflow: 'hidden' },
  barFg:            { height: 8, backgroundColor: C.blue, borderRadius: 4 },
  nextStep:         { fontSize: 12, color: C.slate400, marginTop: 12, marginBottom: 16 },
  nextStepBold:     { fontWeight: '700', color: C.slate600 },
  btn:              { height: 48, backgroundColor: C.blue, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: C.blue, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  btnText:          { color: C.white, fontWeight: '700', fontSize: 14 },
  onlineBadge:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#DCFCE7' },
  dot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 5 },
  onlineText:       { fontSize: 9, fontWeight: '800', color: '#16A34A' },
  agentRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  agentAvatar:      { width: 52, height: 52, borderRadius: 26, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  agentAvatarText:  { color: C.white, fontWeight: '800', fontSize: 18 },
  agentName:        { fontSize: 16, fontWeight: '700', color: C.navy },
  agentRole:        { fontSize: 12, color: C.slate500, marginTop: 1 },
  grid:             { flexDirection: 'row', gap: 14, marginBottom: 24 },
  gridCard:         { flex: 1, backgroundColor: C.white, borderRadius: 22, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  gridLabel:        { fontSize: 9, fontWeight: '800', color: C.slate400, letterSpacing: 1, marginBottom: 2, marginTop: 12 },
  gridTitle:        { fontSize: 14, fontWeight: '700', color: C.navy },
  updateRow:        { flexDirection: 'row', alignItems: 'center' },
  updateBar:        { width: 4, height: 32, borderRadius: 2, marginRight: 12 },
  updateTitle:      { fontSize: 14, fontWeight: '700', color: C.navy },
  updateSub:        { fontSize: 11, color: C.slate400, marginTop: 2 },
  viewAll:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, borderTopWidth: 1, borderColor: C.slate100, paddingTop: 16 },
  viewAllText:      { fontSize: 13, fontWeight: '700', color: C.blue, marginRight: 4 },
})
