import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Alert, Vibration,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

interface Msg { id?: string; role: 'user' | 'assistant'; content: string; created_at?: string }

const SUGGESTED = [
  { icon: '📄', label: 'Documents needed',    prompt: 'Which documents do I need for a UK student visa?' },
  { icon: '💷', label: 'Maintenance funds',   prompt: 'How much maintenance funds do I need for a UK student visa?' },
  { icon: '🛂', label: 'CAS process',         prompt: 'Can you explain the CAS letter process step by step?' },
  { icon: '📅', label: 'Visa timeline',       prompt: 'What is the typical visa decision timeline?' },
  { icon: '🎓', label: 'University match',    prompt: 'Which UK universities should I consider for a Business degree?' },
  { icon: '🩺', label: 'TB test',             prompt: 'Do I need a tuberculosis (TB) test for a UK student visa?' },
]

const API_BASE = 'https://whiterock-connect.vercel.app'

export default function AIScreen() {
  const [msgs, setMsgs]         = useState<Msg[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [myId, setMyId]         = useState('')
  const [memory, setMemory]     = useState<{ summary?: string; facts?: any } | null>(null)
  const [profile, setProfile]   = useState<any>(null)
  const listRef = useRef<FlatList>(null)

  // Load persistent history + student memory
  const init = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setInitializing(false); return }
    setMyId(user.id)

    const [{ data: history }, { data: mem }, { data: prof }] = await Promise.all([
      supabase.from('ai_chat_messages')
        .select('id, role, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(100),
      supabase.from('ai_student_memory')
        .select('summary, facts')
        .eq('student_id', user.id)
        .maybeSingle(),
      supabase.from('student_profiles')
        .select('stage, school, program_of_interest, intake, nationality')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    setMsgs((history ?? []) as Msg[])
    setMemory(mem)
    setProfile(prof)
    setInitializing(false)
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100)
  }, [])

  useEffect(() => { init() }, [init])

  const buildContext = () => {
    const parts: string[] = []
    if (profile) {
      parts.push(`Student profile: stage=${profile.stage ?? 'unknown'}, school=${profile.school ?? 'TBD'}, programme=${profile.program_of_interest ?? 'TBD'}, intake=${profile.intake ?? 'TBD'}, nationality=${profile.nationality ?? 'TBD'}.`)
    }
    if (memory?.summary) parts.push(`Known context: ${memory.summary}`)
    if (memory?.facts && Object.keys(memory.facts).length > 0) {
      parts.push(`Student facts: ${JSON.stringify(memory.facts)}`)
    }
    return parts.join(' ')
  }

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    Vibration.vibrate(10)

    const userMsg: Msg = { role: 'user', content: text.trim() }
    const next = [...msgs, userMsg]
    setMsgs(next)
    setInput('')
    setLoading(true)

    // Save user message to DB
    const { data: savedUser } = await supabase.from('ai_chat_messages').insert({
      user_id: myId, role: 'user', content: text.trim(),
    }).select('id').single()
    if (savedUser) userMsg.id = savedUser.id

    try {
      const context = buildContext()
      const apiMessages = [
        ...(context ? [{ role: 'system', content: `You are the WhiteRock Connect AI assistant. ${context} Always answer based on this student's specific situation.` }] : []),
        ...next.map(m => ({ role: m.role, content: m.content })),
      ]

      const res = await fetch(`${API_BASE}/api/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })
      const { reply } = await res.json()
      const assistantContent = reply ?? 'I am temporarily unavailable. Please try again.'

      const assistantMsg: Msg = { role: 'assistant', content: assistantContent }
      setMsgs(prev => [...prev, assistantMsg])

      // Save assistant response to DB
      const { data: savedAssist } = await supabase.from('ai_chat_messages').insert({
        user_id: myId, role: 'assistant', content: assistantContent,
      }).select('id').single()
      if (savedAssist) assistantMsg.id = savedAssist.id

    } catch {
      const errMsg: Msg = { role: 'assistant', content: 'I am temporarily unavailable. Please try again.' }
      setMsgs(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }

  const clearHistory = () => {
    Alert.alert('Clear AI History', 'This will delete all your AI conversations. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          await supabase.from('ai_chat_messages').delete().eq('user_id', myId)
          setMsgs([])
        },
      },
    ])
  }

  const isEmpty = msgs.length === 0

  if (initializing) {
    return <View style={s.bg}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.blue} size="large" /></View></View>
  }

  return (
    <KeyboardAvoidingView style={s.bg} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.botAvatar}><Ionicons name="hardware-chip-outline" size={20} color={C.white} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>WhiteRock AI</Text>
          <View style={s.onlineRow}>
            <View style={s.dot} />
            <Text style={s.onlineTxt}>
              {profile ? `Personalised for ${profile.stage ?? 'your'} stage` : 'Always online · Powered by Qwen'}
            </Text>
          </View>
        </View>
        {!isEmpty && (
          <TouchableOpacity onPress={clearHistory} style={s.clearBtn}>
            <Ionicons name="trash-outline" size={18} color={C.slate400} />
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(_, i) => String(i)}
        style={s.list}
        contentContainerStyle={s.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={isEmpty ? (
          <View style={s.emptyState}>
            <View style={s.sparkleBox}>
              <Ionicons name="hardware-chip-outline" size={32} color={C.white} />
            </View>
            <Text style={s.emptyTitle}>Ask me anything</Text>
            <Text style={s.emptySub}>
              {profile
                ? `I know your application is at the ${profile.stage ?? 'lead'} stage — ask me what to do next`
                : 'UK applications, visa docs, CAS, maintenance funds'}
            </Text>
            {memory?.summary && (
              <View style={s.memoryChip}>
                <Ionicons name="person-circle-outline" size={12} color={C.blue} />
                <Text style={s.memoryText} numberOfLines={2}>{memory.summary}</Text>
              </View>
            )}
            <View style={s.suggestedHeader}>
              <Ionicons name="flash-outline" size={12} color={C.blue} />
              <Text style={s.suggestedLabel}>SUGGESTED ACTIONS</Text>
            </View>
            <View style={s.chips}>
              {SUGGESTED.map(a => (
                <TouchableOpacity key={a.label} style={s.chip} onPress={() => send(a.prompt)}>
                  <Text style={s.chipText}>{a.icon} {a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <View style={[s.msgRow, item.role === 'user' ? s.msgMe : s.msgThem]}>
            {item.role === 'assistant' && (
              <View style={s.botMini}><Ionicons name="hardware-chip-outline" size={14} color={C.white} /></View>
            )}
            <View style={[s.bubble, item.role === 'user' ? s.bubbleMe : s.bubbleThem]}>
              <Text style={[s.bubbleText, item.role === 'user' && s.bubbleTextMe]}>
                {item.content}
              </Text>
            </View>
          </View>
        )}
        ListFooterComponent={loading ? (
          <View style={s.msgRow}>
            <View style={s.botMini}><Ionicons name="hardware-chip-outline" size={14} color={C.white} /></View>
            <View style={[s.bubble, s.bubbleThem, { paddingVertical: 14 }]}>
              <ActivityIndicator color={C.blue} size="small" />
            </View>
          </View>
        ) : null}
      />

      {/* Quick chips (after first message) */}
      {!isEmpty && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.quickBar} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
          {SUGGESTED.slice(0, 4).map(a => (
            <TouchableOpacity key={a.label} style={s.quickChip} onPress={() => send(a.prompt)}>
              <Text style={s.quickChipText}>{a.icon} {a.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={s.inputBar}>
        <TextInput
          style={s.input} value={input} onChangeText={setInput}
          placeholder="Ask anything about your UK application…"
          placeholderTextColor={C.slate400} multiline maxLength={500}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
        >
          {loading
            ? <ActivityIndicator color={C.white} size="small" />
            : <Ionicons name="send-outline" size={16} color={C.white} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  bg:             { flex: 1, backgroundColor: C.bg },
  header:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingTop: 8, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: C.slate100, gap: 12 },
  botAvatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { fontSize: 14, fontWeight: '800', color: C.navy },
  onlineRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green400 },
  onlineTxt:      { fontSize: 11, color: C.slate400 },
  clearBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  list:           { flex: 1 },
  listContent:    { padding: 14, paddingBottom: 8 },
  emptyState:     { alignItems: 'center', paddingTop: 20 },
  sparkleBox:     { width: 64, height: 64, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: C.blue, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  emptyTitle:     { fontSize: 20, fontWeight: '800', color: C.navy },
  emptySub:       { fontSize: 13, color: C.slate500, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },
  memoryChip:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 10, marginTop: 12, marginHorizontal: 8, borderWidth: 1, borderColor: '#DBEAFE' },
  memoryText:     { fontSize: 11, color: C.blue, flex: 1, lineHeight: 16 },
  suggestedHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, marginBottom: 10 },
  suggestedLabel: { fontSize: 10, fontWeight: '800', color: C.slate400, letterSpacing: 1.5 },
  chips:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingHorizontal: 4 },
  chip:           { backgroundColor: C.white, borderWidth: 1, borderColor: C.slate200, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText:       { fontSize: 12, fontWeight: '600', color: C.slate600 },
  msgRow:         { flexDirection: 'row', marginBottom: 10, gap: 8 },
  msgMe:          { justifyContent: 'flex-end' },
  msgThem:        { justifyContent: 'flex-start', alignItems: 'flex-start' },
  botMini:        { width: 28, height: 28, borderRadius: 14, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  bubble:         { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe:       { backgroundColor: C.blue, borderBottomRightRadius: 4 },
  bubbleThem:     { backgroundColor: C.white, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  bubbleText:     { fontSize: 14, color: C.navy, lineHeight: 20 },
  bubbleTextMe:   { color: C.white },
  quickBar:       { backgroundColor: C.white, borderTopWidth: 1, borderColor: C.slate100, paddingVertical: 8 },
  quickChip:      { backgroundColor: C.bg, borderWidth: 1, borderColor: C.slate200, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  quickChipText:  { fontSize: 11, fontWeight: '600', color: C.slate600 },
  inputBar:       { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.slate100 },
  input:          { flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.navy, maxHeight: 100, marginRight: 8 },
  sendBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
})
