import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

type Audience = 'all' | 'students' | 'staff'

const AUDIENCE_OPTIONS: { key: Audience; label: string; desc: string; icon: string }[] = [
  { key: 'all',      label: 'Everyone',  desc: 'All users on the platform',          icon: 'globe-outline'   },
  { key: 'students', label: 'Students',  desc: 'All students only',                  icon: 'school-outline'  },
  { key: 'staff',    label: 'Staff',     desc: 'Agents, counselors and admins only', icon: 'briefcase-outline' },
]

export default function BroadcastScreen() {
  const C      = useColors()
  const s      = mkS(C)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [title,    setTitle]    = useState('')
  const [message,  setMessage]  = useState('')
  const [audience, setAudience] = useState<Audience>('all')
  const [sending,  setSending]  = useState(false)

  const handleSend = async () => {
    if (!title.trim())   { Alert.alert('Missing title',   'Enter a notification title.'); return }
    if (!message.trim()) { Alert.alert('Missing message', 'Enter the message body.'); return }

    Alert.alert(
      'Send Broadcast',
      `Send to "${AUDIENCE_OPTIONS.find(a => a.key === audience)?.label}"?\n\nThis will create a notification for every matching user.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSending(true)
            try {
              // Fetch target user IDs
              let query = supabase.from('users').select('id, role')
              if (audience === 'students') query = query.eq('role', 'student')
              else if (audience === 'staff') query = query.in('role', ['agent', 'counselor', 'admin'])
              const { data: users, error: fetchErr } = await query
              if (fetchErr) throw fetchErr

              const notifications = (users ?? []).map((u: any) => ({
                user_id: u.id,
                title:   title.trim(),
                message: message.trim(),
                type:    'broadcast',
                is_read: false,
              }))

              if (notifications.length === 0) {
                Alert.alert('No recipients', 'No users matched the selected audience.')
                return
              }

              const { error: insertErr } = await supabase.from('notifications').insert(notifications)
              if (insertErr) throw insertErr

              Alert.alert(
                'Sent!',
                `Notification delivered to ${notifications.length} user${notifications.length !== 1 ? 's' : ''}.`,
                [{ text: 'OK', onPress: () => router.back() }]
              )
              setTitle('')
              setMessage('')
            } catch (e: any) {
              Alert.alert('Error', e.message)
            } finally {
              setSending(false)
            }
          },
        },
      ]
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.bg, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={C.navy} />
          </TouchableOpacity>
          <Text style={s.title}>Broadcast Message</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom, gap: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Audience */}
          <View style={{ gap: 10 }}>
            <Text style={s.label}>AUDIENCE</Text>
            <View style={s.card}>
              {AUDIENCE_OPTIONS.map((opt, i) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.row, i < AUDIENCE_OPTIONS.length - 1 && s.border, audience === opt.key && s.rowSelected]}
                  onPress={() => setAudience(opt.key)}
                >
                  <View style={[s.iconBox, { backgroundColor: audience === opt.key ? C.blue + '18' : C.bg }]}>
                    <Ionicons name={opt.icon as any} size={18} color={audience === opt.key ? C.blue : C.slate400} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowLabel, audience === opt.key && { color: C.blue }]}>{opt.label}</Text>
                    <Text style={s.rowSub}>{opt.desc}</Text>
                  </View>
                  {audience === opt.key && <Ionicons name="checkmark-circle" size={20} color={C.blue} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Title */}
          <View style={{ gap: 8 }}>
            <Text style={s.label}>TITLE</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Important visa deadline update"
              placeholderTextColor={C.slate400}
              maxLength={80}
              returnKeyType="next"
            />
            <Text style={s.charCount}>{title.length}/80</Text>
          </View>

          {/* Message */}
          <View style={{ gap: 8 }}>
            <Text style={s.label}>MESSAGE</Text>
            <TextInput
              style={[s.input, s.textarea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Write your message here…"
              placeholderTextColor={C.slate400}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={s.charCount}>{message.length}/500</Text>
          </View>

          {/* Preview pill */}
          {(title || message) ? (
            <View style={s.preview}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="notifications" size={15} color={C.blue} />
                <Text style={s.previewOverline}>PREVIEW</Text>
              </View>
              {title ? <Text style={s.previewTitle}>{title}</Text> : null}
              {message ? <Text style={s.previewBody} numberOfLines={3}>{message}</Text> : null}
            </View>
          ) : null}

          {/* Send button */}
          <TouchableOpacity style={[s.sendBtn, (!title || !message) && s.sendBtnDisabled]} onPress={handleSend} disabled={sending || !title || !message}>
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="send" size={18} color="#fff" /><Text style={s.sendBtnText}>Send Broadcast</Text></>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:             { flex: 1, backgroundColor: C.bg },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  back:           { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  title:          { fontSize: 17, fontWeight: '800', color: C.navy },

  label:          { fontSize: 10, fontWeight: '800', color: C.slate400, letterSpacing: 1.2, textTransform: 'uppercase' },
  card:           { backgroundColor: C.white, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  row:            { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowSelected:    { backgroundColor: '#EFF6FF' },
  border:         { borderBottomWidth: 1, borderColor: C.slate100 },
  iconBox:        { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel:       { fontSize: 14, fontWeight: '700', color: C.navy },
  rowSub:         { fontSize: 11, color: C.slate400, marginTop: 1 },

  input:          { backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.navy, borderWidth: 1.5, borderColor: C.slate200 },
  textarea:       { minHeight: 120, paddingTop: 12 },
  charCount:      { fontSize: 11, color: C.slate400, textAlign: 'right' },

  preview:        { backgroundColor: C.white, borderRadius: 16, padding: 14, borderLeftWidth: 3, borderLeftColor: C.blue },
  previewOverline:{ fontSize: 10, fontWeight: '800', color: C.blue, letterSpacing: 1 },
  previewTitle:   { fontSize: 14, fontWeight: '800', color: C.navy, marginBottom: 4 },
  previewBody:    { fontSize: 13, color: C.slate500, lineHeight: 20 },

  sendBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.blue, borderRadius: 16, paddingVertical: 14, shadowColor: C.blue, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  sendBtnDisabled:{ backgroundColor: C.slate300, shadowOpacity: 0 },
  sendBtnText:    { fontSize: 15, fontWeight: '800', color: '#fff' },
})
