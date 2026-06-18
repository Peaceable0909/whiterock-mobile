import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Vibration, Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { getAiAvatarUrl } from '@/lib/aiConfig'
import { useColors, useTheme } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MarkdownText } from '@/components/MarkdownText'

interface Msg { id?: string; role: 'user' | 'assistant'; content: string; created_at?: string }

const API_BASE = 'https://whiterock-connect.vercel.app'

// Post-processor: fixes inline numbered lists that the model outputs on one line.
// e.g. "steps: 1. Submit. 2. Upload. 3. Pay." → proper multi-line list
function fixAIFormatting(text: string): string {
  return text
    // "intro text: 1. First item" → add blank line before first list item
    .replace(/([^.\n!?]):\s+(\d{1,2}\.\s)/g, '$1:\n\n$2')
    // "Item text. 2. Next item" → put next item on its own line
    .replace(/([.!?])\s+(\d{1,2}\.\s)/g, '$1\n$2')
    // Collapse 3+ newlines to 2 (prevents excessive spacing)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function AIScreen() {
  const { C, resolvedWallpaper } = useTheme()
  const s = mkS(C)
  const insets = useSafeAreaInsets()
  const [msgs, setMsgs]         = useState<Msg[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [myId, setMyId]         = useState('')
  const [memory, setMemory]     = useState<{ summary?: string; facts?: any } | null>(null)
  const [profile, setProfile]   = useState<any>(null)
  const [aiAvatar, setAiAvatar] = useState<string | null>(null)
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
    getAiAvatarUrl().then(url => { if (url) setAiAvatar(url) })
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
      const systemPrompt = `You are the WhiteRock Connect AI — a friendly student support assistant for international education.
${context ? `\nSTUDENT CONTEXT:\n${context}\nPersonalise every response to this specific student.\n` : ''}
==============================================
MOBILE FORMATTING — FOLLOW THESE RULES EXACTLY
==============================================

RULE 1: SPACING
Always put a blank line between different ideas.

BAD:
Hello. Your application has been received. We are reviewing your documents. We will contact you soon.

GOOD:
Hello.

Your application has been received.

We are reviewing your documents.

We will contact you soon.

----------------------------------------------
RULE 2: PARAGRAPHS
Maximum 3 sentences per paragraph.
If your reply is longer than 4 sentences, break it into multiple paragraphs.

----------------------------------------------
RULE 3: NUMBERED LISTS — THIS IS CRITICAL
EVERY numbered item MUST be on its own separate line.
NEVER put two numbers on the same line.
NEVER write a list inside a paragraph.

BAD (NEVER do this):
Here are the steps: 1. Submit your application. 2. Upload your documents. 3. Pay the deposit. 4. Receive your offer letter.

GOOD (ALWAYS do this):
Here are the steps:

1. Submit your application.
2. Upload your documents.
3. Pay the deposit.
4. Receive your offer letter.

----------------------------------------------
RULE 4: BULLET POINTS
Use bullet points for items without a specific order.
Each bullet on its own line.

GOOD:
• Passport
• Academic transcript
• Personal statement
• CV

----------------------------------------------
RULE 5: BOLD
Use **bold** only for key values.

GOOD:
**Tuition Fee:** £11,800
**Application Status:** Under Review
**Required Document:** Passport

Never bold entire sentences.

----------------------------------------------
RULE 6: ITALIC
Use *italic* for notes and reminders only.

GOOD:
*Note: Processing times may vary.*

----------------------------------------------
RULE 7: STRIKETHROUGH
Use ~strikethrough~ only for corrections.

GOOD:
~January Intake~
March Intake

----------------------------------------------
RULE 8: CODE BLOCKS
Use triple backticks for IDs, codes, reference numbers.

GOOD:
\`\`\`
Application ID: WR-2026-00124
\`\`\`

----------------------------------------------
RULE 9: STATUS UPDATES
Always use this structure:

**Application Status**
Under Review

**Current Stage**
Document Verification

**Next Step**
Awaiting university decision

----------------------------------------------
RULE 10: LONG ANSWERS WITH MULTIPLE TOPICS
Use headings to separate sections.

GOOD:
**Tuition Fee**
£11,800

**Deposit**
£3,000

**Duration**
12 months

----------------------------------------------
GOLDEN RULE
Clarity is more important than sounding intelligent.
Simple, clean, well-spaced responses are always preferred.
Every response must be easy to read in under 10 seconds on a phone.

==============================================
KNOWLEDGE RULES
==============================================

Priority order:
1. Student data from context above
2. WhiteRock knowledge base
3. Partner university information
4. WhiteRock-approved visa/admissions information
5. General educational knowledge (only when safe)

USE training data only for: degree types, IELTS, SOP, academic terms, student visa concepts.

NEVER GUESS: tuition fees, entry requirements, visa rules, scholarships, deadlines, university policies.

WHEN UNKNOWN: Reply — "I don't have that information. Someone from WhiteRock will follow up with you shortly."

WhiteRock information always overrides training data. Never present training data as official policy.`

      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...next.map(m => ({ role: m.role, content: m.content })),
      ]

      const res = await fetch(`${API_BASE}/api/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })
      const { reply } = await res.json()
      const raw = reply ?? 'I am temporarily unavailable. Please try again.'
      const assistantContent = fixAIFormatting(raw)

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
    <KeyboardAvoidingView style={s.bg} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        {aiAvatar
          ? <Image source={{ uri: aiAvatar }} style={s.botAvatarImg} />
          : <View style={s.botAvatar}><Ionicons name="hardware-chip-outline" size={20} color={C.white} /></View>}
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Apply AI</Text>
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

      {/* Messages — wallpaper-aware */}
      {resolvedWallpaper && 'uri' in resolvedWallpaper && (
        <Image source={{ uri: resolvedWallpaper.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(_, i) => String(i)}
        style={[
          s.list,
          resolvedWallpaper
            ? { backgroundColor: 'color' in resolvedWallpaper ? resolvedWallpaper.color : 'transparent' }
            : undefined,
        ]}
        contentContainerStyle={s.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={isEmpty ? (
          <View style={s.emptyState}>
            {aiAvatar
              ? <Image source={{ uri: aiAvatar }} style={s.sparkleImg} />
              : <View style={s.sparkleBox}><Ionicons name="hardware-chip-outline" size={32} color={C.white} /></View>
            }
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
          </View>
        ) : null}
        renderItem={({ item }) => (
          <View style={[s.msgRow, item.role === 'user' ? s.msgMe : s.msgThem]}>
            {item.role === 'assistant' && (
              aiAvatar
                ? <Image source={{ uri: aiAvatar }} style={s.botMiniImg} />
                : <View style={s.botMini}><Ionicons name="hardware-chip-outline" size={14} color={C.white} /></View>
            )}
            <View style={[s.bubble, item.role === 'user' ? s.bubbleMe : s.bubbleThem]}>
              {item.role === 'assistant' ? (
                <MarkdownText text={item.content} C={C} />
              ) : (
                <Text style={[s.bubbleText, s.bubbleTextMe]}>{item.content}</Text>
              )}
            </View>
          </View>
        )}
        ListFooterComponent={loading ? (
          <View style={s.msgRow}>
            {aiAvatar
              ? <Image source={{ uri: aiAvatar }} style={s.botMiniImg} />
              : <View style={s.botMini}><Ionicons name="hardware-chip-outline" size={14} color={C.white} /></View>}
            <View style={[s.bubble, s.bubbleThem, { paddingVertical: 14 }]}>
              <ActivityIndicator color={C.blue} size="small" />
            </View>
          </View>
        ) : null}
      />

      {/* Input */}
      <View style={[s.inputBar, { paddingBottom: 12 + insets.bottom }]}>
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

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:             { flex: 1, backgroundColor: C.bg },
  header:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingTop: 8, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: C.slate100, gap: 12 },
  botAvatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  botAvatarImg:   { width: 40, height: 40, borderRadius: 20 },
  headerTitle:    { fontSize: 14, fontWeight: '800', color: C.navy },
  onlineRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green400 },
  onlineTxt:      { fontSize: 11, color: C.slate400 },
  clearBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  list:           { flex: 1 },
  listContent:    { padding: 14, paddingBottom: 8 },
  emptyState:     { alignItems: 'center', paddingTop: 20 },
  sparkleBox:     { width: 64, height: 64, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: C.blue, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  sparkleImg:     { width: 64, height: 64, borderRadius: 20, marginBottom: 12 },
  emptyTitle:     { fontSize: 20, fontWeight: '800', color: C.navy },
  emptySub:       { fontSize: 13, color: C.slate500, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },
  memoryChip:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: C.blue + '18', borderRadius: 12, padding: 10, marginTop: 12, marginHorizontal: 8, borderWidth: 1, borderColor: C.blue + '35' },
  memoryText:     { fontSize: 11, color: C.blue, flex: 1, lineHeight: 16 },
  msgRow:         { flexDirection: 'row', marginBottom: 10, gap: 8 },
  msgMe:          { justifyContent: 'flex-end' },
  msgThem:        { justifyContent: 'flex-start', alignItems: 'flex-start' },
  botMini:        { width: 28, height: 28, borderRadius: 14, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  botMiniImg:     { width: 28, height: 28, borderRadius: 14 },
  bubble:         { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe:       { backgroundColor: C.blue, borderBottomRightRadius: 4 },
  bubbleThem:     { backgroundColor: C.white, borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  bubbleText:     { fontSize: 14, color: C.navy, lineHeight: 20 },
  bubbleTextMe:   { color: C.white },
  inputBar:       { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.slate100 },
  input:          { flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.navy, maxHeight: 100, marginRight: 8 },
  sendBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
})
