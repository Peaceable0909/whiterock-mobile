import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'
import { EmptyState } from '@/components/Skeleton'

const STAGES = ['lead','application_submitted','offer_received','deposit_paid','cas_requested','cas_issued','visa_submitted','visa_decision']

const STAGE_INFO: Record<string, { label: string; icon: string; color: string }> = {
  lead:                  { label: 'New Lead',         icon: 'person-outline',           color: '#64748B' },
  application_submitted: { label: 'Application Sent', icon: 'send-outline',             color: '#1D4ED8' },
  offer_received:        { label: 'Offer Received',   icon: 'mail-open-outline',        color: '#7C3AED' },
  deposit_paid:          { label: 'Deposit Paid',     icon: 'card-outline',             color: '#059669' },
  cas_requested:         { label: 'CAS Requested',    icon: 'document-text-outline',    color: '#0E7490' },
  cas_issued:            { label: 'CAS Issued',       icon: 'checkmark-circle-outline', color: '#059669' },
  visa_submitted:        { label: 'Visa Applied',     icon: 'globe-outline',            color: '#D97706' },
  visa_decision:         { label: 'Visa Decision',    icon: 'flag-outline',             color: '#1D4ED8' },
}

const STAGE_TASKS: Record<string, { text: string; done?: boolean }[]> = {
  offer_received: [
    { text: 'Read your offer letter carefully' },
    { text: 'Check all conditional requirements' },
    { text: 'Accept your offer on UCAS Track' },
    { text: 'Confirm your place with WhiteRock' },
  ],
  deposit_paid: [
    { text: 'Pay tuition deposit to university', done: true },
    { text: 'Get payment confirmation email' },
    { text: 'Request CAS through your counselor' },
    { text: 'Gather financial evidence for visa' },
  ],
  cas_requested: [
    { text: 'Deposit paid and confirmed', done: true },
    { text: 'CAS request submitted', done: true },
    { text: 'Await CAS number (4–8 weeks)' },
    { text: 'Prepare visa application documents' },
  ],
  cas_issued: [
    { text: 'CAS number received', done: true },
    { text: 'Apply for Student visa on gov.uk' },
    { text: 'Pay Immigration Health Surcharge' },
    { text: 'Book biometric appointment' },
  ],
  visa_submitted: [
    { text: 'Visa application submitted', done: true },
    { text: 'Await decision (3–8 weeks)' },
    { text: 'Book flights and accommodation' },
    { text: 'Arrange travel insurance' },
  ],
  visa_decision: [
    { text: 'Collect BRP card on arrival' },
    { text: 'Register with university' },
    { text: 'Open a UK bank account' },
    { text: 'Register with a GP' },
  ],
}

export default function UniversityOffersScreen() {
  const C      = useColors()
  const s      = mkS(C)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [profile,  setProfile]  = useState<any>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase.from('student_profiles').select('*').eq('user_id', user.id).maybeSingle()
      setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

  const stageIdx   = STAGES.indexOf(profile?.stage ?? 'lead')
  const hasOffer   = stageIdx >= STAGES.indexOf('offer_received')
  const stageInfo  = STAGE_INFO[profile?.stage ?? 'lead']
  const tasks      = STAGE_TASKS[profile?.stage ?? ''] ?? []

  return (
    <View style={[s.bg, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.title}>University Offers</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>
      ) : !hasOffer ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <EmptyState
            icon="school-outline"
            title="No offer yet"
            subtitle="Your university offer will appear here once you reach the offer stage. Keep working through your application!"
          />
          <View style={{ padding: 16, gap: 12 }}>
            <Text style={s.sectionLabel}>YOUR PROGRESS</Text>
            <View style={s.card}>
              {STAGES.slice(0, 4).map((st, i) => {
                const info = STAGE_INFO[st]
                const done = i <= stageIdx
                const current = i === stageIdx
                return (
                  <View key={st} style={[s.stageRow, i < 3 && s.stageBorder]}>
                    <View style={[s.stageDot, { backgroundColor: done ? (current ? C.blue : '#059669') : C.slate200 }]}>
                      <Ionicons name={done ? 'checkmark' : info.icon as any} size={14} color={C.white} />
                    </View>
                    <Text style={[s.stageLabel, { color: current ? C.navy : done ? '#059669' : C.slate400 }]}>
                      {info.label}
                    </Text>
                    {current && <View style={s.currentBadge}><Text style={s.currentBadgeText}>Current</Text></View>}
                  </View>
                )
              })}
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom, gap: 14 }}>

          {/* Offer card */}
          <View style={s.offerCard}>
            <View style={s.offerIconWrap}>
              <Ionicons name={stageInfo.icon as any} size={28} color={C.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.offerStatus}>{stageInfo.label}</Text>
              {profile?.school ? (
                <Text style={s.offerUniversity}>{profile.school}</Text>
              ) : null}
              {profile?.intake ? (
                <Text style={s.offerIntake}>Intake: {profile.intake}</Text>
              ) : null}
            </View>
          </View>

          {/* Stage timeline */}
          <Text style={s.sectionLabel}>APPLICATION TIMELINE</Text>
          <View style={s.card}>
            {STAGES.map((st, i) => {
              const info = STAGE_INFO[st]
              const done = i < stageIdx
              const current = i === stageIdx
              if (!info) return null
              return (
                <View key={st} style={[s.stageRow, i < STAGES.length - 1 && s.stageBorder]}>
                  <View style={[s.stageDot, { backgroundColor: done ? '#059669' : current ? C.blue : C.slate200 }]}>
                    <Ionicons name={done ? 'checkmark' : info.icon as any} size={13} color={C.white} />
                  </View>
                  <Text style={[s.stageLabel, { color: current ? C.navy : done ? '#059669' : C.slate400, fontWeight: current ? '700' : '500' }]}>
                    {info.label}
                  </Text>
                  {current && <View style={s.currentBadge}><Text style={s.currentBadgeText}>Now</Text></View>}
                </View>
              )
            })}
          </View>

          {/* Tasks checklist */}
          {tasks.length > 0 && (
            <>
              <Text style={s.sectionLabel}>NEXT STEPS</Text>
              <View style={s.card}>
                {tasks.map((t, i) => (
                  <View key={i} style={[s.taskRow, i < tasks.length - 1 && s.stageBorder]}>
                    <View style={[s.taskCheck, t.done && s.taskCheckDone]}>
                      {t.done && <Ionicons name="checkmark" size={12} color={C.white} />}
                    </View>
                    <Text style={[s.taskText, t.done && s.taskTextDone]}>{t.text}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Quick links */}
          <Text style={s.sectionLabel}>USEFUL LINKS</Text>
          <View style={s.card}>
            {[
              { label: 'UCAS Track',        icon: 'open-outline', url: 'https://track.ucas.com' },
              { label: 'UKVI Visa Portal',  icon: 'open-outline', url: 'https://www.gov.uk/apply-to-come-to-the-uk' },
              { label: 'IHS Surcharge',     icon: 'open-outline', url: 'https://www.immigration-health-surcharge.service.gov.uk' },
            ].map((link, i) => (
              <TouchableOpacity key={link.label} style={[s.linkRow, i < 2 && s.stageBorder]} onPress={() => WebBrowser.openBrowserAsync(link.url)}>
                <Text style={s.linkLabel}>{link.label}</Text>
                <Ionicons name={link.icon as any} size={16} color={C.blue} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:               { flex: 1, backgroundColor: C.bg },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  back:             { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  title:            { fontSize: 17, fontWeight: '800', color: C.navy },
  sectionLabel:     { fontSize: 10, fontWeight: '800', color: C.slate400, letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: 4 },
  card:             { backgroundColor: C.white, borderRadius: 20, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },

  offerCard:        { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.blue, borderRadius: 20, padding: 18, shadowColor: C.blue, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  offerIconWrap:    { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  offerStatus:      { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  offerUniversity:  { fontSize: 18, fontWeight: '800', color: C.white, lineHeight: 24 },
  offerIntake:      { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

  stageRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  stageBorder:      { borderBottomWidth: 1, borderColor: C.slate100 },
  stageDot:         { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stageLabel:       { flex: 1, fontSize: 14, color: C.slate500 },
  currentBadge:     { backgroundColor: C.blue + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  currentBadgeText: { fontSize: 10, fontWeight: '800', color: C.blue, textTransform: 'uppercase', letterSpacing: 0.5 },

  taskRow:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  taskCheck:        { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.slate300, alignItems: 'center', justifyContent: 'center' },
  taskCheckDone:    { backgroundColor: '#059669', borderColor: '#059669' },
  taskText:         { flex: 1, fontSize: 14, color: C.navy },
  taskTextDone:     { color: C.slate400, textDecorationLine: 'line-through' },

  linkRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  linkLabel:        { flex: 1, fontSize: 14, fontWeight: '600', color: C.navy },
})
