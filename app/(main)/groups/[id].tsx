import { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Image,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

type Post = {
  id: string; group_id: string; author_id: string
  content: string; created_at: string
  author?: { name: string; avatar_url?: string }
}

type Group = { id: string; name: string; description?: string }

const GROUP_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899']
function groupColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return GROUP_COLORS[Math.abs(h) % GROUP_COLORS.length]
}
function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
function formatTs(iso: string) {
  const d   = new Date(iso)
  const now = new Date()
  const ms  = now.getTime() - d.getTime()
  if (ms < 60000)  return 'Just now'
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function GroupDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>()
  const C        = useColors()
  const s        = mkS(C)
  const insets   = useSafeAreaInsets()
  const router   = useRouter()
  const chRef    = useRef<any>(null)
  const listRef  = useRef<FlatList>(null)

  const [group,      setGroup]      = useState<Group | null>(null)
  const [posts,      setPosts]      = useState<Post[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const color = id ? groupColor(id) : '#6366F1'

  const load = useCallback(async () => {
    if (!id) return
    const [{ data: grp }, { data: rawPosts }] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).single(),
      supabase.from('group_posts').select('*').eq('group_id', id).order('created_at', { ascending: false }).limit(50),
    ])
    setGroup(grp)

    if (rawPosts && rawPosts.length > 0) {
      const authorIds = [...new Set(rawPosts.map((p: any) => p.author_id))]
      const { data: users } = await supabase.from('users').select('id, name, avatar_url').in('id', authorIds)
      const userMap = new Map((users ?? []).map((u: any) => [u.id, u]))
      const enriched = rawPosts.map((p: any) => ({ ...p, author: userMap.get(p.author_id) })).reverse()
      setPosts(enriched)
    } else {
      setPosts([])
    }
    setLoading(false)
    setRefreshing(false)
  }, [id])

  useEffect(() => {
    load()

    // Realtime: new posts
    const ch = supabase.channel(`group-${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_posts',
        filter: `group_id=eq.${id}`,
      }, async payload => {
        const newPost = payload.new as any
        const { data: author } = await supabase.from('users').select('id, name, avatar_url').eq('id', newPost.author_id).single()
        setPosts(prev => [...prev, { ...newPost, author }])
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
      })
      .subscribe()
    chRef.current = ch

    return () => { supabase.removeChannel(ch) }
  }, [id, load])

  const onRefresh = () => { setRefreshing(true); load() }

  return (
    <View style={s.bg}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <View style={[s.hAvatar, { backgroundColor: color }]}>
            <Text style={s.hAvatarTxt}>{initials(group?.name ?? '?')}</Text>
          </View>
          <View>
            <Text style={s.headerTitle} numberOfLines={1}>{group?.name ?? 'Group'}</Text>
            {!!group?.description && (
              <Text style={s.headerSub} numberOfLines={1}>{group.description}</Text>
            )}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={p => p.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}><Ionicons name="chatbubbles-outline" size={40} color={C.slate300} /></View>
              <Text style={s.emptyTitle}>No posts yet</Text>
              <Text style={s.emptySub}>Posts from the team will appear here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const name = item.author?.name ?? 'Unknown'
            const ini  = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
            return (
              <View style={s.card}>
                <View style={s.authorRow}>
                  {item.author?.avatar_url ? (
                    <Image source={{ uri: item.author.avatar_url }} style={s.avatar} />
                  ) : (
                    <View style={[s.avatar, { backgroundColor: groupColor(item.author_id) }]}>
                      <Text style={s.avatarTxt}>{ini}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={s.authorName}>{name}</Text>
                    <Text style={s.postTime}>{formatTs(item.created_at)}</Text>
                  </View>
                </View>
                <Text style={s.content}>{item.content}</Text>
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:          { flex: 1, backgroundColor: C.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerInfo:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  hAvatar:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hAvatarTxt:  { fontSize: 12, fontWeight: '800', color: '#fff' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.navy },
  headerSub:   { fontSize: 11, color: C.slate500 },

  card:        { backgroundColor: C.white, borderRadius: 18, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  authorRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarTxt:   { fontSize: 12, fontWeight: '800', color: '#fff' },
  authorName:  { fontSize: 13, fontWeight: '700', color: C.navy },
  postTime:    { fontSize: 11, color: C.slate400 },
  content:     { fontSize: 14, color: C.navy, lineHeight: 22 },

  empty:       { alignItems: 'center', paddingTop: 60 },
  emptyIcon:   { width: 80, height: 80, borderRadius: 40, backgroundColor: C.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:  { fontSize: 18, fontWeight: '800', color: C.navy, marginBottom: 6 },
  emptySub:    { fontSize: 13, color: C.slate400, textAlign: 'center', paddingHorizontal: 32 },
})
