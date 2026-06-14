import { useState, useRef } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

interface Msg { role: 'user' | 'assistant'; content: string }

const SUGGESTED = [
  { icon: '📄', label: 'Documents needed',    prompt: 'Which documents do I need for a UK student visa?' },
  { icon: '💷', label: 'Maintenance funds',   prompt: 'How much maintenance funds do I need for a UK student visa in London?' },
  { icon: '🛂', label: 'CAS process',         prompt: 'Can you explain the CAS letter process step by step?' },
  { icon: '📅', label: 'Visa timeline',       prompt: 'What is the typical visa decision timeline after submitting?' },
  { icon: '🎓', label: 'University match',    prompt: 'Which UK universities should I consider for a Business degree?' },
  { icon: '🩺', label: 'TB test',            prompt: 'Do I need a tuberculosis (TB) test for a UK student visa?' },
]

const API_BASE = 'https://whiterock-connect.vercel.app'

export default function AIScreen() {
  const [msgs, setMsgs]   = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef<FlatList>(null)

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const userMsg: Msg = { role: 'user', content: text.trim() }
    const next = [...msgs, userMsg]
    setMsgs(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/ai-chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: next }),
      })
      const { reply } = await res.json()
      setMsgs(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMsgs(prev => [...prev, { role: 'assistant', content: 'I am temporarily unavailable. Please try again.' }])
    } finally {
      setLoading(false)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }

  const isEmpty = msgs.length === 0

  return (
    <KeyboardAvoidingView style={s.bg} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.botAvatar}><Ionicons name="hardware-chip-outline" size={20} color={C.white} /></View>
        <View>
          <Text style={s.headerTitle}>WhiteRock AI</Text>
          <View style={s.onlineRow}><View style={s.dot} /><Text style={s.onlineTxt}>Always online · Powered by Qwen</Text></View>
        </View>
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
            <View style={s.sparkleBox}><Ionicons name="hardware-chip-outline" size={32} color={C.white} /></View>
            <Text style={s.emptyTitle}>Ask me anything</Text>
            <Text style={s.emptySub}>UK applications, visa docs, CAS, maintenance funds</Text>
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
              <Text style={[s.bubbleText, item.role === 'user' && s.bubbleTextMe]}>{item.content}</Text>
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

      {/* Quick chips after first message */}
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
        <TouchableOpacity style={[s.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
          onPress={() => send(input)} disabled={!input.trim() || loading}>
          {loading ? <ActivityIndicator color={C.white} size="small" /> : <Ionicons name="send-outline" size={16} color={C.white} />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  bg:            { flex: 1, backgroundColor: C.bg },
  header:        { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingTop: 8, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: C.slate100, gap: 12 },
  botAvatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: 14, fontWeight: '800', color: C.navy },
  onlineRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dot:           { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green400 },
  onlineTxt:     { fontSize: 11, color: C.slate400 },
  list:          { flex: 1 },
  listContent:   { padding: 14, paddingBottom: 8 },
  emptyState:    { alignItems: 'center', paddingTop: 20 },
  sparkleBox:    { width: 64, height: 64, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: C.blue, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  emptyTitle:    { fontSize: 20, fontWeight: '800', color: C.navy },
  emptySub:      { fontSize: 13, color: C.slate500, textAlign: 'center', marginTop: 6, marginBottom: 20, paddingHorizontal: 20 },
  suggestedHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  suggestedLabel:{ fontSize: 10, fontWeight: '800', color: C.slate400, letterSpacing: 1.5 },
  chips:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingHorizontal: 4 },
  chip:          { backgroundColor: C.white, borderWidth: 1, borderColor: C.slate200, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText:      { fontSize: 12, fontWeight: '600', color: C.slate600 },
  msgRow:        { flexDirection: 'row', marginBottom: 10, gap: 8 },
  msgMe:         { justifyContent: 'flex-end' },
  msgThem:       { justifyContent: 'flex-start', alignItems: 'flex-end' },
  botMini:       { width: 28, height: 28, borderRadius: 14, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  bubble:        { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe:      { backgroundColor: C.blue, borderBottomRightRadius: 4 },
  bubbleThem:    { backgroundColor: C.white, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  bubbleText:    { fontSize: 14, color: C.navy, lineHeight: 20 },
  bubbleTextMe:  { color: C.white },
  quickBar:      { backgroundColor: C.white, borderTopWidth: 1, borderColor: C.slate100, paddingVertical: 8 },
  quickChip:     { backgroundColor: C.bg, borderWidth: 1, borderColor: C.slate200, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  quickChipText: { fontSize: 11, fontWeight: '600', color: C.slate600 },
  inputBar:      { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.slate100 },
  input:         { flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.navy, maxHeight: 100, marginRight: 8 },
  sendBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
})
