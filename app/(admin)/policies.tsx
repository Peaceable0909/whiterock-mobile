import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'
import { MarkdownText } from '@/components/MarkdownText'
import { showAlert } from '@/lib/ui'

const TABS = [
  { key: 'privacy', label: 'Privacy Policy', icon: 'shield-checkmark-outline' },
  { key: 'company', label: 'Company Policy', icon: 'business-outline' },
] as const

export default function AdminPoliciesScreen() {
  const C      = useColors()
  const s      = mkS(C)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [tab, setTab]         = useState<'privacy' | 'company'>('privacy')
  const [content, setContent] = useState('')
  const [title, setTitle]     = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [preview, setPreview] = useState(false)
  const [dirty, setDirty]     = useState(false)

  const load = async (key: 'privacy' | 'company') => {
    setLoading(true)
    const { data } = await supabase.from('policies').select('title, content, updated_at').eq('key', key).single()
    setTitle(data?.title ?? (key === 'company' ? 'Company Policy' : 'Privacy Policy'))
    setContent(data?.content ?? '')
    setUpdatedAt(data?.updated_at ?? null)
    setDirty(false)
    setLoading(false)
  }

  useEffect(() => { load(tab) }, [tab])

  const save = async () => {
    if (saving || !content.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('policies').upsert({
      key: tab,
      title,
      content: content.trim(),
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    }, { onConflict: 'key' })
    setSaving(false)
    if (error) { showAlert('Could not save', error.message); return }
    setDirty(false)
    setUpdatedAt(new Date().toISOString())
    showAlert('Saved', `${title} is now live for all users.`)
  }

  return (
    <KeyboardAvoidingView style={s.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Policies</Text>
        <TouchableOpacity onPress={() => setPreview(p => !p)} style={s.previewBtn}>
          <Ionicons name={preview ? 'create-outline' : 'eye-outline'} size={20} color={C.blue} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <TouchableOpacity key={t.key} style={[s.tab, active && s.tabActive]} onPress={() => setTab(t.key)}>
              <Ionicons name={t.icon as any} size={14} color={active ? C.white : C.slate500} />
              <Text style={[s.tabTxt, active && s.tabTxtActive]}>{t.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>
      ) : preview ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
          <View style={s.card}>
            <MarkdownText text={content} C={C} />
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={s.fieldLabel}>Content (Markdown: ### headings, **bold**, - bullets)</Text>
          <TextInput
            style={s.editor}
            value={content}
            onChangeText={t => { setContent(t); setDirty(true) }}
            multiline
            textAlignVertical="top"
            placeholder="Write the policy content…"
            placeholderTextColor={C.slate400}
          />
          {updatedAt && (
            <Text style={s.updated}>
              Last published {new Date(updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          )}
        </ScrollView>
      )}

      {!loading && !preview && (
        <View style={[s.saveBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[s.saveBtn, (!dirty || saving || !content.trim()) && { opacity: 0.45 }]}
            onPress={save}
            disabled={!dirty || saving || !content.trim()}
          >
            {saving
              ? <ActivityIndicator color={C.white} size="small" />
              : <>
                  <Ionicons name="cloud-upload-outline" size={16} color={C.white} />
                  <Text style={s.saveTxt}>{dirty ? 'Publish Changes' : 'Published'}</Text>
                </>}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:          { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14 },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.navy },
  previewBtn:  { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  tabs:        { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 4 },
  tab:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 12, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.slate200 },
  tabActive:   { backgroundColor: C.blue, borderColor: C.blue },
  tabTxt:      { fontSize: 12, fontWeight: '700', color: C.slate500 },
  tabTxtActive:{ color: C.white },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card:        { backgroundColor: C.white, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  fieldLabel:  { fontSize: 11, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  editor:      { backgroundColor: C.white, borderRadius: 16, borderWidth: 1.5, borderColor: C.slate200, padding: 14, fontSize: 13, color: C.navy, minHeight: 340, lineHeight: 20 },
  updated:     { fontSize: 11, color: C.slate400, marginTop: 10, textAlign: 'center' },
  saveBar:     { paddingHorizontal: 16, paddingTop: 10, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.slate100 },
  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.blue, borderRadius: 16, paddingVertical: 14, shadowColor: C.blue, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  saveTxt:     { fontSize: 15, fontWeight: '800', color: C.white },
})
