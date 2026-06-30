import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, SectionList, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'
import { Skeleton, SkeletonCard, EmptyState } from '@/components/Skeleton'

const ICON_NAMES: Record<string, string> = {
  message:      'chatbubble-outline',
  document:     'document-text-outline',
  interview:    'videocam-outline',
  visa:         'checkmark-circle-outline',
  success:      'checkmark-circle-outline',
  stage_update: 'flag-outline',
  briefing:     'hardware-chip-outline',
  warning:      'warning-outline',
  error:        'warning-outline',
  info:         'information-circle-outline',
}

const TYPE_LABELS: Record<string, string> = {
  message:      'Message',
  document:     'Document',
  interview:    'Interview',
  visa:         'Visa',
  success:      'Success',
  stage_update: 'Stage Update',
  briefing:     'AI Briefing',
  warning:      'Warning',
  error:        'Alert',
  info:         'Info',
}

function sectionKey(iso: string) {
  const itemDay = new Date(iso)
  itemDay.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - itemDay.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7)  return 'This Week'
  return 'Earlier'
}

function groupByDate(items: any[]) {
  const ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier']
  const map: Record<string, any[]> = {}
  for (const item of items) {
    const key = sectionKey(item.created_at)
    if (!map[key]) map[key] = []
    map[key].push(item)
  }
  return ORDER.filter(k => map[k]).map(k => ({ title: k, data: map[k] }))
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1)  return 'now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationsScreen() {
  const C = useColors()
  const s = mkS(C)
  const router    = useRouter()
  const insets    = useSafeAreaInsets()
  const [items, setItems]         = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId]       = useState<string | null>(null)
  const [userRole, setUserRole]   = useState<string>('student')
  const uidRef = useRef<string | null>(null)

  const NOTIF_COLORS: Record<string, string> = {
    message:      C.blue,
    document:     '#D97706',
    interview:    '#9333EA',
    visa:         '#16A34A',
    success:      '#16A34A',
    stage_update: '#0891B2',
    briefing:     '#7C3AED',
    warning:      '#EA580C',
    error:        '#DC2626',
    info:         '#64748B',
  }

  const fetchItems = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(60)
    setItems(data ?? [])
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      uidRef.current = user.id
      setUserId(user.id)
      const { data: meUser } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
      setUserRole(meUser?.role ?? 'student')
      await fetchItems(user.id)
      setLoading(false)
      supabase.from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .then(() => setItems(prev => prev.map(i => ({ ...i, is_read: true }))))
    }
    load()
    const sub = supabase.channel('notif-screen')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        payload => {
          const n = payload.new as any
          if (uidRef.current && n.user_id === uidRef.current) setItems(prev => [n, ...prev])
        })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [fetchItems])

  const onRefresh = useCallback(async () => {
    if (!userId) return
    setRefreshing(true)
    await fetchItems(userId)
    setRefreshing(false)
  }, [userId, fetchItems])

  const markAllRead = useCallback(async () => {
    if (!userId) return
    supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .then(() => setItems(prev => prev.map(i => ({ ...i, is_read: true }))))
  }, [userId])

  const handleTap = (item: any) => {
    if (!item.is_read) {
      supabase.from('notifications').update({ is_read: true }).eq('id', item.id)
        .then(() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_read: true } : i)))
    }
    const d = item.data ?? {}
    const convId    = d.convId    ?? d.conversation_id
    const studentId = d.studentId ?? d.student_id
    if (item.type === 'message' && convId) {
      router.push(`/(main)/messages/${convId}`)
    } else if (item.type === 'briefing') {
      router.push('/(main)/briefing' as any)
    } else if (item.type === 'stage_update') {
      if (studentId) router.push(`/(main)/students/${studentId}`)
      else if (userRole === 'student') router.push('/(main)/my-profile')
      // staff with missing studentId: no-op to avoid landing on wrong screen
    } else if ((item.type === 'document' || item.type === 'visa') && studentId) {
      router.push(`/(main)/students/${studentId}`)
    } else if (item.type === 'document') {
      router.push('/(main)/documents')
    }
  }

  const unreadCount = items.filter(i => !i.is_read).length

  if (loading) return (
    <View style={[s.bg, { paddingTop: insets.top }]}>
      <View style={s.skeletonHeader}>
        <Skeleton height={28} width={28} radius={8} />
        <Skeleton height={18} width='45%' radius={4} />
      </View>
      <View style={{ padding: 16, gap: 10 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton height={44} width={44} radius={14} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton height={13} width='70%' radius={4} />
              <Skeleton height={11} width='50%' radius={4} />
            </View>
          </SkeletonCard>
        ))}
      </View>
    </View>
  )

  const sections = groupByDate(items)

  return (
    <View style={[s.bg, { paddingTop: insets.top }]}>
      <SectionList
        sections={sections}
        keyExtractor={n => n.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />
        }
        ListHeaderComponent={
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.back} accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={20} color={C.slate500} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>Notifications</Text>
              {unreadCount > 0 && <Text style={s.headerSub}>{unreadCount} unread</Text>}
            </View>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllRead} style={s.markAllBtn} activeOpacity={0.7}>
                <Text style={s.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="Nothing yet"
            subtitle="Messages, documents and visa updates land here"
          />
        }
        renderSectionHeader={({ section: { title } }) => (
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>{title}</Text>
            <View style={s.sectionLine} />
          </View>
        )}
        SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          const iconName = ICON_NAMES[item.type]    ?? 'information-circle-outline'
          const color    = NOTIF_COLORS[item.type]  ?? C.slate400
          const label    = TYPE_LABELS[item.type]   ?? 'Notification'
          return (
            <TouchableOpacity
              style={[s.card, !item.is_read && s.cardUnread]}
              onPress={() => handleTap(item)}
              activeOpacity={0.75}
            >
              {!item.is_read && <View style={[s.unreadBar, { backgroundColor: color }]} />}
              <View style={[s.iconCircle, { backgroundColor: color + '1A' }]}>
                <Ionicons name={iconName as any} size={20} color={color} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={s.cardTop}>
                  <Text style={s.title} numberOfLines={1}>{item.title}</Text>
                  {!item.is_read && <View style={s.dot} />}
                </View>
                {!!item.body && (
                  <Text style={s.body} numberOfLines={2}>{item.body}</Text>
                )}
                <View style={s.cardBottom}>
                  <Text style={s.time}>{timeAgo(item.created_at)}</Text>
                  <View style={[s.typePill, { backgroundColor: color + '18' }]}>
                    <Text style={[s.typeText, { color }]}>{label}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:            { flex: 1, backgroundColor: C.bg },
  skeletonHeader:{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, marginBottom: 2 },
  back:          { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
  headerTitle:   { fontSize: 20, fontWeight: '800', color: C.navy },
  headerSub:     { fontSize: 12, color: C.slate400, marginTop: 1 },
  markAllBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: C.blue + '14' },
  markAllText:   { fontSize: 12, fontWeight: '700', color: C.blue },
  sectionRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, marginTop: 8 },
  sectionLabel:  { fontSize: 10, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1.2 },
  sectionLine:   { flex: 1, height: 1, backgroundColor: C.slate200 },
  card:          {
    flexDirection: 'row', gap: 12, backgroundColor: C.white,
    borderRadius: 16, padding: 14, alignItems: 'flex-start',
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardUnread:    { borderWidth: 1, borderColor: C.slate200 },
  unreadBar:     { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  iconCircle:    { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTop:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title:         { flex: 1, fontSize: 14, fontWeight: '700', color: C.navy },
  body:          { fontSize: 12.5, color: C.slate500, lineHeight: 18 },
  cardBottom:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time:          { fontSize: 11, color: C.slate400 },
  typePill:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  typeText:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  dot:           { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.blue },
})
