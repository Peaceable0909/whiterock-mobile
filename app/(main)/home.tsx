import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { FileText, MessageCircle, Bot, Calendar, ChevronRight, Bell } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

const JOURNEY_STAGES = ['lead','application_submitted','offer_received','deposit_paid','cas_requested','cas_issued','visa_submitted','visa_decision']
const STAGE_LABEL: Record<string,string> = { lead:'New Lead', application_submitted:'Applied', offer_received:'Offer', deposit_paid:'Deposit', cas_requested:'CAS Pending', cas_issued:'CAS Issued', visa_submitted:'Visa Submitted', visa_decision:'Visa Decision' }

export default function HomeScreen() {
  const router  = useRouter()
  const [user, setUser]     = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [agent, setAgent]   = useState<any>(null)
  const [convId, setConvId] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [notifUnread, setNotifUnread] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      const { data: dbUser } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      setUser(dbUser)

      // live notification badge
      const { count } = await supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', authUser.id).eq('is_read', false)
      setNotifUnread(count ?? 0)

      if (dbUser?.role === 'student') {
        const { data: prof } = await supabase.from('student_profiles').select('*').eq('user_id', authUser.id).single()
        setProfile(prof)
        // earliest thread = the agent thread (students may have extra staff threads now)
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

    // bell badge updates live
    let uid: string | null = null
    supabase.auth.getUser().then(({ data: { user: u } }) => { uid = u?.id ?? null })
    const sub = supabase.channel('home-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        payload => { if (uid && (payload.new as any).user_id === uid) setNotifUnread(n => n + 1) })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  const BellButton = () => (
    <TouchableOpacity style={s.bellBtn} accessibilityLabel="Notifications"
      onPress={() => { setNotifUnread(0); router.push('/(main)/notifications' as any) }}>
      <Bell size={20} color={C.slate500} />
      {notifUnread > 0 && (
        <View style={s.bellBadge}>
          <Text style={s.bellBadgeText}>{notifUnread > 9 ? '9+' : notifUnread}</Text>
        </View>
      )}
    </TouchableOpacity>
  )

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>

  const isStudent = user?.role === 'student'
  const stageIdx  = profile ? (JOURNEY_STAGES.indexOf(profile.stage) ?? 0) : 0
  const pct       = Math.round((stageIdx / (JOURNEY_STAGES.length - 1)) * 100)
  const firstName = (user?.name ?? 'User').split(' ')[0]
  const nextStage = JOURNEY_STAGES[stageIdx + 1]

  if (isStudent) return (
    <ScrollView style={s.bg} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {/* Greeting */}
      <View style={[s.pt, { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>Dashboard Overview</Text>
          <Text style={s.heading}>Welcome back, {firstName}.</Text>
        </View>
        <BellButton />
      </View>

      {/* Progress card */}
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.iconCircle}><FileText size={20} color={C.blue} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.cardTitle}>My Application</Text>
            <Text style={s.cardSub}>Overall Progress</Text>
          </View>
          <Text style={s.bigPct}>{pct}%</Text>
        </View>
        <View style={s.barBg}><View style={[s.barFg, { width: `${Math.max(pct, 4)}%` as any }]} /></View>
        <Text style={s.nextStep}>Next: <Text style={s.nextStepBold}>{STAGE_LABEL[nextStage] ?? 'Visa Decision'}</Text></Text>
        <TouchableOpacity style={s.btn}><Text style={s.btnText}>View Progress</Text></TouchableOpacity>
      </View>

      {/* Assigned agent */}
      <View style={s.card}>
        <View style={[s.row, { marginBottom: 14 }]}>
          <View style={s.iconCircle}><MessageCircle size={18} color={C.blue} /></View>
          <Text style={[s.cardTitle, { marginLeft: 10, flex: 1 }]}>My Assigned Agent</Text>
          <View style={s.onlineBadge}><View style={s.dot} /><Text style={s.onlineText}>ONLINE</Text></View>
        </View>
        {agent ? (
          <>
            <View style={s.agentRow}>
              <View style={s.avatar}><Text style={s.avatarText}>{agent.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</Text></View>
              <View>
                <Text style={s.agentName}>{agent.name}</Text>
                <Text style={s.agentRole}>Senior Visa Consultant</Text>
              </View>
            </View>
            {convId && (
              <TouchableOpacity style={s.btn} onPress={() => router.push(`/(main)/messages/${convId}`)}>
                <MessageCircle size={16} color={C.white} />
                <Text style={[s.btnText, { marginLeft: 6 }]}>Message</Text>
              </TouchableOpacity>
            )}
          </>
        ) : <Text style={s.cardSub}>An agent will be assigned to you shortly.</Text>}
      </View>

      {/* 2-col grid */}
      <View style={s.grid}>
        <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(main)/ai')}>
          <Calendar size={20} color={C.blue} />
          <Text style={s.gridLabel}>Interview</Text>
          <Text style={s.gridTitle}>Practice Session</Text>
          <View style={s.gridBtn}><Text style={s.gridBtnText}>Start Practice</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(main)/ai')}>
          <Bot size={20} color={C.blue} />
          <Text style={s.gridLabel}>AI Assistant</Text>
          <Text style={s.gridSub}>Ask anything about visa laws...</Text>
          <View style={s.gridBtn}><Text style={s.gridBtnText}>Open AI</Text></View>
        </TouchableOpacity>
      </View>

      {/* Recent updates */}
      <View style={s.card}>
        <View style={[s.row, { marginBottom: 12 }]}>
          <Text style={s.overline}>Recent Updates</Text>
        </View>
        {[
          { title: 'Application Stage Updated', sub: `Stage: ${STAGE_LABEL[profile?.stage] ?? 'Lead'}` },
          { title: 'New University Match', sub: 'Based on your AI preferences' },
        ].map((item, i) => (
          <View key={i} style={[s.updateRow, i > 0 && { marginTop: 12 }]}>
            <View style={[s.updateBar, i === 0 ? { backgroundColor: C.blue } : { backgroundColor: C.slate200 }]} />
            <View>
              <Text style={s.updateTitle}>{item.title}</Text>
              <Text style={s.updateSub}>{item.sub}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity style={s.viewAll} onPress={() => router.push('/(main)/updates')}>
          <Text style={s.viewAllText}>View all updates</Text>
          <ChevronRight size={14} color={C.blue} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  )

  // Staff home
  return (
    <ScrollView style={s.bg} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={[s.pt, { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>Dashboard Overview</Text>
          <Text style={s.heading}>Good morning, {firstName}.</Text>
        </View>
        <BellButton />
      </View>
      <View style={[s.card, { flexDirection: 'row', justifyContent: 'space-around' }]}>
        {[{ label: 'Students', val: '—' }, { label: 'Active', val: '—' }, { label: 'Pending', val: '—' }].map(stat => (
          <View key={stat.label} style={{ alignItems: 'center' }}>
            <Text style={s.bigPct}>{stat.val}</Text>
            <Text style={s.cardSub}>{stat.label}</Text>
          </View>
        ))}
      </View>
      <View style={s.grid}>
        {[
          { label: 'Messages', icon: MessageCircle, route: '/(main)/messages/index' as const },
          { label: 'Students', icon: Users,         route: '/(main)/students/index' as const },
          { label: 'AI Tools', icon: Bot,           route: '/(main)/ai' as const },
        ].map(({ label, icon: Icon, route }) => (
          <TouchableOpacity key={label} style={s.gridCard} onPress={() => router.push(route)}>
            <Icon size={22} color={C.blue} />
            <Text style={[s.gridLabel, { marginTop: 8 }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

// Need Users import for staff grid
import { Users } from 'lucide-react-native'

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
})
