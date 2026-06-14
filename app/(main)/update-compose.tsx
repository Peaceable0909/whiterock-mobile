import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView,
  Platform, Switch,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

const CATEGORIES = [
  { key: 'announcement', label: 'Announce',   color: '#1D4ED8', icon: 'megaphone-outline'      },
  { key: 'visa_update',  label: 'Visa',       color: '#7C3AED', icon: 'document-text-outline'  },
  { key: 'scholarship',  label: 'Scholarship',color: '#059669', icon: 'ribbon-outline'          },
  { key: 'new_school',   label: 'School',     color: '#EC4899', icon: 'school-outline'          },
  { key: 'event',        label: 'Event',      color: '#F59E0B', icon: 'calendar-outline'        },
  { key: 'training',     label: 'Training',   color: '#0E7490', icon: 'people-outline'          },
  { key: 'promotion',    label: 'Promo',      color: '#BE185D', icon: 'pricetag-outline'        },
] as const

const AUDIENCES = [
  { key: 'student',   label: 'Students Only'   },
  { key: 'all',       label: 'Everyone'        },
] as const

export default function UpdateComposeScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ editId?: string }>()
  const isEdit = !!params.editId

  const [title, setTitle]           = useState('')
  const [body, setBody]             = useState('')
  const [category, setCategory]     = useState<typeof CATEGORIES[number]['key']>('announcement')
  const [audience, setAudience]     = useState<'student' | 'all'>('all')
  const [isPinned, setIsPinned]     = useState(false)
  const [saving, setSaving]         = useState(false)

  const publish = async () => {
    if (!title.trim()) { Alert.alert('Title required'); return }
    if (!body.trim())  { Alert.alert('Body required');  return }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const targetRoles = audience === 'student' ? ['student'] : ['student', 'counselor', 'agent', 'admin']

      const payload = {
        title:        title.trim(),
        content:      body.trim(),
        category,
        is_pinned:    isPinned,
        target_roles: targetRoles,
        author_id:    user.id,
      }

      if (isEdit) {
        const { error } = await supabase.from('updates').update(payload).eq('id', params.editId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('updates').insert(payload)
        if (error) throw error
      }

      router.back()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
    setSaving(false)
  }

  const cat = CATEGORIES.find(c => c.key === category)!

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="close" size={22} color={C.navy} />
          </TouchableOpacity>
          <Text style={s.title}>{isEdit ? 'Edit Update' : 'New Update'}</Text>
          <TouchableOpacity
            style={[s.publishBtn, (!title.trim() || !body.trim() || saving) && { opacity: 0.4 }]}
            onPress={publish}
            disabled={!title.trim() || !body.trim() || saving}
          >
            {saving
              ? <ActivityIndicator color={C.white} size="small" />
              : <Text style={s.publishText}>Publish</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          {/* Category picker */}
          <Text style={s.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {CATEGORIES.map(c => {
              const active = category === c.key
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[s.catChip, active && { backgroundColor: c.color, borderColor: c.color }]}
                  onPress={() => setCategory(c.key)}
                >
                  <Ionicons name={c.icon as any} size={14} color={active ? C.white : C.slate400} />
                  <Text style={[s.catLabel, active && { color: C.white }]}>{c.label}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {/* Audience */}
          <Text style={s.label}>Audience</Text>
          <View style={s.audienceRow}>
            {AUDIENCES.map(a => {
              const active = audience === a.key
              return (
                <TouchableOpacity
                  key={a.key}
                  style={[s.audienceBtn, active && { backgroundColor: C.blue, borderColor: C.blue }]}
                  onPress={() => setAudience(a.key)}
                >
                  <Text style={[s.audienceBtnText, active && { color: C.white }]}>{a.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Title */}
          <Text style={s.label}>Title</Text>
          <TextInput
            style={s.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Update title..."
            placeholderTextColor={C.slate400}
            maxLength={100}
            returnKeyType="next"
          />
          <Text style={s.charCount}>{title.length}/100</Text>

          {/* Body */}
          <Text style={s.label}>Body</Text>
          <TextInput
            style={[s.input, s.bodyInput]}
            value={body}
            onChangeText={setBody}
            placeholder="Write your update here..."
            placeholderTextColor={C.slate400}
            multiline
            maxLength={1000}
          />
          <Text style={s.charCount}>{body.length}/1000</Text>

          {/* Pin toggle */}
          <View style={s.pinRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.pinLabel}>Pin to top</Text>
              <Text style={s.pinSub}>Pinned updates appear first in the feed</Text>
            </View>
            <Switch
              value={isPinned}
              onValueChange={setIsPinned}
              trackColor={{ true: C.blue, false: C.slate200 }}
              thumbColor={C.white}
            />
          </View>

          {/* Live Preview */}
          {(title || body) && (
            <View style={s.previewSection}>
              <Text style={s.previewLabel}>Preview</Text>
              <View style={s.previewCard}>
                {isPinned && (
                  <View style={s.pinnedBar}>
                    <Ionicons name="pin" size={10} color="#7C3AED" />
                    <Text style={s.pinnedText}>Pinned</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={[s.catDot, { backgroundColor: cat.color + '20' }]}>
                    <Ionicons name={cat.icon as any} size={12} color={cat.color} />
                  </View>
                  <Text style={[s.catTag, { color: cat.color }]}>{cat.label}</Text>
                </View>
                <Text style={s.previewTitle}>{title || 'Update title'}</Text>
                <Text style={s.previewBody} numberOfLines={3}>{body || 'Update body text...'}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  header:        { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:       { marginRight: 12 },
  title:         { flex: 1, fontSize: 17, fontWeight: '800', color: C.navy },
  publishBtn:    { backgroundColor: C.blue, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  publishText:   { fontSize: 13, fontWeight: '700', color: C.white },
  label:         { fontSize: 11, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 20 },
  catChip:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.slate200, backgroundColor: C.white },
  catLabel:      { fontSize: 12, fontWeight: '700', color: C.slate400 },
  audienceRow:   { flexDirection: 'row', gap: 10 },
  audienceBtn:   { flex: 1, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: C.slate200, backgroundColor: C.white, alignItems: 'center' },
  audienceBtnText: { fontSize: 13, fontWeight: '700', color: C.slate500 },
  titleInput:    { backgroundColor: C.white, borderRadius: 14, padding: 14, fontSize: 16, fontWeight: '700', color: C.navy, borderWidth: 1, borderColor: C.slate200 },
  input:         { backgroundColor: C.white, borderRadius: 14, padding: 14, fontSize: 14, color: C.navy, borderWidth: 1, borderColor: C.slate200 },
  bodyInput:     { height: 150, textAlignVertical: 'top' },
  charCount:     { fontSize: 11, color: C.slate400, textAlign: 'right', marginTop: 4 },
  pinRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 14, padding: 16, marginTop: 20, borderWidth: 1, borderColor: C.slate200 },
  pinLabel:      { fontSize: 14, fontWeight: '700', color: C.navy },
  pinSub:        { fontSize: 11, color: C.slate400, marginTop: 2 },
  previewSection: { marginTop: 24 },
  previewLabel:  { fontSize: 11, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  previewCard:   { backgroundColor: C.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  pinnedBar:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  pinnedText:    { fontSize: 10, fontWeight: '700', color: '#7C3AED' },
  catDot:        { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  catTag:        { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewTitle:  { fontSize: 15, fontWeight: '800', color: C.navy, marginBottom: 6 },
  previewBody:   { fontSize: 13, color: C.slate500, lineHeight: 18 },
})
