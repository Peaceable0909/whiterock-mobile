import { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, Image, TextInput, KeyboardAvoidingView, Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { xhrUpload } from '@/lib/upload'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

type Post = {
  id: string; group_id: string; author_id: string
  content: string; created_at: string; media_url?: string | null
  author?: { name: string; avatar_url?: string }
}

type Group = { id: string; name: string; description?: string; avatar_url?: string | null }

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
  const [isStaff,    setIsStaff]    = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [myId,       setMyId]       = useState<string | null>(null)
  const [input,      setInput]      = useState('')
  const [pickedUri,  setPickedUri]  = useState<string | null>(null)
  const [posting,    setPosting]    = useState(false)

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

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setMyId(user.id)
      const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
      setIsStaff(!!data && data.role !== 'student')
    })
  }, [])

  const onRefresh = () => { setRefreshing(true); load() }

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permission needed', 'Please allow access to your photo library.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
    })
    if (result.canceled || !result.assets[0]) return
    setPickedUri(result.assets[0].uri)
  }

  const pickGroupAvatar = async () => {
    if (!isStaff) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permission needed', 'Please allow access to your photo library.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    })
    if (result.canceled || !result.assets[0] || !myId) return
    setUploadingAvatar(true)
    try {
      const uri = result.assets[0].uri
      const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase()
      const publicUrl = await xhrUpload('chat-media', `${myId}/group-avatar-${id}-${Date.now()}.${ext}`, uri, `avatar.${ext}`, `image/${ext}`)
      const { error } = await supabase.from('groups').update({ avatar_url: publicUrl }).eq('id', id)
      if (error) throw error
      setGroup(prev => prev ? { ...prev, avatar_url: publicUrl } : prev)
    } catch (err: any) {
      Alert.alert('Upload failed', err.message ?? 'Could not update the group photo.')
    }
    setUploadingAvatar(false)
  }

  const submitPost = async () => {
    if (!myId || posting || (!input.trim() && !pickedUri)) return
    setPosting(true)
    try {
      let mediaUrl: string | undefined
      if (pickedUri) {
        const ext = (pickedUri.split('.').pop() ?? 'jpg').toLowerCase()
        mediaUrl = await xhrUpload('chat-media', `${myId}/group-${id}-${Date.now()}.${ext}`, pickedUri, `post.${ext}`, `image/${ext}`)
      }
      const { error } = await supabase.from('group_posts').insert({
        group_id: id, author_id: myId, content: input.trim(), media_url: mediaUrl,
      })
      if (error) throw error
      setInput('')
      setPickedUri(null)
    } catch (err: any) {
      Alert.alert('Post failed', err.message ?? 'Could not publish this post.')
    }
    setPosting(false)
  }

  return (
    <KeyboardAvoidingView style={s.bg} behavior="padding" keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <TouchableOpacity
            onPress={pickGroupAvatar}
            disabled={!isStaff || uploadingAvatar}
            style={[s.hAvatar, { backgroundColor: color }]}
          >
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : group?.avatar_url ? (
              <Image source={{ uri: group.avatar_url }} style={s.hAvatarImg} />
            ) : (
              <Text style={s.hAvatarTxt}>{initials(group?.name ?? '?')}</Text>
            )}
          </TouchableOpacity>
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
                {!!item.content && <Text style={s.content}>{item.content}</Text>}
                {!!item.media_url && (
                  <Image source={{ uri: item.media_url }} style={s.postImage} resizeMode="cover" />
                )}
              </View>
            )
          }}
        />
      )}

      {isStaff && (
        <View style={[s.composer, { paddingBottom: insets.bottom + 10 }]}>
          {pickedUri && (
            <View style={s.previewWrap}>
              <Image source={{ uri: pickedUri }} style={s.previewImg} />
              <TouchableOpacity style={s.previewRemove} onPress={() => setPickedUri(null)}>
                <Ionicons name="close-circle" size={20} color={C.white} />
              </TouchableOpacity>
            </View>
          )}
          <View style={s.composerRow}>
            <TouchableOpacity onPress={pickImage} style={s.composerIconBtn} disabled={posting}>
              <Ionicons name="image-outline" size={22} color={C.slate500} />
            </TouchableOpacity>
            <TextInput
              style={s.composerInput}
              value={input}
              onChangeText={setInput}
              placeholder="Write a post…"
              placeholderTextColor={C.slate400}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[s.composerSendBtn, (posting || (!input.trim() && !pickedUri)) && s.composerSendBtnOff]}
              onPress={submitPost}
              disabled={posting || (!input.trim() && !pickedUri)}
            >
              {posting ? <ActivityIndicator size="small" color={C.white} /> : <Ionicons name="send" size={16} color={C.white} />}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:          { flex: 1, backgroundColor: 'transparent' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerInfo:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  hAvatar:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  hAvatarTxt:  { fontSize: 12, fontWeight: '800', color: '#fff' },
  hAvatarImg:  { width: 36, height: 36 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.navy },
  headerSub:   { fontSize: 11, color: C.slate500 },

  card:        { backgroundColor: C.white, borderRadius: 18, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  authorRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarTxt:   { fontSize: 12, fontWeight: '800', color: '#fff' },
  authorName:  { fontSize: 13, fontWeight: '700', color: C.navy },
  postTime:    { fontSize: 11, color: C.slate400 },
  content:     { fontSize: 14, color: C.navy, lineHeight: 22 },
  postImage:   { width: '100%', height: 200, borderRadius: 12, marginTop: 10, backgroundColor: C.slate100 },

  composer:      { borderTopWidth: 1, borderTopColor: C.slate200, paddingHorizontal: 12, paddingTop: 10, backgroundColor: C.white },
  composerRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  composerInput: { flex: 1, maxHeight: 100, fontSize: 14, color: C.navy, backgroundColor: C.slate100, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  composerSendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  composerSendBtnOff: { backgroundColor: C.slate300 },
  previewWrap:   { alignSelf: 'flex-start', marginBottom: 8 },
  previewImg:    { width: 64, height: 64, borderRadius: 10 },
  previewRemove: { position: 'absolute', top: -6, right: -6 },

  empty:       { alignItems: 'center', paddingTop: 60 },
  emptyIcon:   { width: 80, height: 80, borderRadius: 40, backgroundColor: C.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:  { fontSize: 18, fontWeight: '800', color: C.navy, marginBottom: 6 },
  emptySub:    { fontSize: 13, color: C.slate400, textAlign: 'center', paddingHorizontal: 32 },
})
