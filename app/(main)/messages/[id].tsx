import { useEffect, useState, useRef } from 'react'
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, Send, Bot } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

export default function ChatScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>()
  const router  = useRouter()
  const [msgs, setMsgs]       = useState<any[]>([])
  const [input, setInput]     = useState('')
  const [myId, setMyId]       = useState('')
  const [sending, setSending] = useState(false)
  const [otherUser, setOther] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setMyId(user.id)

      const { data: conv } = await supabase.from('conversations')
        .select('*, student:student_id(id,name,avatar_url,is_online), agent:agent_id(id,name,avatar_url), counselor:counselor_id(id,name,avatar_url)')
        .eq('id', id).single()

      const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single()
      const role = dbUser?.role ?? 'student'
      if (conv) {
        const other = role === 'student' ? (conv.agent || conv.counselor) : conv.student
        setOther(other)
      }

      const { data: history } = await supabase.from('messages')
        .select('*').eq('conversation_id', id).order('created_at', { ascending: true })
      setMsgs(history ?? [])
      setLoading(false)

      // Mark as read
      const col = role === 'student' ? 'unread_student' : 'unread_staff'
      await supabase.from('conversations').update({ [col]: 0 }).eq('id', id)
    }
    load()

    // Realtime subscription
    const sub = supabase.channel(`chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        payload => setMsgs(prev => [...prev, payload.new]))
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [id])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const content = input.trim()
    setInput('')
    setSending(true)
    await supabase.from('messages').insert({
      conversation_id: id, sender_id: myId, content, message_type: 'text',
    })
    await supabase.from('conversations').update({ last_message: content, last_message_at: new Date().toISOString() }).eq('id', id)
    setSending(false)
  }

  const getInitials = (name: string) => name?.split(' ').map((n:string) => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>

  return (
    <KeyboardAvoidingView style={s.bg} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={22} color={C.navy} />
        </TouchableOpacity>
        <View style={s.avatar}><Text style={s.avatarText}>{getInitials(otherUser?.name ?? '')}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerName}>{otherUser?.name ?? 'Chat'}</Text>
          <View style={s.onlineRow}><View style={s.dot} /><Text style={s.onlineText}>Online</Text></View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef} data={msgs} keyExtractor={m => m.id}
        style={s.list} contentContainerStyle={s.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMe = item.sender_id === myId
          return (
            <View style={[s.msgWrap, isMe ? s.msgWrapMe : s.msgWrapThem]}>
              {!isMe && <View style={s.msgAvatar}><Text style={s.msgAvatarText}>{getInitials(otherUser?.name ?? '')}</Text></View>}
              <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
                <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>{item.content}</Text>
              </View>
            </View>
          )
        }}
      />

      {/* Input */}
      <View style={s.inputBar}>
        <TextInput
          style={s.input} value={input} onChangeText={setInput}
          placeholder="Type a message…" placeholderTextColor={C.slate400}
          multiline maxLength={500}
          onSubmitEditing={sendMessage} blurOnSubmit={false}
        />
        <TouchableOpacity style={[s.sendBtn, !input.trim() && s.sendBtnDisabled]} onPress={sendMessage} disabled={!input.trim() || sending}>
          {sending ? <ActivityIndicator color={C.white} size="small" /> : <Send size={18} color={C.white} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  bg:           { flex: 1, backgroundColor: C.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  avatar:       { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarText:   { color: C.white, fontWeight: '700', fontSize: 14 },
  headerName:   { fontSize: 15, fontWeight: '700', color: C.navy },
  onlineRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green400, marginRight: 4 },
  onlineText:   { fontSize: 11, color: C.slate500 },
  list:         { flex: 1 },
  listContent:  { padding: 14, paddingBottom: 8 },
  msgWrap:      { flexDirection: 'row', marginBottom: 10 },
  msgWrapMe:    { justifyContent: 'flex-end' },
  msgWrapThem:  { justifyContent: 'flex-start' },
  msgAvatar:    { width: 28, height: 28, borderRadius: 14, backgroundColor: C.slate200, alignItems: 'center', justifyContent: 'center', marginRight: 6, alignSelf: 'flex-end' },
  msgAvatarText:{ fontSize: 11, fontWeight: '700', color: C.slate600 },
  bubble:       { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe:     { backgroundColor: C.blue, borderBottomRightRadius: 4 },
  bubbleThem:   { backgroundColor: C.white, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  bubbleText:   { fontSize: 14, color: C.navy, lineHeight: 20 },
  bubbleTextMe: { color: C.white },
  inputBar:     { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.slate100 },
  input:        { flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.navy, maxHeight: 100, marginRight: 8 },
  sendBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
})
