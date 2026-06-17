import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

type Group = {
  id: string; name: string; description?: string
  created_at: string; created_by: string
  member_count?: number
}

const GROUP_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899']

function groupColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length]
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function GroupsScreen() {
  const C      = useColors()
  const s      = mkS(C)
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [groups,     setGroups]     = useState<Group[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('groups').select('*').order('created_at', { ascending: false })
    if (!data) { setLoading(false); setRefreshing(false); return }

    // Fetch member counts in parallel
    const withCounts = await Promise.all(data.map(async g => {
      const { count } = await supabase.from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', g.id)
      return { ...g, member_count: count ?? 0 }
    }))

    setGroups(withCounts)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = () => { setRefreshing(true); load() }

  return (
    <View style={s.bg}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Groups</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => g.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}><Ionicons name="people-circle-outline" size={40} color={C.slate300} /></View>
              <Text style={s.emptyTitle}>No groups yet</Text>
              <Text style={s.emptySub}>Groups created by your team will appear here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const color = groupColor(item.id)
            return (
              <TouchableOpacity
                style={s.card}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  router.push(`/(main)/groups/${item.id}` as any)
                }}
                activeOpacity={0.82}
              >
                <View style={[s.avatar, { backgroundColor: color }]}>
                  <Text style={s.avatarTxt}>{initials(item.name)}</Text>
                </View>
                <View style={s.cardBody}>
                  <Text style={s.cardTitle} numberOfLines={1}>{item.name}</Text>
                  {!!item.description && (
                    <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>
                  )}
                  <View style={s.cardFooter}>
                    <Ionicons name="people-outline" size={12} color={C.slate400} />
                    <Text style={s.membersTxt}>{item.member_count ?? 0} member{item.member_count !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.slate300} />
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:           { flex: 1, backgroundColor: C.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  header:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.navy },
  card:         { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 18, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  avatar:       { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt:    { fontSize: 16, fontWeight: '800', color: C.white },
  cardBody:     { flex: 1 },
  cardTitle:    { fontSize: 15, fontWeight: '700', color: C.navy, marginBottom: 3 },
  cardDesc:     { fontSize: 12, color: C.slate500, lineHeight: 17, marginBottom: 6 },
  cardFooter:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  membersTxt:   { fontSize: 11, color: C.slate400, fontWeight: '600' },
  empty:        { alignItems: 'center', paddingTop: 60 },
  emptyIcon:    { width: 80, height: 80, borderRadius: 40, backgroundColor: C.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:   { fontSize: 18, fontWeight: '800', color: C.navy, marginBottom: 6 },
  emptySub:     { fontSize: 13, color: C.slate400, textAlign: 'center', paddingHorizontal: 32 },
})
