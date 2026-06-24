import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Modal, Platform, ActivityIndicator, Image, Alert, AppState,
  useWindowDimensions, Vibration, Clipboard, Share
} from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { VideoView, useVideoPlayer } from 'expo-video'
import * as DocumentPicker from 'expo-document-picker'
import * as WebBrowser from 'expo-web-browser'
import { ImageModal } from '@/components/ImageModal'
import { Ionicons } from '@expo/vector-icons'
import { supabase, SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import { uploadVideo } from '@/lib/cloudinary'
import { setActiveConvId } from '@/lib/notifications'
import { getAiAvatarUrl } from '@/lib/aiConfig'
import { useColors, useTheme, BUBBLE_COLORS } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const PAGE_SIZE = 50
const API_BASE  = 'https://whiterock-connect.vercel.app'

const MSG_URL_RE = /https?:\/\/[^\s<>"']+/g

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const STICKERS  = ['🚀', '✨', '🔥', '🎉', '👏', '🙌', '💡', '✅', '🎓', '🇬🇧']

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:[^/?#]*[?&]v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m?.[1] ?? null
}

function MsgText({ text, isMe, C }: { text: string; isMe: boolean; C: ColorPalette }) {
  const textStyle = { fontSize: 14, color: isMe ? C.white : C.navy, lineHeight: 20, paddingHorizontal: 14, paddingVertical: 10 } as const
  const urlMatches = useMemo(() => [...text.matchAll(MSG_URL_RE)], [text])

  if (urlMatches.length === 0) {
    return <Text style={textStyle}>{text}</Text>
  }

  const parts: React.ReactNode[] = []
  let last = 0
  urlMatches.forEach((m, i) => {
    const idx = m.index ?? 0
    if (idx > last) parts.push(text.slice(last, idx))
    const url = m[0]
    parts.push(
      <Text key={`u${i}`}
        style={{ color: isMe ? 'rgba(255,255,255,0.9)' : C.blue, textDecorationLine: 'underline' }}
        onPress={() => WebBrowser.openBrowserAsync(url)}>
        {url}
      </Text>
    )
    last = idx + url.length
  })
  if (last < text.length) parts.push(text.slice(last))

  const ytId = urlMatches.map(m => getYouTubeId(m[0])).find(Boolean) ?? null

  return (
    <View>
      <Text style={textStyle}>{parts}</Text>
      {ytId ? (
        <TouchableOpacity
          onPress={() => WebBrowser.openBrowserAsync(`https://www.youtube.com/watch?v=${ytId}`)}
          activeOpacity={0.85}
          style={{ marginHorizontal: 10, marginBottom: 8, borderRadius: 10, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: isMe ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)' }}>
          <Image
            source={{ uri: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }}
            style={{ width: '100%', aspectRatio: 16 / 9 }}
            resizeMode="cover"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: isMe ? 'rgba(255,255,255,0.12)' : '#F8FAFC' }}>
            <Ionicons name="logo-youtube" size={14} color="#FF0000" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: isMe ? 'rgba(255,255,255,0.9)' : C.navy, flex: 1 }}>YouTube</Text>
            <Ionicons name="open-outline" size={11} color={isMe ? 'rgba(255,255,255,0.5)' : C.slate400} />
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const getInitials = (name: string) =>
  (name ?? '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?'

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const formatDateSep = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (msgDay.getTime() === today.getTime()) return 'Today'
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AudioMsg({ uri, isMe, C }: { uri: string; isMe: boolean; C: ColorPalette }) {
  const player = useVideoPlayer(uri, p => { p.loop = false })
  const [playing, setPlaying] = useState(false)
  const toggle = () => {
    if (playing) { player.pause(); setPlaying(false) }
    else { player.play(); setPlaying(true) }
  }
  return (
    <TouchableOpacity onPress={toggle} activeOpacity={0.8}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : C.blue + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={playing ? 'pause' : 'play'} size={16} color={isMe ? C.white : C.blue} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: isMe ? C.white : C.navy }}>
          {playing ? 'Playing…' : 'Voice note'}
        </Text>
        <Text style={{ fontSize: 11, marginTop: 2, color: isMe ? 'rgba(255,255,255,0.6)' : C.slate400 }}>
          {playing ? 'Tap to pause' : 'Tap to play'}
        </Text>
      </View>
      <Ionicons name="mic-outline" size={14} color={isMe ? 'rgba(255,255,255,0.5)' : C.slate400} />
    </TouchableOpacity>
  )
}

function VideoMsg({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => { p.loop = false })
  return (
    <VideoView
      player={player}
      style={{ width: 240, height: 160, borderRadius: 12, backgroundColor: '#000' }}
      nativeControls
      allowsFullscreen
      contentFit="contain"
    />
  )
}

export default function ChatScreen() {
  const { C, resolvedWallpaper, bubbleColor } = useTheme()
  const bubbleHex = BUBBLE_COLORS.find(b => b.id === bubbleColor)?.color ?? C.blue
  const ms = mkMS(C)
  const g = mkG(C)
  const insets = useSafeAreaInsets()
  const { id }   = useLocalSearchParams<{ id: string }>()
  const router   = useRouter()
  const listRef            = useRef<FlatList>(null)
  const scrollTimer        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialScrollDone  = useRef(false)
  const { width: screenW } = useWindowDimensions()
  const mediaW   = Math.min(screenW - 80, 280)

  const [msgs, setMsgs]         = useState<any[]>([])
  const [input, setInput]       = useState('')
  const [myId, setMyId]         = useState('')
  const [myRole, setMyRole]     = useState('student')
  const [sending, setSending]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [otherUser, setOther]   = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [hasMore, setHasMore]   = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [replyTo, setReplyTo]   = useState<any>(null)
  const [previewImg, setPreviewImg] = useState<string | null>(null)
  const [isTyping, setIsTyping]   = useState(false)
  const [aiAssist, setAiAssist] = useState(false)
  const [aiDrafting, setAiDrafting] = useState(false)
  const [profileModal, setProfileModal] = useState(false)
  const [aiEnabled, setAiEnabled]   = useState(true)
  const [aiAvatar, setAiAvatar]     = useState<string | null>(null)

  // Message actions
  const [menuVisible, setMenuVisible] = useState(false)
  const [selectedMsg, setSelectedMsg] = useState<any>(null)
  const [forwardModal, setForwardModal] = useState(false)
  const [conversations, setConversations] = useState<any[]>([])
  const [stickerModal, setStickerModal] = useState(false)

  const aiReplyingRef = useRef(false)
  const oldestTs   = useRef<string | null>(null)
  const latestMsgTs = useRef<string | null>(null)

  const msgsMap = useMemo(() => new Map(msgs.map(m => [m.id, m])), [msgs])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const appState = useRef(AppState.currentState)

  const scrollToEnd = useCallback(() => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    const animated = initialScrollDone.current
    scrollTimer.current = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated })
      initialScrollDone.current = true
      scrollTimer.current = null
    }, 120)
  }, [])

  const fetchMissed = useCallback(async () => {
    if (!latestMsgTs.current) return
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .gt('created_at', latestMsgTs.current)
      .order('created_at', { ascending: true })
    if (data?.length) {
      setMsgs(prev => {
        const ids = new Set(prev.map((m: any) => m.id))
        const fresh = (data as any[]).filter(m => !ids.has(m.id))
        if (!fresh.length) return prev
        latestMsgTs.current = fresh[fresh.length - 1].created_at
        return [...prev, ...fresh]
      })
      scrollToEnd()
    }
  }, [id, scrollToEnd])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setMyId(user.id)
      const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single()
      setMyRole(dbUser?.role ?? 'student')

      const { data: conv } = await supabase.from('conversations').select('*').eq('id', id).single()
      if (conv) {
        setAiEnabled(conv.ai_enabled !== false)
        const otherId = dbUser?.role === 'student'
          ? (conv.counselor_id || conv.agent_id)
          : conv.student_id
        if (otherId) {
          const { data: other } = await supabase.from('users').select('*').eq('id', otherId).single()
          setOther(other)
          if (other?.role === 'agent' || other?.role === 'counselor' || other?.role === 'admin') {
            setAiAvatar(getAiAvatarUrl(other.name))
          }
        }
      }

      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      const reversed = (messages ?? []).reverse()
      setMsgs(reversed)
      if (reversed.length > 0) {
        oldestTs.current = reversed[0].created_at
        latestMsgTs.current = reversed[reversed.length - 1].created_at
      }
      setHasMore((messages ?? []).length >= PAGE_SIZE)
      setLoading(false)
      scrollToEnd()

      const unreadField = dbUser?.role === 'student' ? 'unread_student' : 'unread_staff'
      await supabase.from('conversations').update({ [unreadField]: 0 }).eq('id', id)
    }
    load()

    const subscribe = () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      const ch = supabase.channel(`chat-${id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${id}`,
        }, (payload) => {
          const fresh = payload.new as any
          setMsgs(prev => {
            if (prev.some(m => m.id === fresh.id)) return prev
            latestMsgTs.current = fresh.created_at
            return [...prev, fresh]
          })
          if (fresh.sender_id !== myId) Vibration.vibrate(5)
          scrollToEnd()
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${id}`,
        }, (payload) => {
          const updated = payload.new as any
          setMsgs(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'conversations',
          filter: `id=eq.${id}`,
        }, (payload) => {
          const updated = payload.new as any
          if (typeof updated.ai_enabled === 'boolean') setAiEnabled(updated.ai_enabled)
        })
        .subscribe()
      channelRef.current = ch
    }

    subscribe()

    let otherUserId: string | null = null
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single()
      if (dbUser?.role === 'student') {
        const { data: conv } = await supabase.from('conversations').select('agent_id, counselor_id').eq('id', id).single()
        otherUserId = conv?.counselor_id ?? conv?.agent_id ?? null
      }
    })
    const onlineChannel = supabase.channel(`online-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' },
        payload => {
          const updated = payload.new as any
          if (updated.id === otherUserId) setOther((prev: any) => prev ? { ...prev, is_online: updated.is_online } : prev)
        })
      .subscribe()

    const appStateSub = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        subscribe()
        fetchMissed()
      }
      appState.current = nextState
    })

    return () => {
      appStateSub.remove()
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      supabase.removeChannel(onlineChannel)
    }
  }, [id, fetchMissed, myId, scrollToEnd])

  const loadOlderMessages = useCallback(async () => {
    if (loadingMore || !oldestTs.current) return
    setLoadingMore(true)
    const { data } = await supabase
      .from('messages').select('*')
      .eq('conversation_id', id)
      .lt('created_at', oldestTs.current)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    const older = (data ?? []).reverse()
    if (older.length > 0) {
      oldestTs.current = older[0].created_at
      setMsgs(prev => [...older, ...prev])
    }
    setHasMore((data ?? []).length >= PAGE_SIZE)
    setLoadingMore(false)
  }, [loadingMore, id])

  const draftWithAI = async () => {
    if (aiDrafting) return
    setAiDrafting(true)
    try {
      const { data: history } = await supabase
        .from('messages').select('sender_id, content, is_ai')
        .eq('conversation_id', id)
        .order('created_at', { ascending: false })
        .limit(10)
      const reversed = (history ?? []).reverse()
      const apiMessages = reversed.map(m => ({
        role: m.sender_id === myId ? 'assistant' : 'user',
        content: m.content,
      }))
      const res = await fetch('https://whiterock-connect.vercel.app/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a WhiteRock Connect counselor drafting a reply to a student viewing it on a mobile phone. Apply mobile-friendly formatting: short paragraphs separated by blank lines, **bold** for key values (fees, statuses, document names), bullet points with • for unordered lists, and numbered steps for sequences. Keep the reply professional, warm, and concise. Never send walls of text.' },
            ...apiMessages,
          ],
        }),
      })
      const { reply } = await res.json()
      if (reply) {
        const fixed = reply
          .replace(/([^.\n!?]):\s+(\d{1,2}\.\s)/g, '$1:\n\n$2')
          .replace(/([.!?])\s+(\d{1,2}\.\s)/g, '$1\n$2')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
        setInput(fixed)
      }
    } catch {
      Alert.alert('AI Draft', 'Could not generate a draft. Try again.')
    } finally {
      setAiDrafting(false)
    }
  }

  const sendMessage = async (overrideContent?: string) => {
    const content = overrideContent ?? input.trim()
    if (!content || sending) return
    Vibration.vibrate(10)
    if (!overrideContent) setInput('')
    setSending(true)
    const replyId = replyTo?.id ?? null
    setReplyTo(null)
    const { data: saved } = await supabase.from('messages').insert({
      conversation_id: id, sender_id: myId, content, type: 'text', is_ai: false,
      reply_to_id: replyId,
    }).select().single()
    if (saved) setMsgs(prev => [...prev, saved])
    const { data: convData } = await supabase.from('conversations').select('unread_staff, unread_student').eq('id', id).maybeSingle()
    await supabase.from('conversations').update({
      last_message: content, last_message_at: new Date().toISOString(),
      unread_staff: myRole === 'student' ? (convData?.unread_staff ?? 0) + 1 : 0,
      unread_student: myRole !== 'student' ? (convData?.unread_student ?? 0) + 1 : 0,
    }).eq('id', id)
    scrollToEnd()
    setSending(false)

    if (myRole === 'student' && saved && !otherUser?.is_online && !aiReplyingRef.current && aiEnabled && !overrideContent) {
      aiReplyingRef.current = true
      setIsTyping(true)
      scrollToEnd()
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(`${API_BASE}/api/ai-respond`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ conversationId: id, studentId: myId, message: content }),
        })
        if (res.ok) {
          const { aiMessages } = await res.json()
          if (aiMessages?.length) {
            setMsgs(prev => {
              const ids = new Set(prev.map((m: any) => m.id))
              const fresh = (aiMessages as any[]).filter(m => !ids.has(m.id))
              return fresh.length ? [...prev, ...fresh] : prev
            })
            scrollToEnd()
          }
        }
      } catch { /* silent */ }
      finally { setIsTyping(false); aiReplyingRef.current = false }
    }
  }

  const toggleAiEnabled = async () => {
    const next = !aiEnabled
    setAiEnabled(next)
    await supabase.from('conversations').update({ ai_enabled: next }).eq('id', id)
  }

  const pickAndSendMedia = async () => {
    let picked: DocumentPicker.DocumentPickerResult
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'video/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      })
    } catch { return }
    if (picked.canceled || !picked.assets?.[0]) return

    const asset    = picked.assets[0]
    const mimeType = asset.mimeType ?? 'application/octet-stream'
    const rawName  = asset.name ?? `file-${Date.now()}`
    const ext      = rawName.includes('.') ? rawName.split('.').pop()!.toLowerCase() : 'bin'
    const isImage  = mimeType.startsWith('image/')
    const isVideo  = mimeType.startsWith('video/')
    const kind: string = isVideo ? 'video' : isImage ? 'image' : 'file'

    setUploading(true)
    setUploadPct(0)
    try {
      let publicUrl: string
      if (isVideo) {
        publicUrl = await uploadVideo(asset.uri, mimeType, rawName, pct => setUploadPct(pct))
      } else {
        const path = `${myId}/${Date.now()}.${ext}`
        const { data: { session } } = await supabase.auth.getSession()
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/chat-media/${path}`)
          xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`)
          xhr.setRequestHeader('apikey', SUPABASE_ANON)
          xhr.upload.onprogress = e => {
            if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100))
          }
          xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText))
          xhr.onerror = () => reject(new Error('Upload failed'))
          const fd = new FormData()
          fd.append('file', { uri: asset.uri, name: rawName, type: mimeType } as any)
          xhr.send(fd)
        })
        publicUrl = supabase.storage.from('chat-media').getPublicUrl(path).data.publicUrl
      }

      const caption = isVideo ? '🎬 Video' : isImage ? '📷 Photo' : `📎 ${rawName}`
      const { data: saved } = await supabase.from('messages').insert({
        conversation_id: id, sender_id: myId,
        content: caption, type: kind, file_url: publicUrl,
        file_name: rawName, file_size: asset.size ?? null,
        is_ai: false,
      }).select().single()
      if (saved) setMsgs(prev => [...prev, saved])
      scrollToEnd()
    } catch (err) {
      Alert.alert('Upload failed', (err as Error).message)
    } finally {
      setUploading(false)
      setUploadPct(0)
    }
  }

  // --- Message Actions ---
  const deleteMessage = async () => {
    if (!selectedMsg) return
    Alert.alert('Delete Message', 'Delete this message for everyone?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          setMenuVisible(false)
          await supabase.from('messages').update({ deleted_at: new Date().toISOString(), content: 'This message was deleted' }).eq('id', selectedMsg.id)
        }
      }
    ])
  }

  const copyText = () => {
    if (!selectedMsg?.content) return
    Clipboard.setString(selectedMsg.content)
    setMenuVisible(false)
    Vibration.vibrate(5)
  }

  const shareMessage = async () => {
    if (!selectedMsg?.content) return
    try {
      await Share.share({ message: selectedMsg.content })
    } catch {}
    setMenuVisible(false)
  }

  const addReaction = async (emoji: string) => {
    if (!selectedMsg) return
    setMenuVisible(false)
    const existing = selectedMsg.reactions || {}
    const counts = existing[emoji] || 0
    const next = { ...existing, [emoji]: counts + 1 }
    await supabase.from('messages').update({ reactions: next }).eq('id', selectedMsg.id)
  }

  const openForward = async () => {
    setMenuVisible(false)
    const { data } = await supabase.from('conversations').select('id, student:student_id(name), agent:agent_id(name), counselor:counselor_id(name)').order('last_message_at', { ascending: false })
    setConversations(data || [])
    setForwardModal(true)
  }

  const forwardTo = async (convId: string) => {
    if (!selectedMsg) return
    setForwardModal(false)
    const { error } = await supabase.from('messages').insert({
      conversation_id: convId, sender_id: myId,
      content: selectedMsg.content, type: selectedMsg.type,
      file_url: selectedMsg.file_url, file_name: selectedMsg.file_name,
      file_size: selectedMsg.file_size, forwarded: true
    })
    if (error) Alert.alert('Forward Failed', error.message)
    else Alert.alert('Sent', 'Message forwarded successfully.')
  }

  const sendSticker = (sticker: string) => {
    setStickerModal(false)
    sendMessage(sticker)
  }

  const withSeparators = useMemo(() => {
    const result: any[] = []
    let lastDate = ''
    msgs.forEach(msg => {
      const d = new Date(msg.created_at).toDateString()
      if (d !== lastDate) {
        result.push({ _sep: true, date: msg.created_at, _id: `sep-${msg.created_at}` })
        lastDate = d
      }
      result.push(msg)
    })
    return result
  }, [msgs])

  const renderMessage = ({ item }: { item: any }) => {
    if (item._sep) {
      return (
        <View style={g.dateSep}>
          <View style={g.dateSepLine} />
          <Text style={g.dateSepText}>{formatDateSep(item.date)}</Text>
          <View style={g.dateSepLine} />
        </View>
      )
    }
    const isMe      = item.sender_id === myId && !item.is_ai
    const isDeleted = !!item.deleted_at
    const repliedMsg = item.reply_to_id ? msgsMap.get(item.reply_to_id) : null
    const reactions = Object.entries(item.reactions || {}) as [string, any][]

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={() => { if (!isDeleted) { Vibration.vibrate(20); setSelectedMsg(item); setMenuVisible(true) } }}
        delayLongPress={400}
      >
        <View style={[ms.row, isMe ? ms.rowMe : ms.rowThem]}>
        {!isMe && (
          item.is_ai ? (
            aiAvatar
              ? <Image source={{ uri: aiAvatar }} style={ms.avatarImg} />
              : <View style={ms.avatar}><Ionicons name="hardware-chip-outline" size={14} color={C.white} /></View>
          ) : (
            <View style={ms.avatar}>
              {otherUser?.avatar_url
                ? <Image source={{ uri: otherUser.avatar_url }} style={ms.avatarImg} />
                : <Text style={ms.avatarText}>{getInitials(otherUser?.name ?? '')}</Text>}
            </View>
          )
        )}

        <View style={[ms.bubbleWrap, isMe ? [ms.bubbleWrapMe, { backgroundColor: bubbleHex }] : ms.bubbleWrapThem]}>
          {item.reply_to_id && !isDeleted && (
            <View style={[ms.replyBar, isMe ? ms.replyBarMe : ms.replyBarThem]}>
              <Text style={[ms.replyLabel, isMe && { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>
                {repliedMsg?.content ?? '↩ Replied to a message'}
              </Text>
            </View>
          )}

          {item.forwarded && !isDeleted && (
            <Text style={[ms.forwardedLabel, !isMe && { color: C.slate400 }]}>↪ Forwarded</Text>
          )}

          {isDeleted ? (
            <View style={ms.deletedRow}>
              <Ionicons name="remove-circle-outline" size={12} color={isMe ? 'rgba(255,255,255,0.5)' : C.slate400} />
              <Text style={[ms.deletedText, isMe && ms.deletedTextMe]}>This message was deleted</Text>
            </View>
          ) : item.type === 'image' && item.file_url ? (
            <TouchableOpacity onPress={() => setPreviewImg(item.file_url)} activeOpacity={0.85}>
              <Image source={{ uri: item.file_url }} style={[ms.mediaImg, { width: mediaW, height: Math.round(mediaW * 0.75) }]} resizeMode="cover" />
            </TouchableOpacity>
          ) : item.type === 'video' && item.file_url ? (
            <VideoMsg uri={item.file_url} />
          ) : item.type === 'voice' && item.file_url ? (
            <AudioMsg uri={item.file_url} isMe={isMe} C={C} />
          ) : item.file_url ? (
            <TouchableOpacity onPress={() => {
              const url: string = item.file_url
              const isPdf = /\.(pdf)(\?|$)/i.test(url) || item.file_name?.toLowerCase().endsWith('.pdf')
              const isDoc = /\.(doc|docx|xls|xlsx|ppt|pptx)(\?|$)/i.test(url)
              WebBrowser.openBrowserAsync((isPdf || isDoc) ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}` : url)
            }} style={ms.fileRow} activeOpacity={0.8}>
              <View style={[ms.fileIcon, isMe && ms.fileIconMe]}>
                <Ionicons name={/\.(pdf)(\?|$)/i.test(item.file_url) || item.file_name?.toLowerCase().endsWith('.pdf') ? 'document-text-outline' : 'attach-outline'} size={16} color={isMe ? C.white : C.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ms.fileName, isMe && ms.textMe]} numberOfLines={1}>{item.file_name ?? 'File'}</Text>
                {item.file_size && <Text style={[ms.fileSize, isMe && { color: 'rgba(255,255,255,0.65)' }]}>{formatFileSize(item.file_size)}</Text>}
              </View>
              <Ionicons name="open-outline" size={13} color={isMe ? 'rgba(255,255,255,0.5)' : C.slate400} />
            </TouchableOpacity>
          ) : (
            <MsgText text={item.content ?? ''} isMe={isMe} C={C} />
          )}

          <View style={[ms.meta, isMe ? ms.metaMe : ms.metaThem]}>
            <Text style={[ms.time, isMe && ms.timeMe]}>
              {formatTime(item.created_at)}
              {item.edited_at && !isDeleted ? '  · edited' : ''}
            </Text>
            {isMe && !isDeleted && (
              item.is_read
                ? <Ionicons name="checkmark-done" size={13} color="#60A5FA" style={ms.tick} />
                : <Ionicons name="checkmark" size={13} color="rgba(255,255,255,0.55)" style={ms.tick} />
            )}
          </View>

          {reactions.length > 0 && (
            <View style={[ms.reactionsRow, isMe && { justifyContent: 'flex-end' }]}>
              {reactions.map(([emoji, count]) => (
                <View key={emoji} style={ms.reaction}>
                  <Text style={ms.reactionText}>{emoji} {count > 1 ? count : ''}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        </View>
      </TouchableOpacity>
    )
  }

  useFocusEffect(useCallback(() => { fetchMissed() }, [fetchMissed]))
  useFocusEffect(useCallback(() => {
    setActiveConvId(id)
    return () => setActiveConvId(null)
  }, [id]))

  if (loading) return <View style={g.center}><ActivityIndicator color={C.blue} size="large" /></View>

  const otherRole: string = (otherUser as any)?.role ?? ''
  const otherRoleCap = otherRole ? otherRole.charAt(0).toUpperCase() + otherRole.slice(1) : ''

  return (
    <>
    <ImageModal uri={previewImg} onClose={() => setPreviewImg(null)} />

    {/* Message Actions Menu */}
    <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
      <TouchableOpacity style={g.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
        <View style={g.menu}>
          <View style={g.reactionStrip}>
            {REACTIONS.map(emoji => (
              <TouchableOpacity key={emoji} style={g.reactionBtn} onPress={() => addReaction(emoji)}>
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={g.menuContent}>
            <TouchableOpacity style={g.menuItem} onPress={() => { setReplyTo(selectedMsg); setMenuVisible(false) }}>
              <Ionicons name="arrow-undo-outline" size={20} color={C.navy} />
              <Text style={g.menuItemText}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={g.menuItem} onPress={openForward}>
              <Ionicons name="arrow-redo-outline" size={20} color={C.navy} />
              <Text style={g.menuItemText}>Forward</Text>
            </TouchableOpacity>
            <TouchableOpacity style={g.menuItem} onPress={copyText}>
              <Ionicons name="copy-outline" size={20} color={C.navy} />
              <Text style={g.menuItemText}>Copy Text</Text>
            </TouchableOpacity>
            <TouchableOpacity style={g.menuItem} onPress={shareMessage}>
              <Ionicons name="share-outline" size={20} color={C.navy} />
              <Text style={g.menuItemText}>Share</Text>
            </TouchableOpacity>
            {selectedMsg?.sender_id === myId && (
              <TouchableOpacity style={g.menuItem} onPress={deleteMessage}>
                <Ionicons name="trash-outline" size={20} color={C.red500} />
                <Text style={[g.menuItemText, { color: C.red500 }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>

    {/* Forward Modal */}
    <Modal visible={forwardModal} transparent animationType="slide" onRequestClose={() => setForwardModal(false)}>
      <View style={g.modalOverlay}>
        <View style={g.forwardSheet}>
          <View style={g.modalHeader}>
            <Text style={g.modalTitle}>Forward to...</Text>
            <TouchableOpacity onPress={() => setForwardModal(false)}><Ionicons name="close" size={24} color={C.slate400} /></TouchableOpacity>
          </View>
          <FlatList
            data={conversations}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const other = myRole === 'student' ? (item.agent || item.counselor) : item.student
              return (
                <TouchableOpacity style={g.forwardRow} onPress={() => forwardTo(item.id)}>
                  <View style={g.avatarSmall}><Text style={g.avatarSmallText}>{getInitials(other?.name ?? '')}</Text></View>
                  <Text style={g.forwardName}>{other?.name ?? 'Contact'}</Text>
                  <Ionicons name="send" size={16} color={C.blue} />
                </TouchableOpacity>
              )
            }}
          />
        </View>
      </View>
    </Modal>

    {/* Sticker Modal */}
    <Modal visible={stickerModal} transparent animationType="slide" onRequestClose={() => setStickerModal(false)}>
      <TouchableOpacity style={g.modalOverlay} activeOpacity={1} onPress={() => setStickerModal(false)}>
        <View style={g.stickerSheet}>
          <Text style={g.stickerTitle}>Send a Sticker</Text>
          <View style={g.stickerGrid}>
            {STICKERS.map(s => (
              <TouchableOpacity key={s} style={g.stickerBtn} onPress={() => sendSticker(s)}>
                <Text style={{ fontSize: 40 }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>

    {/* Contact info bottom sheet */}
    <Modal transparent animationType="slide" visible={profileModal} onRequestClose={() => setProfileModal(false)}>
      <TouchableOpacity style={g.modalOverlay} activeOpacity={1} onPress={() => setProfileModal(false)}>
        <View style={[g.infoSheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={g.infoHandle} />
          {otherUser?.avatar_url ? (
            <TouchableOpacity style={g.infoAvatarWrap} activeOpacity={0.85} onPress={() => setPreviewImg(otherUser.avatar_url)}>
              <Image source={{ uri: otherUser.avatar_url }} style={g.infoAvatarImg} />
              <View style={g.infoAvatarHint}><Ionicons name="expand-outline" size={11} color={C.white} /></View>
            </TouchableOpacity>
          ) : (
            <View style={g.infoAvatarWrap}>
              <Text style={g.infoAvatarText}>{getInitials(otherUser?.name ?? 'WR')}</Text>
            </View>
          )}
          <Text style={g.infoName}>{otherUser?.name ?? 'Apply Support'}</Text>
          {otherRoleCap ? <Text style={g.infoRole}>{otherRoleCap}</Text> : null}
          <View style={[g.onlineRow, { justifyContent: 'center', marginTop: 8 }]}>
            <View style={[g.onlineDot, !otherUser?.is_online && { backgroundColor: C.slate300 }]} />
            <Text style={g.onlineTxt}>{otherUser?.is_online ? 'Online now' : 'Offline'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>

    <KeyboardAvoidingView style={g.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}>
      <View style={[g.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={g.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <TouchableOpacity style={g.headerInfo} activeOpacity={0.7} onPress={() => setProfileModal(true)}>
          <View style={g.headerAvatar}>
            {otherUser?.avatar_url
              ? <Image source={{ uri: otherUser.avatar_url }} style={g.headerAvatarImg} />
              : <Text style={g.headerAvatarText}>{getInitials(otherUser?.name ?? 'WR')}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={g.headerName} numberOfLines={1}>{myRole === 'student' ? (otherUser?.name ?? 'Apply Support') : (otherUser?.name ?? 'Student')}</Text>
            <View style={g.onlineRow}>
              {otherUser?.is_online && <View style={g.onlineDot} />}
              <Text style={g.onlineTxt}>{otherUser?.is_online ? 'Online' : (otherRoleCap || 'Tap for info')}</Text>
            </View>
          </View>
        </TouchableOpacity>
        {myRole !== 'student' && (
          <TouchableOpacity onPress={toggleAiEnabled} style={[g.headerAiBtn, !aiEnabled && g.headerAiBtnOff]} activeOpacity={0.75}>
            <Ionicons name={aiEnabled ? 'hardware-chip' : 'hardware-chip-outline'} size={17} color={aiEnabled ? C.blue : C.slate400} />
          </TouchableOpacity>
        )}
      </View>

      {!aiEnabled && (
        <View style={g.aiPausedBanner}>
          <Ionicons name="pause-circle-outline" size={13} color="#B45309" />
          <Text style={g.aiPausedText}>AI paused · you are talking directly</Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {resolvedWallpaper && 'uri' in resolvedWallpaper && (
          <Image source={{ uri: resolvedWallpaper.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
        <FlatList
          ref={listRef}
          data={withSeparators}
          keyExtractor={m => m._id ?? m.id}
          style={{ flex: 1, backgroundColor: resolvedWallpaper ? ('color' in resolvedWallpaper ? resolvedWallpaper.color : 'transparent') : C.bg }}
          contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
          renderItem={renderMessage}
          onContentSizeChange={scrollToEnd}
          ListHeaderComponent={hasMore ? (
            <TouchableOpacity onPress={loadOlderMessages} disabled={loadingMore} style={g.loadMoreBtn}>
              {loadingMore ? <ActivityIndicator size="small" color={C.blue} /> : <Text style={g.loadMoreTxt}>↑ Load older messages</Text>}
            </TouchableOpacity>
          ) : null}
        />
      </View>

      {isTyping && (
        <View style={g.typingBar}>
          <View style={g.typingBubble}>
            <View style={g.typingDots}>
              <View style={g.typingDot} /><View style={g.typingDot} /><View style={g.typingDot} />
            </View>
          </View>
          <Text style={g.onlineTxt}>AI is typing...</Text>
        </View>
      )}

      {uploading && (
        <View style={g.progressBar}>
          <View style={[g.progressFill, { width: `${uploadPct}%` }]} />
          <Text style={g.progressTxt}>Uploading... {uploadPct}%</Text>
        </View>
      )}

      {replyTo && (
        <View style={g.replyPreviewBar}>
          <Ionicons name="arrow-undo" size={14} color={C.blue} />
          <Text style={g.replyPreviewText} numberOfLines={1}>
            Replying to: {replyTo.content}
          </Text>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close-circle" size={18} color={C.slate400} />
          </TouchableOpacity>
        </View>
      )}

      {myRole !== 'student' && (
        <View style={g.aiBar}>
          <TouchableOpacity style={[g.aiToggle, aiAssist && g.aiToggleOn]} onPress={() => setAiAssist(!aiAssist)}>
            <Ionicons name="sparkles" size={13} color={aiAssist ? C.white : C.blue} />
            <Text style={[g.aiToggleText, aiAssist && { color: C.white }]}>AI Assist</Text>
          </TouchableOpacity>
          {aiAssist && (
            <TouchableOpacity style={g.aiDraftBtn} onPress={draftWithAI} disabled={aiDrafting}>
              {aiDrafting ? <ActivityIndicator size="small" color={C.blue} /> : <>
                <Ionicons name="create-outline" size={14} color={C.blue} />
                <Text style={g.aiDraftText}>Draft Reply</Text>
              </>}
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={[g.bar, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity onPress={() => setStickerModal(true)} style={g.attach}>
           <Ionicons name="happy-outline" size={20} color={C.slate500} />
        </TouchableOpacity>
        <TouchableOpacity onPress={pickAndSendMedia} disabled={uploading} style={g.attach}>
          <Ionicons name="attach-outline" size={20} color={uploading ? C.slate300 : C.slate500} />
        </TouchableOpacity>
        <TextInput
          style={g.input} value={input} onChangeText={setInput}
          placeholder="Type a message…" placeholderTextColor={C.slate400}
          multiline maxLength={2000}
        />
        <TouchableOpacity style={[g.sendBtn, (!input.trim() || sending) && g.sendBtnOff]} onPress={() => sendMessage()} disabled={!input.trim() || sending}>
          {sending ? <ActivityIndicator color={C.white} size="small" /> : <Ionicons name="send-outline" size={18} color={C.white} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </>
  )
}

const mkMS = (C: ColorPalette) => StyleSheet.create({
  row:           { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  rowMe:         { justifyContent: 'flex-end' },
  rowThem:       { justifyContent: 'flex-start' },
  avatar:        { width: 28, height: 28, borderRadius: 14, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 6, flexShrink: 0 },
  avatarImg:     { width: 28, height: 28, borderRadius: 14 },
  avatarText:    { fontSize: 10, fontWeight: '700', color: C.white },
  bubbleWrap:    { maxWidth: '78%', borderRadius: 20, overflow: 'hidden' },
  bubbleWrapMe:  { backgroundColor: C.blue, borderBottomRightRadius: 4 },
  bubbleWrapThem:{ backgroundColor: C.white, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  replyBar:      { borderLeftWidth: 3, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 10, paddingVertical: 6, marginBottom: 2 },
  replyBarThem:  { borderColor: C.blue, backgroundColor: C.blue + '10' },
  replyBarMe:    {},
  replyLabel:    { fontSize: 11, color: C.white, fontStyle: 'italic' },
  forwardedLabel:{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', paddingHorizontal: 14, paddingTop: 10 },
  text:          { fontSize: 14, color: C.navy, lineHeight: 20, paddingHorizontal: 14, paddingVertical: 10 },
  textMe:        { color: C.white },
  deletedRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  deletedText:   { fontSize: 13, color: C.slate400, fontStyle: 'italic' },
  deletedTextMe: { color: 'rgba(255,255,255,0.55)' },
  mediaImg:      { width: 220, height: 180, borderRadius: 14 },
  meta:          { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 6 },
  metaMe:        { justifyContent: 'flex-end', paddingRight: 10 },
  metaThem:      { paddingLeft: 12 },
  time:          { fontSize: 10, color: C.slate400 },
  timeMe:        { color: 'rgba(255,255,255,0.6)' },
  tick:          { marginLeft: 2 },
  fileRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  fileIcon:      { width: 36, height: 36, borderRadius: 10, backgroundColor: C.blue + '18', alignItems: 'center', justifyContent: 'center' },
  fileIconMe:    { backgroundColor: 'rgba(255,255,255,0.2)' },
  fileName:      { fontSize: 13, fontWeight: '600', color: C.navy },
  fileSize:      { fontSize: 11, color: C.slate400 },
  reactionsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: 12, paddingBottom: 8 },
  reaction:      { backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  reactionText:  { fontSize: 12 },
})

const mkG = (C: ColorPalette) => StyleSheet.create({
  flex:           { flex: 1, backgroundColor: C.bg },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  headerAvatar:   { width: 38, height: 38, borderRadius: 19, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 10, overflow: 'hidden' },
  headerAvatarImg:{ width: 38, height: 38, borderRadius: 19 },
  headerAvatarText:{ fontSize: 13, fontWeight: '700', color: C.white },
  headerName:     { fontSize: 15, fontWeight: '700', color: C.navy },
  onlineRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
  onlineDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  onlineTxt:      { fontSize: 11, color: C.slate500 },
  loadMoreBtn:    { alignSelf: 'center', marginVertical: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.slate200 },
  loadMoreTxt:    { fontSize: 12, color: C.blue, fontWeight: '600' },
  dateSep:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16, paddingHorizontal: 8 },
  dateSepLine:    { flex: 1, height: 1, backgroundColor: C.slate200 },
  dateSepText:    { fontSize: 11, fontWeight: '700', color: C.slate400 },
  typingBar:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  typingBubble:   { backgroundColor: C.white, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 8, elevation: 1 },
  typingDots:     { flexDirection: 'row', gap: 3 },
  typingDot:      { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.slate400 },
  progressBar:    { height: 4, backgroundColor: C.slate100, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  progressFill:   { height: 4, backgroundColor: C.blue, position: 'absolute', left: 0, top: 0 },
  progressTxt:    { fontSize: 10, color: C.slate400, marginLeft: 'auto' },
  replyPreviewBar:{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderColor: C.slate100 },
  replyPreviewText:{ flex: 1, fontSize: 13, color: C.slate500, fontStyle: 'italic' },
  aiBar:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.slate100 },
  aiToggle:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: C.blue },
  aiToggleOn:     { backgroundColor: C.blue },
  aiToggleText:   { fontSize: 12, fontWeight: '700', color: C.blue },
  aiDraftBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: C.blue + '15' },
  aiDraftText:    { fontSize: 12, fontWeight: '700', color: C.blue },
  bar:            { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: C.white, gap: 10 },
  attach:         { width: 42, height: 42, borderRadius: 21, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  input:          { flex: 1, backgroundColor: C.bg, borderRadius: 21, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: C.navy, maxHeight: 120 },
  sendBtn:        { width: 42, height: 42, borderRadius: 21, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff:     { opacity: 0.5 },
  headerInfo:     { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAiBtn:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.blue + '15' },
  headerAiBtnOff: { backgroundColor: C.slate100 },
  aiPausedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 16, backgroundColor: '#FEF3C7' },
  aiPausedText:   { fontSize: 12, color: '#92400E', fontWeight: '600' },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', alignItems: 'center' },
  infoSheet:      { backgroundColor: C.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, alignItems: 'center', width: '100%' },
  infoHandle:     { width: 40, height: 5, borderRadius: 3, backgroundColor: C.slate200, marginBottom: 20 },
  infoAvatarWrap: { width: 90, height: 90, borderRadius: 45, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  infoAvatarImg:  { width: 90, height: 90, borderRadius: 45 },
  infoAvatarText: { fontSize: 32, fontWeight: '800', color: C.white },
  infoAvatarHint: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 4 },
  infoName:       { fontSize: 22, fontWeight: '800', color: C.navy },
  infoRole:       { fontSize: 14, color: C.slate500, marginTop: 4 },
  menuOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  menu:           { width: '80%', backgroundColor: C.white, borderRadius: 24, overflow: 'hidden', elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20 },
  reactionStrip:  { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: C.slate100 },
  reactionBtn:    { padding: 4 },
  menuContent:    { padding: 8 },
  menuItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14 },
  menuItemText:   { fontSize: 15, fontWeight: '600', color: C.navy },
  forwardSheet:   { backgroundColor: C.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, width: '100%', maxHeight: '80%' },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:     { fontSize: 18, fontWeight: '800', color: C.navy },
  forwardRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: C.slate100, gap: 12 },
  avatarSmall:    { width: 36, height: 36, borderRadius: 18, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  avatarSmallText:{ fontSize: 12, fontWeight: '800', color: C.white },
  forwardName:    { flex: 1, fontSize: 15, fontWeight: '600', color: C.navy },
  stickerSheet:   { backgroundColor: C.white, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, width: '100%' },
  stickerTitle:   { fontSize: 18, fontWeight: '800', color: C.navy, marginBottom: 20, textAlign: 'center' },
  stickerGrid:    { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20 },
  stickerBtn:     { padding: 10 },
})
