import { useEffect, useState, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Image } from 'react-native'
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
    <TouchableOpacity style={s.bellBtn} accessibilityLabel="Notifications"
      onPress={() => { setNotifUnread(0); router.push('/(main)/notifications' as any) }}>
      <Ionicons name="notifications-outline" size={20} color={C.slate500} />
      {notifUnread > 0 && (
        <View style={s.bellBadge}>
          <Text style={s.bellBadgeText}>{notifUnread > 9 ? '9+' : notifUnread}</Text>
        </View>
      )}
    </TouchableOpacity>
  )

  const AvatarButton = () => (
    <TouchableOpacity style={s.avatarBtn} onPress={() => router.push('/(main)/more' as any)} accessibilityLabel="Profile">
      {user?.avatar_url
        ? <Image source={{ uri: user.avatar_url }} style={s.headerAvatar} />
        : <View style={s.headerAvatarFallback}>
            <Text style={s.headerAvatarText}>{(user?.name ?? 'U')[0].toUpperCase()}</Text>
          </View>
      }
    </TouchableOpacity>
  )

  const isStudent  = user?.role === 'student'
  const isAgent    = user?.role === 'agent'
  const stageIdx   = profile ? Math.max(JOURNEY_STAGES.indexOf(profile.stage), 0) : 0
  const pct        = Math.round((stageIdx / (JOURNEY_STAGES.length - 1)) * 100)
  const firstName  = (user?.name ?? 'User').split(' ')[0]
  const nextStage  = JOURNEY_STAGES[stageIdx + 1]

  const progressAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: pct / 100,
      duration: 900,
      useNativeDriver: false,
    }).start()
  }, [pct])

  if (loading) return (
    <ScrollView style={s.bg} contentContainerStyle={[s.content, { paddingTop: insets.top + 8, paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton height={11} width={'50%'} radius={4} />
          <Skeleton height={22} width={'70%'} radius={4} />
        </View>
        <Skeleton height={36} width={36} radius={18} style={{ marginLeft: 12 }} />
        <Skeleton height={36} width={36} radius={18} style={{ marginLeft: 8 }} />
      </View>
      <SkeletonCard style={{ marginBottom: 14 }}>
        <Skeleton height={13} width={'50%'} radius={4} style={{ marginBottom: 14 }} />
        <Skeleton height={8} radius={4} style={{ marginBottom: 10 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Skeleton height={11} width={'35%'} radius={4} />
          <Skeleton height={11} width={'15%'} radius={4} />
        </View>
      </SkeletonCard>
      <SkeletonCard style={{ marginBottom: 14 }}>
        <Skeleton height={13} width={'40%'} radius={4} style={{ marginBottom: 16 }} />
        {[0, 1, 2].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: i < 2 ? 12 : 0 }}>
            <Skeleton height={36} width={36} radius={10} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton height={12} width={'60%'} radius={4} />
              <Skeleton height={10} width={'40%'} radius={4} />
            </View>
          </View>
        ))}
      </SkeletonCard>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[0, 1, 2].map(i => (
          <SkeletonCard key={i} style={{ flex: 1 }}>
            <Skeleton height={28} radius={6} style={{ marginBottom: 8 }} />
            <Skeleton height={10} width={'70%'} radius={4} />
          </SkeletonCard>
        ))}
      </View>
    </ScrollView>
  )

  /* ─────────────── STUDENT DASHBOARD ─────────────── */
  if (isStudent) return (
    <ScrollView style={s.bg} contentContainerStyle={[s.content, { paddingTop: insets.top + 8, paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 8, marginBottom: 20 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>Dashboard Overview</Text>
          <Text style={s.heading}>Welcome back, {firstName}.</Text>
        </View>
        <BellButton />
        <AvatarButton />
      </View>

      {/* ── Visa celebration banner ── */}
      {(profile?.visa_outcome === 'approved' || profile?.visa_outcome === 'granted') && (
        <View style={s.visaBanner}>
          <Text style={s.visaEmoji}>🎉</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.visaBannerTitle}>Visa Approved!</Text>
            <Text style={s.visaBannerSub}>Congratulations {firstName} — your UK visa has been granted. Your journey begins!</Text>
          </View>
        </View>
      )}

      {/* ── My Application ── */}
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

      {/* ── My Assigned Agent ── */}
      <View style={s.card}>
        <View style={[s.row, { marginBottom: 14 }]}>
          <View style={s.iconCircle}><Ionicons name="person-outline" size={18} color={C.blue} /></View>
          <Text style={[s.cardTitle, { marginLeft: 10, flex: 1 }]}>My Assigned Agent</Text>
          {agent?.is_online
            ? <View style={s.onlineBadge}><View style={s.dot} /><Text style={s.onlineText}>ONLINE</Text></View>
            : <View style={[s.onlineBadge, { backgroundColor: C.slate100, borderColor: C.slate200 }]}>
                <View style={[s.dot, { backgroundColor: C.slate400 }]} />
                <Text style={[s.onlineText, { color: C.slate500 }]}>OFFLINE</Text>
              </View>
          }
        </View>
        {agent ? (
          <>
            <View style={s.agentRow}>
              <View style={s.agentAvatar}>
                <Text style={s.agentAvatarText}>{agent.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</Text>
              </View>
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

      {/* ── Appointments + Digital Vault ── */}
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

      {/* ── AI Assistant — full-width featured card ── */}
      <TouchableOpacity style={s.aiCard} onPress={() => router.push('/(main)/ai')}>
        <View style={[s.row, { marginBottom: 12 }]}>
          <View style={s.aiIconBox}>
            <Ionicons name="hardware-chip-outline" size={22} color={C.white} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.cardTitle}>AI Assistant</Text>
            <Text style={s.cardSub}>Powered by Qwen · Always available</Text>
          </View>
          <View style={s.onlineBadge}>
            <View style={s.dot} />
            <Text style={s.onlineText}>ONLINE</Text>
          </View>
        </View>
        <Text style={s.aiDesc}>
          Get instant answers about UK student visas, CAS letters, maintenance funds, university requirements, and your full application journey.
        </Text>
        <View style={[s.btn, { marginTop: 14 }]}>
          <Ionicons name="hardware-chip-outline" size={14} color={C.white} />
          <Text style={[s.btnText, { marginLeft: 6 }]}>Open AI Assistant</Text>
        </View>
      </TouchableOpacity>

      {/* ── Recent Updates ── */}
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
              <View style={s.updateRow}>
                <View style={[s.updateBar, { backgroundColor: C.blue }]} />
                <View>
                  <Text style={s.updateTitle}>Application Stage Updated</Text>
                  <Text style={s.updateSub}>Stage: {STAGE_LABEL[profile?.stage] ?? 'Lead'}</Text>
                </View>
              </View>
            )
        }
        <TouchableOpacity style={s.viewAll} onPress={() => router.push('/(main)/updates')}>
          <Text style={s.viewAllText}>View all updates</Text>
          <Ionicons name="chevron-forward" size={14} color={C.blue} />
        </TouchableOpacity>
      </View>

      {/* ── More Features ── */}
      <Text style={s.sectionLabel}>More Features</Text>
      <View style={s.grid}>
        <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(main)/payments' as any)}>
          <Ionicons name="card-outline" size={20} color="#6366F1" />
          <Text style={s.gridLabel}>Payments</Text>
          <Text style={s.gridTitle}>Billing & Fees</Text>
          <View style={[s.gridBtn, { backgroundColor: '#6366F1' }]}>
            <Text style={s.gridBtnText}>View</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(main)/university-offers' as any)}>
          <Ionicons name="school-outline" size={20} color="#059669" />
          <Text style={s.gridLabel}>Uni Offers</Text>
          <Text style={s.gridTitle}>Offers & Decisions</Text>
          <View style={[s.gridBtn, { backgroundColor: '#059669' }]}>
            <Text style={s.gridBtnText}>View</Text>
          </View>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={s.card} onPress={() => router.push('/(main)/resources' as any)}>
        <View style={s.row}>
          <View style={[s.iconCircle, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="library-outline" size={20} color="#D97706" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.cardTitle}>Resources & Guides</Text>
            <Text style={s.cardSub}>Visa checklists, templates & study materials</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.slate300} />
        </View>
      </TouchableOpacity>

    </ScrollView>
  )

  /* ─────────────── STAFF DASHBOARD ─────────────── */
  return (
    <ScrollView style={s.bg} contentContainerStyle={[s.content, { paddingTop: insets.top + 8, paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 8, marginBottom: 20 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>{isAgent ? 'Recruitment Pipeline' : 'Dashboard Overview'}</Text>
          <Text style={s.heading}>Good morning, {firstName}.</Text>
        </View>
        <BellButton />
        <AvatarButton />
      </View>

      {isAgent ? <AgentPipeline userId={user?.id} /> : <StaffStats userId={user?.id} />}
      <DailyBriefing firstName={firstName} userId={user?.id} />

      <View style={s.grid}>
        {(isAgent ? [
          { label: 'Messages',     iconName: 'chatbubble-outline',  route: '/(main)/messages'     as const },
          { label: 'Students',     iconName: 'people-outline',      route: '/(main)/students'     as const },
          { label: 'Updates',      iconName: 'newspaper-outline',   route: '/(main)/updates'      as const },
          { label: 'Appointments', iconName: 'calendar-outline',    route: '/(main)/appointments' as const },
        ] : [
          { label: 'Messages', iconName: 'chatbubble-outline',    route: '/(main)/messages' as const },
          { label: 'Students', iconName: 'people-outline',        route: '/(main)/students' as const },
          { label: 'AI Tools', iconName: 'hardware-chip-outline', route: '/(main)/ai'       as const },
          { label: 'Updates',  iconName: 'newspaper-outline',     route: '/(main)/updates'  as const },
        ] as const).map(({ label, iconName, route }) => (
          <TouchableOpacity key={label} style={s.gridCard} onPress={() => router.push(route as any)}>
            <Ionicons name={iconName as any} size={22} color={C.blue} />
            <Text style={[s.gridLabel, { marginTop: 8 }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

function StaffStats({ userId }: { userId?: string }) {
  const C = useColors()
  const ss = mkSS(C)
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
    { label: 'Students',    val: stats.students,    color: C.blue },
    { label: 'Active',      val: stats.active,      color: '#059669' },
    { label: 'Pending Docs',val: stats.pendingDocs, color: stats.pendingDocs > 0 ? '#F59E0B' : C.slate400 },
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

function DailyBriefing({ firstName, userId }: { firstName: string; userId?: string }) {
  const C = useColors()
  const [displayed, setDisplayed] = useState('')
  const [brief, setBrief]         = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!userId) return
    const go = async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const or = `counselor_id.eq.${userId},agent_id.eq.${userId}`
      const [{ count: total }, { data: activeConvs }, { count: pending }] = await Promise.all([
        supabase.from('conversations').select('id', { count: 'exact', head: true }).or(or),
        supabase.from('conversations').select('id').or(or).gt('last_message_at', weekAgo),
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ])
      const h = new Date().getHours()
      const g = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
      let t = `Good ${g}, ${firstName}. `
      if (total)               t += `${total} student${total !== 1 ? 's' : ''} in your pipeline. `
      if (activeConvs?.length) t += `${activeConvs.length} active conversation${activeConvs.length !== 1 ? 's' : ''} this week. `
      if ((pending ?? 0) > 0)  t += `⚠ ${pending} document${pending !== 1 ? 's' : ''} pending review.`
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
    <View style={{ backgroundColor: C.navy, borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: C.navy, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 }}>
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
  statsCard:  { flexDirection: 'row', backgroundColor: C.white, borderRadius: 20, paddingVertical: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statItem:   { flex: 1, alignItems: 'center' },
  statBorder: { borderRightWidth: 1, borderColor: C.slate100 },
  statNum:    { fontSize: 28, fontWeight: '900' },
  statLabel:  { fontSize: 11, color: C.slate400, fontWeight: '600', marginTop: 2 },
})

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:               { flex: 1, backgroundColor: C.bg },
  content:          { padding: 16, paddingBottom: 40 },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  overline:         { fontSize: 11, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1.5 },
  heading:          { fontSize: 22, fontWeight: '800', color: C.navy, marginTop: 2 },
  bellBtn:          { width: 44, height: 44, borderRadius: 14, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  bellBadge:        { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  bellBadgeText:    { fontSize: 9, fontWeight: '800', color: C.white },
  avatarBtn:        { marginLeft: 10, width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  headerAvatar:     { width: 40, height: 40, borderRadius: 20 },
  headerAvatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontSize: 15, fontWeight: '800', color: C.white },
  card:             { backgroundColor: C.white, borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  row:              { flexDirection: 'row', alignItems: 'center' },
  iconCircle:       { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  cardTitle:        { fontSize: 15, fontWeight: '700', color: C.navy },
  cardSub:          { fontSize: 12, color: C.slate400, marginTop: 2 },
  bigPct:           { fontSize: 28, fontWeight: '900', color: C.blue },
  barBg:            { height: 8, backgroundColor: C.slate100, borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  barFg:            { height: 8, backgroundColor: C.blue, borderRadius: 4 },
  nextStep:         { fontSize: 12, color: C.slate400, marginTop: 6, marginBottom: 14 },
  nextStepBold:     { fontWeight: '600', color: C.slate500 },
  btn:              { height: 44, backgroundColor: C.blue, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  btnText:          { color: C.white, fontWeight: '700', fontSize: 14 },
  onlineBadge:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#BBF7D0' },
  dot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 4 },
  onlineText:       { fontSize: 9, fontWeight: '700', color: '#15803D' },
  agentRow:         { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  agentAvatar:      { width: 48, height: 48, borderRadius: 24, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  agentAvatarText:  { color: C.white, fontWeight: '700', fontSize: 16 },
  agentName:        { fontSize: 15, fontWeight: '700', color: C.navy },
  agentRole:        { fontSize: 12, color: C.slate500 },
  aiCard:           { backgroundColor: '#EFF6FF', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: '#BFDBFE', shadowColor: '#1D4ED8', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  aiIconBox:        { width: 44, height: 44, borderRadius: 14, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  aiDesc:           { fontSize: 13, color: C.slate500, lineHeight: 20 },
  grid:             { flexDirection: 'row', gap: 12, marginBottom: 14 },
  gridCard:         { flex: 1, backgroundColor: C.white, borderRadius: 18, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  gridLabel:        { fontSize: 10, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1, marginTop: 10 },
  gridTitle:        { fontSize: 13, fontWeight: '700', color: C.navy, marginTop: 2 },
  gridBtn:          { marginTop: 10, height: 32, backgroundColor: C.blue, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  gridBtnText:      { fontSize: 11, fontWeight: '700', color: C.white },
  updateRow:        { flexDirection: 'row', alignItems: 'flex-start' },
  updateBar:        { width: 3, height: '100%', borderRadius: 2, marginRight: 10, minHeight: 36 },
  updateTitle:      { fontSize: 13, fontWeight: '700', color: C.navy },
  updateSub:        { fontSize: 12, color: C.slate400, marginTop: 2 },
  viewAll:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  viewAllText:      { fontSize: 12, fontWeight: '700', color: C.blue, marginRight: 2 },
  sectionLabel:     { fontSize: 10, fontWeight: '800', color: C.slate400, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 6, paddingHorizontal: 2 },
  visaBanner:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ECFDF5', borderWidth: 1.5, borderColor: '#6EE7B7', borderRadius: 20, padding: 16, marginBottom: 14 },
  visaEmoji:        { fontSize: 28 },
  visaBannerTitle:  { fontSize: 15, fontWeight: '800', color: '#065F46', marginBottom: 3 },
  visaBannerSub:    { fontSize: 12, color: '#059669', lineHeight: 17 },
})
