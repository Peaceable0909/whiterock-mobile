import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const API_BASE = 'https://whiterock-connect.vercel.app'
const VALID_HOURS = [2, 3, 5, 7, 10, 20, 24]

const STAGE_LABEL: Record<string, string> = {
  lead: 'New Lead', application_submitted: 'Applied', offer_received: 'Offer',
  deposit_paid: 'Deposit', cas_requested: 'CAS Pending', cas_issued: 'CAS Issued',
  visa_submitted: 'Visa Submitted', visa_decision: 'Visa Decision',
}
const STAGES = Object.keys(STAGE_LABEL)

const PRIORITY_COLOR: Record<string, { dot: string; bg: string; border: string }> = {
  urgent: { dot: '#EF4444', bg: '#FFF1F1', border: '#FECACA' },
  high:   { dot: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
  medium: { dot: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  low:    { dot: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0' },
}

const TYPE_ICON: Record<string, string> = {
  no_reply:           'chatbubble-ellipses-outline',
  pending_doc:        'document-text-outline',
  overdue_task:       'alert-circle-outline',
  upcoming_event:     'calendar-outline',
  question_unanswered:'help-circle-outline',
  stage_stuck:        'timer-outline',
  missing_docs:       'folder-open-outline',
}

const SEVERITY_COLOR: Record<string, string> = {
  urgent:  '#EF4444',
  warning: '#F97316',
  ok:      '#10B981',
}

type BriefingAction = {
  priority: string; type: string; student_name: string
  student_id: string; conv_id: string | null
  description: string; action_label: string
}

type MessageAttention = {
  conv_id: string; student_name: string; student_id: string
  hours_waiting: number; priority: string; reason: string
}

type ScheduleEvent = {
  id: string; title: string; type: string
  starts_at: string; student_id: string | null; student_name: string | null
}

type PendingTask = {
  id: string; title: string; priority: string
  due_date: string | null; student_id: string | null
  student_name: string | null; is_overdue: boolean
}

type CounsellorStat = {
  counsellor_id: string; name: string; total_students: number
  pending_replies: number; pending_docs: number; overdue_tasks: number
  alert: string | null; alert_severity: string
}

type Briefing = {
  type: 'counsellor' | 'admin'
  ai_insights: string
  generated_at: string
  // Counsellor
  pending_actions?: BriefingAction[]
  messages_attention?: MessageAttention[]
  stage_summary?: Record<string, number>
  todays_events?: ScheduleEvent[]
  pending_tasks?: PendingTask[]
  pending_docs_count?: number
  total_students?: number
  // Admin
  counsellor_performance?: CounsellorStat[]
  admissions_overview?: {
    total_students: number; new_this_week: number
    stage_distribution: Record<string, number>
    pending_docs: number; unassigned_conversations: number; at_risk_count: number
  }
}

export default function BriefingScreen() {
  const C           = useColors()
  const s           = mkS(C)
  const insets      = useSafeAreaInsets()
  const router      = useRouter()

  const [role, setRole]               = useState<string | null>(null)
  const [briefing, setBriefing]       = useState<Briefing | null>(null)
  const [loading, setLoading]         = useState(true)
  const [generating, setGenerating]   = useState(false)
  const [refreshing, setRefreshing]   = useState(false)
  const [refreshHours, setRefreshHours] = useState(6)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedHours, setSelectedHours] = useState(6)
  const [savingSettings, setSavingSettings] = useState(false)

  const load = useCallback(async (force = false) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); setRefreshing(false); return }

    const { data: dbUser } = await supabase.from('users').select('role').eq('id', session.user.id).single()
    const userRole = dbUser?.role ?? 'student'
    setRole(userRole)
    if (userRole === 'student') { setLoading(false); setRefreshing(false); return }

    const token = session.access_token

    // Fetch refresh config
    try {
      const cfg = await fetch(`${API_BASE}/api/admin-briefing-config`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json())
      const hrs = cfg.refresh_hours ?? 6
      setRefreshHours(hrs)
      setSelectedHours(hrs)
    } catch { /* keep default */ }

    // Check cached briefing
    if (!force) {
      const { data: cached } = await supabase
        .from('ai_daily_briefings')
        .select('*')
        .eq('user_id', session.user.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cached) {
        const ageMs = Date.now() - new Date(cached.generated_at).getTime()
        const isStale = ageMs > refreshHours * 3600000
        if (!isStale) {
          setBriefing({
            type: cached.briefing_type as 'counsellor' | 'admin',
            ...cached.structured_data,
            generated_at: cached.generated_at,
          })
          setLoading(false)
          setRefreshing(false)
          return
        }
      }
    }

    // Generate fresh briefing
    setLoading(false)
    setGenerating(true)
    try {
      const res = await fetch(`${API_BASE}/api/generate-briefing`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data && !data.error) setBriefing(data as Briefing)
    } catch { /* keep existing briefing */ }
    setGenerating(false)
    setRefreshing(false)
  }, [refreshHours])

  useEffect(() => { load() }, [])

  const onRefresh = () => {
    setRefreshing(true)
    load(true)
  }

  const saveSettings = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setSavingSettings(true)
    await fetch(`${API_BASE}/api/admin-briefing-config`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_hours: selectedHours }),
    }).catch(() => {})
    setRefreshHours(selectedHours)
    setSavingSettings(false)
    setSettingsOpen(false)
  }

  const ago = (iso: string) => {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.round(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.round(hrs / 24)}d ago`
  }

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    const isTomorrow = d.toDateString() === new Date(today.getTime() + 86400000).toDateString()
    const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    if (isToday) return `Today ${t}`
    if (isTomorrow) return `Tomorrow ${t}`
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + t
  }

  const navigateAction = (action: BriefingAction) => {
    if (action.type === 'overdue_task') { router.push('/(main)/tasks'); return }
    if (action.type === 'upcoming_event') { router.push('/(main)/calendar'); return }
    if (action.conv_id) { router.push(`/(main)/messages/${action.conv_id}`); return }
    if (action.student_id) { router.push(`/(main)/students/${action.student_id}`); return }
  }

  // Loading state
  if (loading) {
    return (
      <View style={[s.bg, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.navy} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Today's Tasks</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}><ActivityIndicator size="large" color={C.blue} /></View>
      </View>
    )
  }

  // Student not allowed
  if (role === 'student') {
    return (
      <View style={[s.bg, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.navy} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Today's Tasks</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}>
          <Text style={s.emptyTitle}>Staff Only</Text>
          <Text style={s.emptySub}>This view is for counsellors and admins.</Text>
        </View>
      </View>
    )
  }

  const isAdmin = role === 'admin'

  return (
    <View style={[s.bg, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Today's Tasks</Text>
        <TouchableOpacity
          style={s.settingsBtn}
          onPress={isAdmin ? () => setSettingsOpen(true) : () => load(true)}
        >
          <Ionicons
            name={isAdmin ? 'settings-outline' : 'refresh-outline'}
            size={20}
            color={C.slate500}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />
        }
      >
        {/* Generating indicator */}
        {generating && (
          <View style={s.generatingBar}>
            <ActivityIndicator size="small" color={C.blue} />
            <Text style={s.generatingTxt}>Generating your briefing with AI…</Text>
          </View>
        )}

        {/* Last updated */}
        {briefing?.generated_at && (
          <View style={s.updatedRow}>
            <Ionicons name="time-outline" size={12} color={C.slate400} />
            <Text style={s.updatedTxt}>Updated {ago(briefing.generated_at)} · refreshes every {refreshHours}h</Text>
          </View>
        )}

        {briefing ? (
          <>
            {/* AI Insights Card */}
            {!!briefing.ai_insights && (
              <View style={s.insightCard}>
                <View style={s.insightHeader}>
                  <View style={s.insightIcon}>
                    <Ionicons name="sparkles-outline" size={14} color="#60A5FA" />
                  </View>
                  <Text style={s.insightLabel}>AI DAILY BRIEFING</Text>
                </View>
                <Text style={s.insightText}>{briefing.ai_insights}</Text>
              </View>
            )}

            {/* ── COUNSELLOR VIEW ─────────────────────────────────────────── */}
            {!isAdmin && (
              <>
                {/* Summary stats row */}
                <View style={s.statsRow}>
                  <StatPill
                    icon="people-outline"
                    value={String(briefing.total_students ?? 0)}
                    label="Students"
                    C={C}
                  />
                  <StatPill
                    icon="alert-circle-outline"
                    value={String(briefing.pending_actions?.length ?? 0)}
                    label="Actions"
                    highlight={(briefing.pending_actions?.length ?? 0) > 0}
                    C={C}
                  />
                  <StatPill
                    icon="chatbubble-ellipses-outline"
                    value={String(briefing.messages_attention?.length ?? 0)}
                    label="Need Reply"
                    highlight={(briefing.messages_attention?.length ?? 0) > 0}
                    C={C}
                  />
                  <StatPill
                    icon="document-text-outline"
                    value={String(briefing.pending_docs_count ?? 0)}
                    label="Docs"
                    highlight={(briefing.pending_docs_count ?? 0) > 0}
                    C={C}
                  />
                </View>

                {/* Pending Actions */}
                {(briefing.pending_actions ?? []).length > 0 && (
                  <Section label="PENDING ACTIONS" count={briefing.pending_actions!.length} C={C}>
                    {briefing.pending_actions!.map((action, i) => {
                      const pc = PRIORITY_COLOR[action.priority] ?? PRIORITY_COLOR.low
                      const icon = TYPE_ICON[action.type] ?? 'ellipse-outline'
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[s.actionCard, { backgroundColor: pc.bg, borderColor: pc.border }]}
                          onPress={() => navigateAction(action)}
                          activeOpacity={0.8}
                        >
                          <View style={s.actionRow}>
                            <View style={[s.actionIconWrap, { backgroundColor: pc.dot + '22' }]}>
                              <Ionicons name={icon as any} size={16} color={pc.dot} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.actionStudent} numberOfLines={1}>{action.student_name}</Text>
                              <Text style={s.actionDesc} numberOfLines={2}>{action.description}</Text>
                            </View>
                            <View style={s.actionBadge}>
                              <View style={[s.priorityDot, { backgroundColor: pc.dot }]} />
                              <Text style={[s.priorityLabel, { color: pc.dot }]}>
                                {action.priority.charAt(0).toUpperCase() + action.priority.slice(1)}
                              </Text>
                            </View>
                          </View>
                          <View style={[s.actionBtn, { borderColor: pc.dot }]}>
                            <Text style={[s.actionBtnTxt, { color: pc.dot }]}>{action.action_label}</Text>
                            <Ionicons name="chevron-forward" size={12} color={pc.dot} />
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </Section>
                )}

                {/* Messages Needing Attention */}
                {(briefing.messages_attention ?? []).length > 0 && (
                  <Section label="MESSAGES TO REPLY" count={briefing.messages_attention!.length} C={C}>
                    {briefing.messages_attention!.map((msg, i) => {
                      const pc = PRIORITY_COLOR[msg.priority] ?? PRIORITY_COLOR.medium
                      const urgent = msg.hours_waiting >= 12
                      return (
                        <TouchableOpacity
                          key={i}
                          style={s.msgCard}
                          onPress={() => router.push(`/(main)/messages/${msg.conv_id}`)}
                          activeOpacity={0.8}
                        >
                          <View style={[s.msgAvatar, { backgroundColor: urgent ? '#FEE2E2' : C.slate100 }]}>
                            <Text style={[s.msgAvatarTxt, { color: urgent ? '#EF4444' : C.slate500 }]}>
                              {msg.student_name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.msgName}>{msg.student_name}</Text>
                            <Text style={s.msgReason} numberOfLines={1}>{msg.reason}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 4 }}>
                            <View style={[s.waitBadge, { backgroundColor: urgent ? '#FEE2E2' : '#FFF7ED' }]}>
                              <Text style={[s.waitTxt, { color: urgent ? '#EF4444' : '#F97316' }]}>
                                {msg.hours_waiting >= 1 ? `${Math.round(msg.hours_waiting)}h` : '<1h'}
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={14} color={C.slate400} />
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </Section>
                )}

                {/* Today's Schedule */}
                {(briefing.todays_events ?? []).length > 0 && (
                  <Section label="UPCOMING SCHEDULE" C={C}>
                    {briefing.todays_events!.map((event, i) => (
                      <TouchableOpacity
                        key={i}
                        style={s.eventCard}
                        onPress={() => router.push('/(main)/calendar')}
                        activeOpacity={0.8}
                      >
                        <View style={s.eventTimeCol}>
                          <Text style={s.eventTime}>{fmtTime(event.starts_at).split(' ')[0]}</Text>
                          <Text style={s.eventTimeAlt}>{fmtTime(event.starts_at).split(' ').slice(1).join(' ')}</Text>
                        </View>
                        <View style={s.eventDivider} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.eventTitle} numberOfLines={1}>{event.title}</Text>
                          {event.student_name && (
                            <Text style={s.eventSub}>{event.student_name}</Text>
                          )}
                        </View>
                        <View style={[s.eventTypePill, { backgroundColor: event.type === 'interview' ? '#F3E8FF' : '#EFF6FF' }]}>
                          <Text style={[s.eventTypeTxt, { color: event.type === 'interview' ? '#9333EA' : C.blue }]}>
                            {event.type === 'interview' ? 'Interview' : event.type ?? 'Event'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </Section>
                )}

                {/* Pending Tasks */}
                {(briefing.pending_tasks ?? []).length > 0 && (
                  <Section label="MY TASKS" count={briefing.pending_tasks!.length} C={C}>
                    {briefing.pending_tasks!.map((task, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[s.taskCard, task.is_overdue && s.taskCardOverdue]}
                        onPress={() => router.push('/(main)/tasks')}
                        activeOpacity={0.8}
                      >
                        <View style={[s.taskPriorityBar, {
                          backgroundColor: task.is_overdue ? '#EF4444' :
                            task.priority === 'urgent' ? '#EF4444' :
                            task.priority === 'high'   ? '#F97316' :
                            task.priority === 'normal' ? C.blue : C.slate400,
                        }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.taskTitle} numberOfLines={1}>{task.title}</Text>
                          {task.student_name && (
                            <Text style={s.taskSub}>{task.student_name}</Text>
                          )}
                        </View>
                        {task.is_overdue ? (
                          <View style={s.overduePill}>
                            <Text style={s.overdueTxt}>Overdue</Text>
                          </View>
                        ) : task.due_date ? (
                          <Text style={s.taskDue}>
                            {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={s.viewAllBtn} onPress={() => router.push('/(main)/tasks')}>
                      <Text style={s.viewAllTxt}>View All Tasks</Text>
                      <Ionicons name="arrow-forward" size={13} color={C.blue} />
                    </TouchableOpacity>
                  </Section>
                )}

                {/* Stage Pipeline */}
                {briefing.stage_summary && Object.keys(briefing.stage_summary).length > 0 && (
                  <PipelineChart summary={briefing.stage_summary} C={C} />
                )}
              </>
            )}

            {/* ── ADMIN VIEW ──────────────────────────────────────────────── */}
            {isAdmin && briefing.counsellor_performance && (
              <>
                {/* Admissions Overview */}
                {briefing.admissions_overview && (
                  <View style={s.card}>
                    <Text style={s.sectionLabel}>ADMISSIONS OVERVIEW</Text>
                    <View style={s.overviewGrid}>
                      <OverviewStat label="Total Students" value={briefing.admissions_overview.total_students} C={C} />
                      <OverviewStat label="New This Week"  value={briefing.admissions_overview.new_this_week}  C={C} />
                      <OverviewStat label="Pending Docs"   value={briefing.admissions_overview.pending_docs} highlight C={C} />
                      <OverviewStat label="At Risk"        value={briefing.admissions_overview.at_risk_count} highlight C={C} />
                      <OverviewStat label="Unassigned"     value={briefing.admissions_overview.unassigned_conversations} highlight C={C} />
                    </View>

                    {briefing.admissions_overview.stage_distribution && (
                      <PipelineChart summary={briefing.admissions_overview.stage_distribution} C={C} compact />
                    )}
                  </View>
                )}

                {/* Counsellor Performance */}
                <Section label="COUNSELLOR PERFORMANCE" count={briefing.counsellor_performance.length} C={C}>
                  {briefing.counsellor_performance.map((cs, i) => (
                    <View key={i} style={[s.counsellorCard, cs.alert_severity === 'urgent' && s.counsellorCardUrgent]}>
                      <View style={s.counsellorHeader}>
                        <View style={s.counsellorAvatar}>
                          <Text style={s.counsellorAvatarTxt}>{cs.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.counsellorName}>{cs.name}</Text>
                          <Text style={s.counsellorSub}>{cs.total_students} students</Text>
                        </View>
                        {cs.alert_severity !== 'ok' && (
                          <View style={[s.alertPill, { backgroundColor: SEVERITY_COLOR[cs.alert_severity] + '22' }]}>
                            <View style={[s.alertDot, { backgroundColor: SEVERITY_COLOR[cs.alert_severity] }]} />
                            <Text style={[s.alertTxt, { color: SEVERITY_COLOR[cs.alert_severity] }]}>
                              {cs.alert_severity === 'urgent' ? 'Urgent' : 'Warning'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={s.counsellorStats}>
                        <CounsellorMini label="Pending Replies" value={cs.pending_replies} danger={cs.pending_replies > 3} C={C} />
                        <CounsellorMini label="Docs to Review"  value={cs.pending_docs}    danger={cs.pending_docs > 5}    C={C} />
                        <CounsellorMini label="Overdue Tasks"   value={cs.overdue_tasks}   danger={cs.overdue_tasks > 0}   C={C} />
                      </View>
                      {cs.alert && (
                        <View style={[s.alertBanner, { backgroundColor: SEVERITY_COLOR[cs.alert_severity] + '18' }]}>
                          <Ionicons name="warning-outline" size={13} color={SEVERITY_COLOR[cs.alert_severity]} />
                          <Text style={[s.alertBannerTxt, { color: SEVERITY_COLOR[cs.alert_severity] }]}>{cs.alert}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </Section>
              </>
            )}

            {/* Empty state if nothing interesting */}
            {!briefing.ai_insights && !briefing.pending_actions?.length && !briefing.messages_attention?.length && (
              <View style={s.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={44} color="#10B981" />
                <Text style={s.emptyTitle}>All caught up!</Text>
                <Text style={s.emptySub}>No pending actions or messages requiring your attention right now.</Text>
              </View>
            )}
          </>
        ) : !generating ? (
          /* No briefing available */
          <View style={s.emptyState}>
            <Ionicons name="analytics-outline" size={44} color={C.slate300} />
            <Text style={s.emptyTitle}>No briefing yet</Text>
            <Text style={s.emptySub}>Pull down to generate your first AI briefing.</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Admin Settings Modal */}
      {isAdmin && (
        <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
          <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setSettingsOpen(false)}>
            <TouchableOpacity activeOpacity={1} style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={s.handle} />
              <Text style={s.modalTitle}>Briefing Refresh Interval</Text>
              <Text style={s.modalSub}>AI briefings auto-regenerate after the selected period.</Text>
              <View style={s.hoursGrid}>
                {VALID_HOURS.map(h => (
                  <TouchableOpacity
                    key={h}
                    style={[s.hourPill, selectedHours === h && s.hourPillActive]}
                    onPress={() => setSelectedHours(h)}
                  >
                    <Text style={[s.hourPillTxt, selectedHours === h && s.hourPillTxtActive]}>
                      {h}h
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[s.saveBtn, savingSettings && { opacity: 0.5 }]}
                onPress={saveSettings}
                disabled={savingSettings}
              >
                {savingSettings
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.saveBtnTxt}>Save</Text>}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  label, count, children, C,
}: {
  label: string; count?: number; children: React.ReactNode; C: ColorPalette
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1.2 }}>
          {label}
        </Text>
        {count !== undefined && count > 0 && (
          <View style={{ backgroundColor: C.blue, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>{count}</Text>
          </View>
        )}
      </View>
      {children}
    </View>
  )
}

function StatPill({ icon, value, label, highlight, C }: {
  icon: string; value: string; label: string; highlight?: boolean; C: ColorPalette
}) {
  return (
    <View style={{
      flex: 1, alignItems: 'center', gap: 4,
      backgroundColor: highlight && value !== '0' ? '#EFF6FF' : C.white,
      borderRadius: 14, paddingVertical: 12,
      borderWidth: 1.5, borderColor: highlight && value !== '0' ? '#BFDBFE' : C.slate200,
    }}>
      <Ionicons name={icon as any} size={18} color={highlight && value !== '0' ? C.blue : C.slate400} />
      <Text style={{ fontSize: 18, fontWeight: '800', color: highlight && value !== '0' ? C.blue : C.navy }}>{value}</Text>
      <Text style={{ fontSize: 9, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  )
}

function PipelineChart({ summary, C, compact }: { summary: Record<string, number>; C: ColorPalette; compact?: boolean }) {
  const total = Object.values(summary).reduce((a, b) => a + b, 0)
  if (!total) return null
  const orderedStages = STAGES.filter(s => (summary[s] ?? 0) > 0)

  return (
    <View style={{ marginBottom: compact ? 0 : 20 }}>
      {!compact && (
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>
          APPLICATION PIPELINE
        </Text>
      )}
      <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 8 }}>
        {orderedStages.map(stage => {
          const count = summary[stage] ?? 0
          const pct = Math.round((count / total) * 100)
          const stageIdx = STAGES.indexOf(stage)
          const hue = Math.round((stageIdx / (STAGES.length - 1)) * 220)
          const color = `hsl(${220 - hue}, 70%, 50%)`
          return (
            <View key={stage} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#1B2B4A' }}>{STAGE_LABEL[stage] ?? stage}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>{count}</Text>
              </View>
              <View style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: color, width: `${Math.max(pct, 2)}%` }} />
              </View>
            </View>
          )
        })}
        <Text style={{ fontSize: 11, color: '#94A3B8', textAlign: 'right' }}>{total} students total</Text>
      </View>
    </View>
  )
}

function OverviewStat({ label, value, highlight, C }: {
  label: string; value: number; highlight?: boolean; C: ColorPalette
}) {
  const isAlert = highlight && value > 0
  return (
    <View style={{
      minWidth: '30%', flex: 1,
      backgroundColor: isAlert ? '#FFF7ED' : C.slate100,
      borderRadius: 12, padding: 10, alignItems: 'center', gap: 2,
    }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: isAlert ? '#F97316' : C.navy }}>{value}</Text>
      <Text style={{ fontSize: 10, fontWeight: '600', color: C.slate500, textAlign: 'center' }}>{label}</Text>
    </View>
  )
}

function CounsellorMini({ label, value, danger, C }: {
  label: string; value: number; danger?: boolean; C: ColorPalette
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: danger && value > 0 ? '#EF4444' : C.navy }}>
        {value}
      </Text>
      <Text style={{ fontSize: 9, fontWeight: '600', color: C.slate400, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:               { flex: 1, backgroundColor: C.bg },
  header:           { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:          { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  settingsBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:      { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.navy },

  content:          { padding: 16 },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },

  generatingBar:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginBottom: 12 },
  generatingTxt:    { fontSize: 13, fontWeight: '600', color: C.blue },
  updatedRow:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
  updatedTxt:       { fontSize: 11, color: C.slate400, fontWeight: '500' },

  insightCard:      { backgroundColor: C.navy, borderRadius: 20, padding: 18, marginBottom: 20, shadowColor: C.navy, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  insightHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  insightIcon:      { width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  insightLabel:     { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, textTransform: 'uppercase' },
  insightText:      { fontSize: 14, color: C.white, lineHeight: 22, fontWeight: '500' },

  statsRow:         { flexDirection: 'row', gap: 8, marginBottom: 20 },

  sectionLabel:     { fontSize: 11, fontWeight: '800', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 },

  actionCard:       { borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 10 },
  actionRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  actionIconWrap:   { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actionStudent:    { fontSize: 14, fontWeight: '700', color: C.navy },
  actionDesc:       { fontSize: 12, color: C.slate500, marginTop: 2, lineHeight: 17 },
  actionBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  priorityDot:      { width: 6, height: 6, borderRadius: 3 },
  priorityLabel:    { fontSize: 10, fontWeight: '800' },
  actionBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1.5, borderRadius: 10, paddingVertical: 7 },
  actionBtnTxt:     { fontSize: 12, fontWeight: '700' },

  msgCard:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  msgAvatar:        { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  msgAvatarTxt:     { fontSize: 16, fontWeight: '800' },
  msgName:          { fontSize: 14, fontWeight: '700', color: C.navy },
  msgReason:        { fontSize: 12, color: C.slate500, marginTop: 2 },
  waitBadge:        { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  waitTxt:          { fontSize: 11, fontWeight: '800' },

  eventCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
  eventTimeCol:     { alignItems: 'center', minWidth: 52 },
  eventTime:        { fontSize: 12, fontWeight: '800', color: C.blue },
  eventTimeAlt:     { fontSize: 10, color: C.slate400, fontWeight: '500' },
  eventDivider:     { width: 1, height: 36, backgroundColor: C.slate200 },
  eventTitle:       { fontSize: 14, fontWeight: '700', color: C.navy },
  eventSub:         { fontSize: 12, color: C.slate500, marginTop: 2 },
  eventTypePill:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  eventTypeTxt:     { fontSize: 10, fontWeight: '800' },

  taskCard:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 8, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
  taskCardOverdue:  { backgroundColor: '#FFF1F1' },
  taskPriorityBar:  { width: 3, height: 36, borderRadius: 2, flexShrink: 0 },
  taskTitle:        { fontSize: 14, fontWeight: '700', color: C.navy },
  taskSub:          { fontSize: 12, color: C.slate500, marginTop: 1 },
  taskDue:          { fontSize: 11, fontWeight: '600', color: C.slate400 },
  overduePill:      { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  overdueTxt:       { fontSize: 10, fontWeight: '800', color: '#EF4444' },
  viewAllBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, borderTopWidth: 1, borderColor: C.slate200, marginTop: 4 },
  viewAllTxt:       { fontSize: 13, fontWeight: '700', color: C.blue },

  card:             { backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  overviewGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },

  counsellorCard:        { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  counsellorCardUrgent:  { borderWidth: 1.5, borderColor: '#FECACA' },
  counsellorHeader:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  counsellorAvatar:      { width: 38, height: 38, borderRadius: 19, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  counsellorAvatarTxt:   { fontSize: 15, fontWeight: '800', color: '#fff' },
  counsellorName:        { fontSize: 14, fontWeight: '700', color: C.navy },
  counsellorSub:         { fontSize: 12, color: C.slate500 },
  alertPill:             { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  alertDot:              { width: 6, height: 6, borderRadius: 3 },
  alertTxt:              { fontSize: 10, fontWeight: '800' },
  counsellorStats:       { flexDirection: 'row', borderTopWidth: 1, borderColor: C.slate100, paddingTop: 10, gap: 4 },
  alertBanner:           { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginTop: 10 },
  alertBannerTxt:        { fontSize: 12, fontWeight: '600', flex: 1 },

  emptyState:       { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyTitle:       { fontSize: 18, fontWeight: '800', color: C.navy },
  emptySub:         { fontSize: 13, color: C.slate400, textAlign: 'center', lineHeight: 20 },

  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  handle:           { width: 40, height: 4, borderRadius: 2, backgroundColor: C.slate200, alignSelf: 'center', marginBottom: 18 },
  modalTitle:       { fontSize: 20, fontWeight: '800', color: C.navy, marginBottom: 6 },
  modalSub:         { fontSize: 13, color: C.slate500, marginBottom: 20 },
  hoursGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  hourPill:         { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: C.slate200, backgroundColor: C.white },
  hourPillActive:   { borderColor: C.blue, backgroundColor: '#EFF6FF' },
  hourPillTxt:      { fontSize: 15, fontWeight: '700', color: C.slate500 },
  hourPillTxtActive:{ color: C.blue },
  saveBtn:          { backgroundColor: C.blue, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  saveBtnTxt:       { fontSize: 15, fontWeight: '800', color: C.white },
})
