import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const JOURNEY_STAGES = [
  { key: 'lead',                  label: 'Lead Created',          shortLabel: 'Lead'        },
  { key: 'application_submitted', label: 'Application Submitted', shortLabel: 'Applied'     },
  { key: 'offer_received',        label: 'Offer Received',        shortLabel: 'Offer'       },
  { key: 'deposit_paid',          label: 'Deposit Paid',          shortLabel: 'Deposit'     },
  { key: 'cas_requested',         label: 'CAS Requested',         shortLabel: 'CAS Req.'    },
  { key: 'cas_issued',            label: 'CAS Issued',            shortLabel: 'CAS Issued'  },
  { key: 'visa_submitted',        label: 'Visa Submitted',        shortLabel: 'Visa Sub.'   },
  { key: 'visa_decision',         label: 'Visa Decision',         shortLabel: 'Decision'    },
]

export default function JourneyTab() {
  const C      = useColors()
  const s      = mkS(C)
  const insets = useSafeAreaInsets()

  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('student_profiles')
      .select('*').eq('user_id', user.id).single()
    setProfile(data)
    setLoading(false)
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>

  const currentIdx = profile?.stage
    ? JOURNEY_STAGES.findIndex(s => s.key === profile.stage)
    : -1

  return (
    <ScrollView style={s.bg} contentContainerStyle={[s.content, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <View style={s.timeline}>
        {JOURNEY_STAGES.map((stage, idx) => {
          const complete = idx <= currentIdx
          const current  = idx === currentIdx
          return (
            <View key={stage.key} style={s.stageRow}>
              {/* Vertical line before dot */}
              {idx > 0 && (
                <View style={[s.lineUp, complete && s.lineUpDone]} />
              )}

              {/* Dot */}
              <View style={[s.dotWrap]}>
                <View style={[
                  s.dot,
                  complete ? { backgroundColor: C.blue } : { backgroundColor: C.slate200 },
                  current && s.dotCurrent,
                ]}>
                  {complete && <Ionicons name="checkmark" size={14} color={C.white} />}
                </View>
              </View>

              {/* Vertical line after dot */}
              {idx < JOURNEY_STAGES.length - 1 && (
                <View style={[s.lineDown, complete && s.lineDownDone]} />
              )}

              {/* Label */}
              <View style={s.labelBox}>
                <Text style={[s.label, complete && s.labelDone]}>{stage.label}</Text>
                {current && <View style={s.currentBadge}><Text style={s.currentText}>Current</Text></View>}
              </View>
            </View>
          )
        })}
      </View>

      {!profile?.stage && (
        <View style={s.notStarted}>
          <Ionicons name="information-circle-outline" size={32} color={C.slate300} />
          <Text style={s.notStartedText}>Journey not started yet</Text>
        </View>
      )}
    </ScrollView>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:         { flex: 1, backgroundColor: C.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:    { padding: 20 },
  timeline:   { marginVertical: 12 },
  stageRow:   { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-start' },
  lineUp:     { position: 'absolute', left: 20, top: -12, width: 2, height: 12, backgroundColor: C.slate200 },
  lineUpDone: { backgroundColor: C.blue },
  lineDown:   { position: 'absolute', left: 20, bottom: -20, width: 2, height: 20, backgroundColor: C.slate200 },
  lineDownDone: { backgroundColor: C.blue },
  dotWrap:    { width: 40, alignItems: 'center', paddingTop: 4, zIndex: 10 },
  dot:        { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  dotCurrent: { borderWidth: 2, borderColor: C.blue },
  labelBox:   { marginLeft: 16, paddingTop: 6, flex: 1 },
  label:      { fontSize: 14, fontWeight: '600', color: C.slate400 },
  labelDone:  { color: C.navy, fontWeight: '700' },
  currentBadge: { backgroundColor: C.blue + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4, alignSelf: 'flex-start' },
  currentText: { fontSize: 10, fontWeight: '700', color: C.blue },
  notStarted: { alignItems: 'center', paddingTop: 60, gap: 12 },
  notStartedText: { fontSize: 14, color: C.slate400 },
})
