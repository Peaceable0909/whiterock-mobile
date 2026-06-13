import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Linking, RefreshControl,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import {
  Bell, Heart, Bookmark, Share2, Eye, Megaphone,
  Award, GraduationCap, Globe, Tag, Calendar, Users, Mic, FileText,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  announcement: { bg: '#DBEAFE', text: '#1D4ED8' },
  scholarship:  { bg: '#DCFCE7', text: '#16A34A' },
  new_school:   { bg: '#F3E8FF', text: '#7C3AED' },
  visa_update:  { bg: '#FFEDD5', text: '#C2410C' },
  promotion:    { bg: '#FCE7F3', text: '#BE185D' },
  event:        { bg: '#CFFAFE', text: '#0E7490' },
  training:     { bg: '#FEF9C3', text: '#B45309' },
}

const CAT_ICONS: Record<string, React.ElementType> = {
  announcement: Megaphone,
  scholarship:  Award,
  new_school:   GraduationCap,
  visa_update:  Globe,
  promotion:    Tag,
  event:        Calendar,
  training:     Users,
}

const formatRelativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const getInitials = (name: string) =>
  (name ?? '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'WR'

export default function UpdatesScreen() {
  const [updates, setUpdates]   = useState<any[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [myId, setMyId]         = useState('')
  const [myRole, setMyRole]     = useState('student')
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    const [{ data: dbUser }, { data: data }, { data: likes }, { data: saves }] = await Promise.all([
      supabase.from('users').select('role').eq('id', user.id).single(),
      supabase.from('updates')
        .select('*, author:author_id(id, name, role, avatar_url)')
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(40),
      supabase.from('update_likes').select('update_id').eq('user_id', user.id),
      supabase.from('update_saves').select('update_id').eq('user_id', user.id),
    ])

    setMyRole(dbUser?.role ?? 'student')
    setUpdates(data ?? [])
    setLikedIds(new Set((likes ?? []).map((l: any) => l.update_id)))
    setSavedIds(new Set((saves ?? []).map((s: any) => s.update_id)))
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Track views when update becomes visible
  const trackView = useCallback(async (updateId: string) => {
    if (viewedIds.has(updateId) || !myId) return
    setViewedIds(prev => new Set([...prev, updateId]))
    await supabase.from('update_views').upsert(
      { update_id: updateId, user_id: myId },
      { onConflict: 'update_id,user_id', ignoreDuplicates: true },
    )
  }, [viewedIds, myId])

  const toggleLike = async (updateId: string) => {
    const isLiked = likedIds.has(updateId)
    setLikedIds(prev => {
      const next = new Set(prev)
      isLiked ? next.delete(updateId) : next.add(updateId)
      return next
    })
    setUpdates(prev => prev.map(u => u.id === updateId
      ? { ...u, likes_count: (u.likes_count ?? 0) + (isLiked ? -1 : 1) } : u))
    if (isLiked) {
      await supabase.from('update_likes').delete()
        .eq('update_id', updateId).eq('user_id', myId)
    } else {
      await supabase.from('update_likes').insert({ update_id: updateId, user_id: myId })
    }
  }

  const toggleSave = async (updateId: string) => {
    const isSaved = savedIds.has(updateId)
    setSavedIds(prev => {
      const next = new Set(prev)
      isSaved ? next.delete(updateId) : next.add(updateId)
      return next
    })
    if (isSaved) {
      await supabase.from('update_saves').delete()
        .eq('update_id', updateId).eq('user_id', myId)
    } else {
      await supabase.from('update_saves').insert({ update_id: updateId, user_id: myId })
    }
  }

  const shareUpdate = async (update: any) => {
    try {
      const text = `${update.title}\n\n${update.content ?? ''}`
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`)
    } catch { /* silent */ }
  }

  const renderUpdate = ({ item }: { item: any }) => {
    const CatIcon  = CAT_ICONS[item.category] ?? Megaphone
    const catColor = CAT_COLORS[item.category] ?? { bg: '#DBEAFE', text: '#1D4ED8' }
    const author   = item.author
    const isLiked  = likedIds.has(item.id)
    const isSaved  = savedIds.has(item.id)

    return (
      <View style={[c.card, item.is_pinned && c.pinned]}
        onLayout={() => trackView(item.id)}>
        {item.is_pinned && (
          <View style={c.pinnedBanner}>
            <Text style={c.pinnedText}>📌  Pinned</Text>
          </View>
        )}

        {/* Image */}
        {item.media_url && item.media_type === 'image' && (
          <TouchableOpacity onPress={() => Linking.openURL(item.media_url)} activeOpacity={0.9}>
            <Image source={{ uri: item.media_url }} style={c.media} resizeMode="cover" />
          </TouchableOpacity>
        )}

        {/* Video */}
        {item.media_url && item.media_type === 'video' && (
          <Video
            source={{ uri: item.media_url }}
            style={c.mediaVideo}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
          />
        )}

        {/* Audio */}
        {item.media_url && item.media_type === 'audio' && (
          <TouchableOpacity onPress={() => Linking.openURL(item.media_url)}
            style={c.audioRow} activeOpacity={0.85}>
            <View style={c.audioIcon}><Mic size={18} color={C.white} /></View>
            <Text style={c.audioLabel}>Audio · tap to play</Text>
          </TouchableOpacity>
        )}

        <View style={c.body}>
          {/* Author row */}
          <View style={c.authorRow}>
            <View style={c.authorAvatar}>
              {author?.avatar_url
                ? <Image source={{ uri: author.avatar_url }} style={c.authorAvatarImg} />
                : <Text style={c.authorInitials}>{getInitials(author?.name ?? 'WR')}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={c.authorName}>{author?.name ?? 'WhiteRock Connect'}</Text>
              <Text style={c.authorTime}>{formatRelativeTime(item.created_at)}</Text>
            </View>
            <View style={[c.catBadge, { backgroundColor: catColor.bg }]}>
              <CatIcon size={10} color={catColor.text} />
              <Text style={[c.catText, { color: catColor.text }]}>
                {(item.category ?? 'update').replace('_', ' ')}
              </Text>
            </View>
          </View>

          {/* Text content */}
          <Text style={c.title}>{item.title}</Text>
          {item.content ? <Text style={c.content} numberOfLines={4}>{item.content}</Text> : null}

          {/* Document link */}
          {item.media_url && item.media_type === 'document' && (
            <TouchableOpacity onPress={() => Linking.openURL(item.media_url)}
              style={c.docLink} activeOpacity={0.8}>
              <FileText size={14} color={C.blue} />
              <Text style={c.docLinkText}>View attached document</Text>
            </TouchableOpacity>
          )}

          {/* Actions */}
          <View style={c.actions}>
            <TouchableOpacity onPress={() => toggleLike(item.id)} style={c.actionBtn}>
              <Heart
                size={17}
                color={isLiked ? '#EF4444' : C.slate400}
                fill={isLiked ? '#EF4444' : 'none'}
              />
              <Text style={[c.actionCount, isLiked && { color: '#EF4444' }]}>
                {item.likes_count ?? 0}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => toggleSave(item.id)} style={c.actionBtn}>
              <Bookmark
                size={17}
                color={isSaved ? C.blue : C.slate400}
                fill={isSaved ? C.blue : 'none'}
              />
            </TouchableOpacity>

            {(item.views_count ?? 0) > 0 && (
              <View style={c.actionBtn}>
                <Eye size={14} color={C.slate400} />
                <Text style={c.actionCount}>{item.views_count}</Text>
              </View>
            )}

            <TouchableOpacity onPress={() => shareUpdate(item)} style={[c.actionBtn, { marginLeft: 'auto' }]}>
              <Share2 size={16} color={C.slate400} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  if (loading) return <View style={g.center}><ActivityIndicator color={C.blue} size="large" /></View>

  return (
    <View style={g.flex}>
      <FlatList
        data={updates}
        keyExtractor={u => u.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={C.blue} />}
        ListHeaderComponent={
          <View style={g.header}>
            <Bell size={20} color={C.blue} />
            <Text style={g.headerTitle}>Updates</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={g.empty}>
            <Bell size={44} color={C.slate200} />
            <Text style={g.emptyTitle}>No updates yet</Text>
            <Text style={g.emptySub}>Agency announcements will appear here</Text>
          </View>
        }
        renderItem={renderUpdate}
      />
    </View>
  )
}

const c = StyleSheet.create({
  card:          { backgroundColor: C.white, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginHorizontal: 14 },
  pinned:        { borderWidth: 2, borderColor: C.blue },
  pinnedBanner:  { backgroundColor: C.blue, paddingHorizontal: 12, paddingVertical: 5 },
  pinnedText:    { fontSize: 10, fontWeight: '700', color: C.white, letterSpacing: 0.3 },
  media:         { width: '100%', height: 220 },
  mediaVideo:    { width: '100%', height: 220, backgroundColor: '#000' },
  audioRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  audioIcon:     { width: 42, height: 42, borderRadius: 21, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  audioLabel:    { fontSize: 13, color: C.navy, fontWeight: '600' },
  body:          { padding: 14 },
  authorRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  authorAvatar:  { width: 34, height: 34, borderRadius: 17, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  authorAvatarImg:{ width: 34, height: 34, borderRadius: 17 },
  authorInitials:{ fontSize: 12, fontWeight: '700', color: C.white },
  authorName:    { fontSize: 12, fontWeight: '700', color: C.slate700 ?? C.navy },
  authorTime:    { fontSize: 10, color: C.slate400, marginTop: 1 },
  catBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  catText:       { fontSize: 9, fontWeight: '700', textTransform: 'capitalize' },
  title:         { fontSize: 15, fontWeight: '800', color: C.navy, marginBottom: 5, lineHeight: 21 },
  content:       { fontSize: 13, color: C.slate500, lineHeight: 20 },
  docLink:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  docLinkText:   { fontSize: 13, color: C.blue, fontWeight: '600' },
  actions:       { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: '#F1F5F9' },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount:   { fontSize: 12, color: C.slate400, fontWeight: '600' },
})

const g = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: '#F1F5F9' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.navy },
  empty:       { alignItems: 'center', paddingTop: 80, gap: 8, paddingHorizontal: 32 },
  emptyTitle:  { fontSize: 15, fontWeight: '700', color: C.slate500 },
  emptySub:    { fontSize: 13, color: C.slate400, textAlign: 'center' },
})
