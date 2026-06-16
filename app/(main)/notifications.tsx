import { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'
import { Skeleton, SkeletonCard, EmptyState } from '@/components/Skeleton'

const ICON_NAMES: Record<string, string> = {
  message:   'chatbubble-outline',
  document:  'document-text-outline',
  interview: 'videocam-outline',
  visa:      'checkmark-circle-outline',
  success:   'checkmark-circle-outline',
  warning:   'warning-outline',
  error:     'warning-outline',
  info:      'information-circle-outline',
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationsScreen() {
  const C = useColors()
  const s = mkS(C)
  const router  = useRouter()
  const insets  = useSafeAreaInsets()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const COLORS: Record<string, string> = {
    message: C.blue, document: '#D97706', interview: '#9333EA',
    visa: '#16A34A', success: '#16A34A',
    warning: '#EA580C', error: '#DC2626', info: '#64748B',
  }

  useEffect(() => {
    let uid: string | null = null

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      uid = user.id
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setItems(data ?? [])
      setLoading(false)
      supabase.from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .then(() => {})
    }
    load()

    const sub = supabase.channel('notif-screen')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        payload => {
          const n = payload.new as any
          if (uid && n.user_id === uid) setItems(prev => [n, ...prev])
        })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  if (loading) return (
    <View style={[s.bg, { paddingTop: insets.top }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 12 }}>
        <Skeleton height={28} width={28} radius={8} />
        <Skeleton height={18} width={'45%'} radius={4} />
      </View>
      <View style={{ padding: 14, gap: 10 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton height={40} width={40} radius={12} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton height={13} width={'70%'} radius={4} />
              <Skeleton height={11} width={'50%'} radius={4} />
            </View>
          </SkeletonCard>
        ))}
      </View>
    </View>
  )

  return (
    <View style={[s.bg, { paddingTop: insets.top }]}>
      <FlatList
        data={items}
        keyExtractor={n => n.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 100 + insets.bottom }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.back} accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={20} color={C.slate500} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Notifications</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="Nothing yet"
            subtitle="Messages, documents and visa updates land here"
          />
        }
        renderItem={({ item }) => {
          const iconName = ICON_NAMES[item.type] ?? 'information-circle-outline'
          const color = COLORS[item.type] ?? C.slate400
          const handleTap = () => {
            const d = item.data ?? {}
            if (item.type === 'message' && d.convId) {
              router.push(`/(main)/messages/${d.convId}` as any)
            } else if ((item.type === 'document' || item.type === 'visa') && d.studentId) {
              router.push(`/(main)/students/${d.studentId}` as any)
            } else if (item.type === 'document') {
              router.push('/(main)/documents' as any)
            }
          }
          return (
            <TouchableOpacity
              style={[s.card, !item.is_read && s.cardUnread]}
              onPress={handleTap}
              activeOpacity={0.75}
            >
              <View style={[s.iconWrap, { backgroundColor: color + '1A' }]}>
                <Ionicons name={iconName as any} size={18} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{item.title}</Text>
                {!!item.body && <Text style={s.body} numberOfLines={2}>{item.body}</Text>}
                <Text style={s.time}>{timeAgo(item.created_at)}</Text>
              </View>
              {!item.is_read && <View style={s.dot} />}
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:         { flex: 1, backgroundColor: C.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  back:       { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  headerTitle:{ fontSize: 18, fontWeight: '800', color: C.navy },
  card:       { flexDirection: 'row', gap: 12, backgroundColor: C.white, borderRadius: 16, padding: 14, alignItems: 'flex-start', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  cardUnread: { borderWidth: 1, borderColor: C.blue + '33' },
  iconWrap:   { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 14, fontWeight: '700', color: C.navy },
  body:       { fontSize: 12.5, color: C.slate500, marginTop: 2, lineHeight: 18 },
  time:       { fontSize: 11, color: C.slate400, marginTop: 4 },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue, marginTop: 4 },
  empty:      { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.slate500 },
  emptySub:   { fontSize: 13, color: C.slate400 },
})
