import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
  Alert, TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

export default function OverviewTab() {
  const C      = useColors()
  const s      = mkS(C)
  const insets = useSafeAreaInsets()

  const [profile, setProfile]   = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState('')
  const [values, setValues]     = useState<Record<string, string>>({})
  const [saving, setSaving]     = useState(false)
  const [convId, setConvId]     = useState<string | null>(null)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [togglingAi, setTogglingAi] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [{ data }, { data: conv }] = await Promise.all([
      supabase.from('student_profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('conversations').select('id, ai_enabled').eq('student_id', user.id).maybeSingle(),
    ])
    setProfile(data)
    if (data) {
      setValues({
        nationality: data.nationality || '',
        phone: data.phone || '',
        address: data.address || '',
        country_of_interest: data.country_of_interest || '',
        program_of_interest: data.program_of_interest || '',
        intake: data.intake || '',
        school: data.school || '',
      })
    }
    if (conv) {
      setConvId(conv.id)
      setAiEnabled(conv.ai_enabled ?? true)
    }
    setLoading(false)
  }

  const toggleAi = async () => {
    if (!convId || togglingAi) return
    setTogglingAi(true)
    const next = !aiEnabled
    setAiEnabled(next)
    await supabase.from('conversations').update({ ai_enabled: next }).eq('id', convId)
    setTogglingAi(false)
  }

  const edit = (field: string) => setEditing(field)

  const save = async (field: string) => {
    if (!profile) return
    setSaving(true)
    const { error } = await supabase.from('student_profiles')
      .update({ [field]: values[field] || null })
      .eq('user_id', profile.user_id)
    setSaving(false)
    if (error) { Alert.alert('Error', error.message); return }
    setProfile((p: any) => ({ ...p, [field]: values[field] }))
    setEditing('')
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>
  if (!profile) return <View style={s.center}><Text style={s.noData}>No profile found</Text></View>

  const fields = [
    { key: 'nationality', label: 'Nationality', icon: 'earth-outline' },
    { key: 'phone', label: 'Phone', icon: 'call-outline' },
    { key: 'address', label: 'Address', icon: 'location-outline' },
    { key: 'country_of_interest', label: 'Country of Interest', icon: 'flag-outline' },
    { key: 'program_of_interest', label: 'Program of Interest', icon: 'book-outline' },
    { key: 'intake', label: 'Intake', icon: 'calendar-outline' },
    { key: 'school', label: 'School', icon: 'school-outline' },
  ]

  return (
    <ScrollView style={s.bg} contentContainerStyle={[s.content, { paddingBottom: 32 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      {fields.map((f, i) => {
        const isEditing = editing === f.key
        const value = values[f.key] || ''
        return (
          <View key={f.key} style={[s.field, i < fields.length - 1 && s.fieldBorder]}>
            <View style={[s.iconBox, { backgroundColor: C.blue + '18' }]}>
              <Ionicons name={f.icon as any} size={18} color={C.blue} />
            </View>
            <View style={s.fieldBody}>
              <Text style={s.fieldLabel}>{f.label}</Text>
              {isEditing ? (
                <TextInput
                  style={s.fieldInput}
                  value={value}
                  onChangeText={v => setValues(p => ({ ...p, [f.key]: v }))}
                  placeholder="Enter value"
                  placeholderTextColor={C.slate400}
                  autoFocus
                />
              ) : (
                <Text style={s.fieldValue}>{value || '–'}</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={isEditing ? () => save(f.key) : () => edit(f.key)}
              disabled={saving}
              style={s.editBtn}
            >
              <Ionicons
                name={isEditing ? 'checkmark-circle' : 'pencil-outline'}
                size={20}
                color={isEditing ? C.blue : C.slate400}
              />
            </TouchableOpacity>
          </View>
        )
      })}

      {/* AI Assistant toggle — only shown when student has a conversation */}
      {convId && (
        <View style={s.aiCard}>
          <View style={[s.aiIconBox, { backgroundColor: aiEnabled ? C.blue + '18' : C.slate100 }]}>
            <Ionicons
              name={aiEnabled ? 'hardware-chip' : 'hardware-chip-outline'}
              size={20}
              color={aiEnabled ? C.blue : C.slate400}
            />
          </View>
          <View style={s.aiBody}>
            <Text style={s.aiTitle}>AI Assistant</Text>
            <Text style={s.aiSub}>
              {aiEnabled
                ? 'Active · AI responds when your counsellor is offline'
                : 'Paused · you are talking directly'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={toggleAi}
            disabled={togglingAi}
            activeOpacity={0.8}
            style={[s.toggleTrack, aiEnabled && s.toggleTrackOn]}
          >
            <View style={[s.toggleThumb, aiEnabled && s.toggleThumbOn]} />
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:           { flex: 1, backgroundColor: C.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:      { padding: 16 },
  field:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 12 },
  fieldBorder:  { borderBottomWidth: 1, borderColor: C.slate100 },
  iconBox:      { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fieldBody:    { flex: 1 },
  fieldLabel:   { fontSize: 12, fontWeight: '700', color: C.slate400, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue:   { fontSize: 15, fontWeight: '600', color: C.navy, marginTop: 3 },
  fieldInput:   { fontSize: 15, color: C.navy, borderBottomWidth: 2, borderColor: C.blue, paddingVertical: 4, marginTop: 3 },
  editBtn:      { padding: 4 },
  noData:       { fontSize: 14, color: C.slate400 },
  // AI toggle card
  aiCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 16, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.slate100, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  aiIconBox:    { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  aiBody:       { flex: 1 },
  aiTitle:      { fontSize: 14, fontWeight: '700', color: C.navy },
  aiSub:        { fontSize: 12, color: C.slate400, marginTop: 2 },
  toggleTrack:  { width: 46, height: 26, borderRadius: 13, backgroundColor: C.slate200, padding: 3, justifyContent: 'center' },
  toggleTrackOn:{ backgroundColor: C.blue },
  toggleThumb:  { width: 20, height: 20, borderRadius: 10, backgroundColor: C.white, alignSelf: 'flex-start' },
  toggleThumbOn:{ alignSelf: 'flex-end' },
})
