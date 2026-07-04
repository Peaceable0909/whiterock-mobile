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
import { policyGate } from '@/lib/policyGate'

// Viewer for the admin-editable policies. With ?accept=1 (signup flow) the
// reader becomes sequential: Privacy → Accept & Continue → Company →
// Accept All — and the accept button unlocks only after scrolling to the end.
export default function PolicyScreen() {
  const C      = useColors()
  const s      = mkS(C)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { type, accept } = useLocalSearchParams<{ type?: string; accept?: string }>()
  const key = type === 'company' ? 'company' : 'privacy'
  const accepting = accept === '1'

  const [policy, setPolicy]   = useState<{ title: string; content: string; updated_at: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [readToEnd, setReadToEnd] = useState(false)

  useEffect(() => {
    setLoading(true)
    setReadToEnd(false)
    supabase.from('policies').select('title, content, updated_at').eq('key', key).single()
      .then(({ data }) => { setPolicy(data); setLoading(false) })
  }, [key])

  const onScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 32) setReadToEnd(true)
  }

  const acceptCurrent = () => {
    if (key === 'privacy') {
      router.replace('/(auth)/policy?type=company&accept=1')
    } else {
      policyGate.accepted = true
      router.back()
    }
  }

  return (
    <View style={s.bg}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{policy?.title ?? (key === 'company' ? 'Company Policy' : 'Privacy Policy')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {accepting && (
        <View style={s.stepRow}>
          <View style={[s.stepDot, { backgroundColor: C.blue }]} />
          <View style={[s.stepDot, { backgroundColor: key === 'company' ? C.blue : C.slate200 }]} />
          <Text style={s.stepTxt}>Step {key === 'privacy' ? '1' : '2'} of 2 — read to the end to accept</Text>
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>
      ) : !policy ? (
        <View style={s.center}>
          <Ionicons name="document-lock-outline" size={40} color={C.slate400} />
          <Text style={s.missing}>This policy is not available yet.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + (accepting ? 110 : 32) }}
          showsVerticalScrollIndicator={false}
          onScroll={accepting ? onScroll : undefined}
          scrollEventThrottle={64}
          onContentSizeChange={(_, h) => { if (accepting && h < 500) setReadToEnd(true) }}
        >
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

      {accepting && !loading && (
        <View style={[s.acceptBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[s.acceptBtn, !readToEnd && { opacity: 0.45 }]}
            disabled={!readToEnd}
            onPress={acceptCurrent}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={s.acceptTxt}>
              {readToEnd
                ? (key === 'privacy' ? 'Accept & Continue' : 'Accept All & Finish')
                : 'Scroll to the end to accept'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:          { flex: 1, backgroundColor: 'transparent' },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14 },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.navy },
  stepRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingBottom: 10 },
  stepDot:     { width: 22, height: 5, borderRadius: 3 },
  stepTxt:     { fontSize: 11, color: C.slate400, marginLeft: 6, fontWeight: '600' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 60 },
  missing:     { fontSize: 14, color: C.slate500 },
  card:        { backgroundColor: C.white, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  updated:     { fontSize: 12, color: C.slate400, textAlign: 'center', marginTop: 16 },
  acceptBar:   { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: C.bg },
  acceptBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.blue, borderRadius: 16, paddingVertical: 15, shadowColor: C.blue, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  acceptTxt:   { fontSize: 15, fontWeight: '800', color: '#fff' },
})
