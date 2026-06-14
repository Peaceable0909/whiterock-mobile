import { useEffect, useState, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

const JOURNEY_STAGES = ['lead','application_submitted','offer_received','deposit_paid','cas_requested','cas_issued','visa_submitted','visa_decision']
const STAGE_LABEL: Record<string,string> = { lead:'New Lead', application_submitted:'Applied', offer_received:'Offer', deposit_paid:'Deposit', cas_requested:'CAS Pending', cas_issued:'CAS Issued', visa_submitted:'Visa Submitted', visa_decision:'Visa Decision' }

export default function HomeScreen() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()
  const [user, setUser]           = useState<any>(null)
  const [profile, setProfile]     = useState<any>(null)
  const [agent, setAgent]         = useState<any>(null)
  const [convId, setConvId]       = useState<string|null>(null)
  const [loading, setLoading]     = useState(true)
  const [notifUnread, setNotifUnread] = useState(0)
  const [recentUpdates, setRecentUpdates] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      const { data: dbUser } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      setUser(dbUser)

      const { count } = await supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', authUser.id).eq('is_read', false)
      setNotifUnread(count ?? 0)

      // Fetch 2 most recent updates for the home card
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
    }
    load()

    let uid: string | null = null
    supabase.auth.getUser().then(({ data: { user: u } }) => { uid = u?.id ?? null })
    const sub = supabase.channel('home-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        payload => { if (uid && (payload.new as any).user_id === uid) setNotifUnread(n => n + 1) })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  const BellButton = () => (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TouchableOpacity style={s.bellBtn} accessibilityLabel="Notifications"
        onPress={() => { setNotifUnread(0); router.push('/(main)/notifications' as any) }}>
        <Ionicons name="notifications-outline" size={20} color={C.slate500} />
        {notifUnread > 0 && (
          <View style={s.bellBadge}>
            <Text style={s.bellBadgeText}>{notifUnread > 9 ? '9+' : notifUnread}</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={s.bellBtn} accessibilityLabel="Settings"
        onPress={() => router.push('/(main)/settings' as any)}>
        <Ionicons name="settings-outline" size={20} color={C.slate500} />
      </TouchableOpacity>
    </View>
  )

  if (loading) return <View style={[s.center, { paddingTop: insets.top }]}><ActivityIndicator color={C.blue} size="large" /></View>

  const isStudent = user?.role === 'student'
  const stageIdx  = profile ? Math.max(JOURNEY_STAGES.indexOf(profile.stage), 0) : 0
  const pct       = Math.round((stageIdx / (JOURNEY_STAGES.length - 1)) * 100)
  const firstName = (user?.name ?? 'User').split(' ')[0]
  const nextStage = JOURNEY_STAGES[stageIdx + 1]

  const progressAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: pct / 100,
      duration: 900,
      useNativeDriver: false,
    }).start()
  }, [pct])

  if (isStudent) return (
    <ScrollView style={s.bg} contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]} showsVerticalScrollIndicator={false}>
      {/* Greeting */}
      <View style={[s.pt, { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>Dashboard Overview</Text>
          <Text style={s.heading}>Welcome back, {firstName}.</Text>
        </View>
        <BellButton />
      </View>

      {/* Visa outcome celebration banner */}
      {(profile?.visa_outcome === 'approved' || profile?.visa_outcome === 'granted') && (
        <View style={s.visaBanner}>
          <Text style={s.visaEmoji}>🎉</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.visaBannerTitle}>Visa Approved!</Text>
            <Text style={s.visaBannerSub}>Congratulations {firstName} — your UK visa has been granted. Your journey begins!</Text>
          </View>
        </View>
      )}

      {/* Progress card */}
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.iconCircle}><Ionicons name="document-text-outline" size={20} color={C.blue} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.cardTitle}>My Application</Text>
            <Text style={s.cardSub}>Overall Progress</Text>
          </View>
          <Text style={s.bigPct}>{pct}%</Text>
        </View>
        <View style={s.barBg}>
          <Animated.View style={[s.barFg, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
        <Text style={s.nextStep}>Next: <Text style={s.nextStepBold}>{STAGE_LABEL[nextStage] ?? 'Visa Decision'}</Text></Text>
        <TouchableOpacity style={s.btn} onPress={() => router.push('/(main)/documents' as any)}>
          <Text style={s.btnText}>View Documents</Text>
        </TouchableOpacity>
      </View>

      {/* Assigned agent */}
      <View style={s.card}>
        <View style={[s.row, { marginBottom: 14 }]}>
          <View style={s.iconCircle}><Ionicons name="chatbubble-outline" size={18} color={C.blue} /></View>
          <Text style={[s.cardTitle, { marginLeft: 10, flex: 1 }]}>My Assigned Agent</Text>
          {agent?.is_online
            ? <View style={s.onlineBadge}><View style={s.dot} /><Text style={s.onlineText}>ONLINE</Text></View>
            : <View style={[s.onlineBadge, { backgroundColor: C.slate100, borderColor: C.slate200 }]}>
                <View style={[s.dot, { backgroundColor: C.slate400 }]} />
                <Text style={[s.onlineText, { color: C.slate500 }]}>OFFLINE</Text>
              </View>}
        </View>
        {agent ? (
          <>
            <View style={s.agentRow}>
              <View style={s.avatar}><Text style={s.avatarText}>{agent.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</Text></View>
              <View>
                <Text style={s.agentName}>{agent.name}</Text>
                <Text style={s.agentRole}>{agent.role === 'counselor' ? 'Senior Counselor' : agent.role === 'admin' ? 'Administrator' : 'Visa Agent'}</Text>
              </View>
            </View>
            {convId && (
              <TouchableOpacity style={s.btn} onPress={() => router.push(`/(main)/messages/${convId}`)}>
                <Ionicons name="chatbubble-outline" size={16} color={C.white} />
                <Text style={[s.btnText, { marginLeft: 6 }]}>Message</Text>
              </TouchableOpacity>
            )}
          </>
        ) : <Text style={s.cardSub}>An agent will be assigned to you shortly.</Text>}
      </View>

      {/* 2-col grid */}
      <View style={s.grid}>
        <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(main)/appointments' as any)}>
          <Ionicons name="calendar-outline" size={20} color={C.blue} />
          <Text style={s.gridLabel}>Appointments</Text>
          <Text style={s.gridTitle}>Upcoming Sessions</Text>
          <View style={s.gridBtn}><Text style={s.gridBtnText}>View Calendar</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(main)/documents' as any)}>
          <Ionicons name="folder-outline" size={20} color={C.blue} />
          <Text style={s.gridLabel}>Digital Vault</Text>
          <Text style={s.gridTitle}>My Documents</Text>
          <View style={s.gridBtn}><Text style={s.gridBtnText}>Open Vault</Text></View>
        </TouchableOpacity>
      </View>
      <View style={[s.grid, { marginTop: 0 }]}>
        <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(main)/ai')}>
          <Ionicons name="hardware-chip-outline" size={20} color={C.blue} />
          <Text style={s.gridLabel}>AI Assistant</Text>
          <Text style={s.gridSub}>Ask anything about visa laws...</Text>
          <View style={s.gridBtn}><Text style={s.gridBtnText}>Open AI</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(main)/updates')}>
          <Ionicons name="newspaper-outline" size={20} color={C.blue} />
          <Text style={s.gridLabel}>Updates</Text>
          <Text style={s.gridSub}>Latest news & announcements</Text>
          <View style={s.gridBtn}><Text style={s.gridBtnText}>Read News</Text></View>
        </TouchableOpacity>
      </View>

      {/* Recent updates from DB */}
      <View style={s.card}>
        <View style={[s.row, { marginBottom: 12 }]}>
          <Text style={s.overline}>Recent Updates</Text>
        </View>
        {recentUpdates.length > 0
          ? recentUpdates.map((item, i) => (
              <TouchableOpacity key={item.id} style={[s.updateRow, i > 0 && { marginTop: 12 }]}
                onPress={() => router.push('/(main)/updates')}>
                <View style={[s.updateBar, { backgroundColor: i === 0 ? C.blue : C.slate200 }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.updateTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.updateSub}>{(item.category ?? 'update').replace('_', ' ')}</Text>
                </View>
              </TouchableOpacity>
            ))
          : (
              <View style={[s.updateRow]}>
                <View style={[s.updateBar, { backgroundColor: C.blue }]} />
                <View>
                  <Text style={s.updateTitle}>Application Stage Updated</Text>
                  <Text style={s.updateSub}>Stage: {STAGE_LABEL[profile?.stage] ?? 'Lead'}</Text>
                </View>
              </View>
            )}
        <TouchableOpacity style={s.viewAll} onPress={() => router.push('/(main)/updates')}>
          <Text style={s.viewAllText}>View all updates</Text>
          <Ionicons name="chevron-forward" size={14} color={C.blue} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  )

  // Staff home
  return (
    <ScrollView style={s.bg} contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]} showsVerticalScrollIndicator={false}>
      <View style={[s.pt, { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>Dashboard Overview</Text>
          <Text style={s.heading}>Good morning, {firstName}.</Text>
        </View>
        <BellButton />
      </View>

      {/* Real stats */}
      <StaffStats userId={user?.id} />

      <View style={s.grid}>
        {([
          { label: 'Messages', iconName: 'chatbubble-outline',    route: '/(main)/messages' as const },
          { label: 'Students', iconName: 'people-outline',        route: '/(main)/students' as const },
          { label: 'AI Tools', iconName: 'hardware-chip-outline', route: '/(main)/ai' as const },
          { label: 'Updates',  iconName: 'newspaper-outline',     route: '/(main)/updates' as const },
        ] as const).map(({ label, iconName, route }) => (
          <TouchableOpacity key={label} style={s.gridCard} onPress={() => router.push(route)}>
            <Ionicons name={iconName} size={22} color={C.blue} />
            <Text style={[s.gridLabel, { marginTop: 8 }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={s.logoutRow} onPress={async () => {
        await supabase.auth.signOut()
      }}>
        <Ionicons name="log-out-outline" size={18} color={C.slate400} />
        <Text style={s.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function StaffStats({ userId }: { userId?: string }) {
  const [stats, setStats] = useState({ students: 0, active: 0, pendingDocs: 0 })
  useEffect(() => {
    if (!userId) return
    const load = async () => {
      const [{ data: convs }, { data: docs }] = await Promise.all([
        supabase.from('conversations')
          .select('id, student_id, last_message_at')
          .or(`counselor_id.eq.${userId},agent_id.eq.${userId}`),
        supabase.from('documents').select('id, status, student_id'),
      ])
      const studentIds = [...new Set((convs ?? []).map((c: any) => c.student_id))]
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const active = (convs ?? []).filter((c: any) => c.last_message_at && c.last_message_at > sevenDaysAgo).length
      const pending = (docs ?? []).filter((d: any) => d.status === 'pending' && studentIds.includes(d.student_id)).length
      setStats({ students: studentIds.length, active, pendingDocs: pending })
    }
    load()
  }, [userId])

  const items = [
    { label: 'Students', val: stats.students, color: C.blue },
    { label: 'Active',   val: stats.active,   color: '#059669' },
    { label: 'Pending Docs', val: stats.pendingDocs, color: stats.pendingDocs > 0 ? '#F59E0B' : C.slate400 },
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

const ss = StyleSheet.create({
  statsCard:  { flexDirection: 'row', backgroundColor: C.white, borderRadius: 20, paddingVertical: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statItem:   { flex: 1, alignItems: 'center' },
  statBorder: { borderRightWidth: 1, borderColor: C.slate100 },
  statNum:    { fontSize: 28, fontWeight: '900' },
  statLabel:  { fontSize: 11, color: C.slate400, fontWeight: '600', marginTop: 2 },
})

const s = StyleSheet.create({
  bg:          { flex: 1, backgroundColor: C.bg },
  bellBtn:     { width: 44, height: 44, borderRadius: 14, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  bellBadge:   { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  bellBadgeText:{ fontSize: 9, fontWeight: '800', color: C.white },
  content:     { padding: 16, paddingBottom: 32 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  pt:          { paddingTop: 8, marginBottom: 16 },
  overline:    { fontSize: 11, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1.5 },
  heading:     { fontSize: 22, fontWeight: '800', color: C.navy, marginTop: 2 },
  card:        { backgroundColor: C.white, borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  row:         { flexDirection: 'row', alignItems: 'center' },
  iconCircle:  { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: C.navy },
  cardSub:     { fontSize: 12, color: C.slate400, marginTop: 2 },
  bigPct:      { fontSize: 28, fontWeight: '900', color: C.blue },
  barBg:       { height: 8, backgroundColor: C.slate100, borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  barFg:       { height: 8, backgroundColor: C.blue, borderRadius: 4 },
  nextStep:    { fontSize: 12, color: C.slate400, marginTop: 6, marginBottom: 14 },
  nextStepBold:{ fontWeight: '600', color: C.slate600 },
  btn:         { height: 44, backgroundColor: C.blue, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  btnText:     { color: C.white, fontWeight: '700', fontSize: 14 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#BBF7D0' },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 4 },
  onlineText:  { fontSize: 9, fontWeight: '700', color: '#15803D' },
  agentRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar:      { width: 48, height: 48, borderRadius: 24, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText:  { color: C.white, fontWeight: '700', fontSize: 16 },
  agentName:   { fontSize: 15, fontWeight: '700', color: C.navy },
  agentRole:   { fontSize: 12, color: C.slate500 },
  grid:        { flexDirection: 'row', gap: 12, marginBottom: 14 },
  gridCard:    { flex: 1, backgroundColor: C.white, borderRadius: 18, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  gridLabel:   { fontSize: 10, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1, marginTop: 10 },
  gridTitle:   { fontSize: 13, fontWeight: '700', color: C.navy, marginTop: 2 },
  gridSub:     { fontSize: 11, color: C.slate400, marginTop: 2, lineHeight: 16 },
  gridBtn:     { marginTop: 10, height: 32, backgroundColor: C.blue, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  gridBtnText: { fontSize: 11, fontWeight: '700', color: C.white },
  updateRow:   { flexDirection: 'row', alignItems: 'flex-start' },
  updateBar:   { width: 3, height: '100%', borderRadius: 2, marginRight: 10, minHeight: 36 },
  updateTitle: { fontSize: 13, fontWeight: '700', color: C.navy },
  updateSub:   { fontSize: 12, color: C.slate400, marginTop: 2 },
  viewAll:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  viewAllText: { fontSize: 12, fontWeight: '700', color: C.blue, marginRight: 2 },
  logoutRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, marginTop: 4 },
  logoutText:    { fontSize: 14, fontWeight: '600', color: C.slate400 },
  visaBanner:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ECFDF5', borderWidth: 1.5, borderColor: '#6EE7B7', borderRadius: 20, padding: 16, marginBottom: 14 },
  visaEmoji:     { fontSize: 28 },
  visaBannerTitle: { fontSize: 15, fontWeight: '800', color: '#065F46', marginBottom: 3 },
  visaBannerSub:   { fontSize: 12, color: '#059669', lineHeight: 17 },
})
