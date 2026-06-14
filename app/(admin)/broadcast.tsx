import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

const AUDIENCES = [
  { key: 'all_students', label: 'All Students', icon: 'school-outline',   color: C.blue,   roles: ['student']             },
  { key: 'all_staff',    label: 'All Staff',    icon: 'briefcase-outline', color: '#7C3AED', roles: ['counselor', 'agent'] },
  { key: 'all_users',    label: 'Everyone',     icon: 'globe-outline',    color: '#059669', roles: ['student', 'counselor', 'agent', 'admin'] },
] as const

export default function AdminBroadcastScreen() {
  const router = useRouter()
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [audience, setAudience] = useState<typeof AUDIENCES[number]['key']>('all_students')
  const [sending, setSending]   = useState(false)

  const send = async () => {
    if (!title.trim()) { Alert.alert('Title required'); return }
    if (!body.trim())  { Alert.alert('Message required'); return }

    const target = AUDIENCES.find(a => a.key === audience)!
    setSending(true)
    try {
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .in('role', target.roles as string[])

      if (!users?.length) {
        Alert.alert('No recipients', 'No users found for this audience.')
        setSending(false)
        return
      }

      const notifications = users.map(u => ({
        user_id: u.id, type: 'info', is_read: false,
        title: title.trim(), body: body.trim(),
      }))

      const { error } = await supabase.from('notifications').insert(notifications)
      if (error) throw error

      Alert.alert(
        'Broadcast Sent ✓',
        `Notification delivered to ${users.length} ${target.label.toLowerCase()}.`,
        [{ text: 'Done', onPress: () => router.back() }]
      )
      setTitle('')
      setBody('')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
    setSending(false)
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.navy} />
          </TouchableOpacity>
          <Text style={s.title}>Broadcast Notification</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          {/* Audience picker */}
          <Text style={s.label}>Send to</Text>
          <View style={s.audienceRow}>
            {AUDIENCES.map(a => {
              const active = audience === a.key
              return (
                <TouchableOpacity
                  key={a.key}
                  style={[s.audienceCard, active && { borderColor: a.color, backgroundColor: a.color + '10' }]}
                  onPress={() => setAudience(a.key)}
                >
                  <Ionicons name={a.icon as any} size={20} color={active ? a.color : C.slate400} />
                  <Text style={[s.audienceLabel, active && { color: a.color }]}>{a.label}</Text>
                  {active && <View style={[s.checkDot, { backgroundColor: a.color }]}><Ionicons name="checkmark" size={10} color={C.white} /></View>}
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Title */}
          <Text style={s.label}>Notification Title</Text>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Visa application deadline update"
            placeholderTextColor={C.slate400}
            maxLength={80}
          />
          <Text style={s.charCount}>{title.length}/80</Text>

          {/* Body */}
          <Text style={s.label}>Message</Text>
          <TextInput
            style={[s.input, s.textarea]}
            value={body}
            onChangeText={setBody}
            placeholder="Write your message here..."
            placeholderTextColor={C.slate400}
            multiline
            maxLength={300}
          />
          <Text style={s.charCount}>{body.length}/300</Text>

          {/* Preview */}
          {(title || body) && (
            <View style={s.previewCard}>
              <Text style={s.previewLabel}>Preview</Text>
              <View style={s.notifPreview}>
                <View style={s.notifIcon}><Ionicons name="megaphone-outline" size={18} color={C.white} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.notifTitle}>{title || 'Title'}</Text>
                  <Text style={s.notifBody} numberOfLines={2}>{body || 'Message body'}</Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[s.sendBtn, (!title.trim() || !body.trim() || sending) && { opacity: 0.5 }]}
            onPress={send}
            disabled={!title.trim() || !body.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color={C.white} size="small" />
              : <>
                  <Ionicons name="megaphone-outline" size={18} color={C.white} />
                  <Text style={s.sendBtnText}>Send Broadcast</Text>
                </>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  header:         { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:        { marginRight: 12 },
  title:          { fontSize: 18, fontWeight: '800', color: C.navy },
  label:          { fontSize: 11, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  audienceRow:    { flexDirection: 'row', gap: 10 },
  audienceCard:   { flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: C.slate200, position: 'relative' },
  audienceLabel:  { fontSize: 11, fontWeight: '700', color: C.slate400, textAlign: 'center' },
  checkDot:       { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  input:          { backgroundColor: C.white, borderRadius: 14, padding: 14, fontSize: 14, color: C.navy, borderWidth: 1, borderColor: C.slate200 },
  textarea:       { height: 100, textAlignVertical: 'top' },
  charCount:      { fontSize: 11, color: C.slate400, textAlign: 'right', marginTop: 4 },
  previewCard:    { backgroundColor: C.white, borderRadius: 14, padding: 14, marginTop: 16, borderWidth: 1, borderColor: C.slate200 },
  previewLabel:   { fontSize: 10, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  notifPreview:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notifIcon:      { width: 36, height: 36, borderRadius: 10, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  notifTitle:     { fontSize: 13, fontWeight: '700', color: C.navy },
  notifBody:      { fontSize: 12, color: C.slate400, marginTop: 2 },
  sendBtn:        { height: 52, backgroundColor: C.blue, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24, elevation: 2 },
  sendBtnText:    { fontSize: 15, fontWeight: '700', color: C.white },
})
