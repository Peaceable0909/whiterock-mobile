import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'
import { MarkdownText } from '@/components/MarkdownText'
import { FadeInUp } from '@/components/Anim'

export default function PolicyScreen() {
  const C      = useColors()
  const s      = mkS(C)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { type } = useLocalSearchParams<{ type?: string }>()
  const key = type === 'company' ? 'company' : 'privacy'

  const [policy, setPolicy]   = useState<{ title: string; content: string; updated_at: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase.from('policies').select('title, content, updated_at').eq('key', key).single()
      .then(({ data }) => { setPolicy(data); setLoading(false) })
  }, [key])

  return (
    <View style={s.bg}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{policy?.title ?? (key === 'company' ? 'Company Policy' : 'Privacy Policy')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>
      ) : !policy ? (
        <View style={s.center}>
          <Ionicons name="document-lock-outline" size={40} color={C.slate400} />
          <Text style={s.missing}>This policy is not available yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
          <FadeInUp>
            <View style={s.card}>
              <MarkdownText text={policy.content} C={C} />
            </View>
            <Text style={s.updated}>
              Last updated {new Date(policy.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </FadeInUp>
        </ScrollView>
      )}
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:          { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.navy },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60 },
  missing:     { fontSize: 14, color: C.slate500 },
  card:        { backgroundColor: C.white, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  updated:     { fontSize: 12, color: C.slate400, textAlign: 'center', marginTop: 16 },
})
