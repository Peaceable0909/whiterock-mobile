import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

const STAGES = ['lead','application_submitted','offer_received','deposit_paid','cas_requested','cas_issued','visa_submitted','visa_decision']
const STAGE_LABEL: Record<string,string> = { lead:'New Lead', application_submitted:'Applied', offer_received:'Offer Accepted', deposit_paid:'Deposit Paid', cas_requested:'CAS Pending', cas_issued:'CAS Issued', visa_submitted:'Visa Submitted', visa_decision:'Visa Decision' }

export default function StudentProfileScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>()
  const router  = useRouter()
  const [student, setStudent]   = useState<any>(null)
  const [profile, setProfile]   = useState<any>(null)
  const [docs, setDocs]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [activeTab, setTab]     = useState('overview')

  useEffect(() => {
    const load = async () => {
      const { data: s } = await supabase.from('users').select('*').eq('id', id).single()
      const { data: p } = await supabase.from('student_profiles').select('*').eq('user_id', id).single()
      const { data: d } = await supabase.from('documents').select('*').eq('student_id', id)
      setStudent(s); setProfile(p); setDocs(d ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>
  if (!student) return <View style={s.center}><Text>Student not found</Text></View>

  const stage   = profile?.stage ?? 'lead'
  const idx     = STAGES.indexOf(stage)
  const pct     = Math.round((idx / (STAGES.length - 1)) * 100)
  const initials = student.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()

  const TABS = ['overview', 'documents', 'notes']

  return (
    <View style={s.bg}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Student Profile</Text>
      </View>

      {/* Profile card */}
      <View style={s.profileCard}>
        <View style={s.row}>
          <View style={s.ringWrap}>
            <View style={s.ringAvatar}><Text style={s.ringText}>{initials}</Text></View>
            <Text style={s.ringPct}>{pct}%</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.studentName}>{student.name}</Text>
            {profile?.student_number && <Text style={s.studentNum}>{profile.student_number}</Text>}
            <View style={s.metaRow}>
              {profile?.school && <View style={s.metaItem}><Ionicons name="book-outline" size={12} color={C.slate400} /><Text style={s.metaText}>{profile.school}</Text></View>}
              {profile?.country_of_interest && <View style={s.metaItem}><Ionicons name="location-outline" size={12} color={C.slate400} /><Text style={s.metaText}>{profile.country_of_interest}</Text></View>}
              {profile?.intake && <View style={s.metaItem}><Ionicons name="calendar-outline" size={12} color={C.slate400} /><Text style={s.metaText}>{profile.intake}</Text></View>}
            </View>
            <View style={s.stageBadge}><Text style={s.stageText}>{STAGE_LABEL[stage]}</Text></View>
          </View>
        </View>

        {/* Action row */}
        <View style={[s.row, { gap: 8, marginTop: 14 }]}>
          <TouchableOpacity style={s.actionBtn}>
            <Ionicons name="chatbubble-outline" size={14} color={C.white} />
            <Text style={s.actionBtnText}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtnGhost}>
            <Ionicons name="call-outline" size={14} color={C.slate600} />
            <Text style={s.actionBtnGhostText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtnPurple}>
            <Ionicons name="hardware-chip-outline" size={14} color="#9333EA" />
            <Text style={s.actionBtnPurpleText}>AI Review</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tab, activeTab === t && s.tabActive]}>
            <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={s.content} contentContainerStyle={{ paddingBottom: 32 }}>
        {activeTab === 'overview' && (
          <View style={{ gap: 12 }}>
            {[
              { label: 'Full Name',   value: student.name        },
              { label: 'Email',       value: student.email       },
              { label: 'University',  value: profile?.school     },
              { label: 'Programme',   value: profile?.program_of_interest },
              { label: 'Nationality', value: profile?.nationality },
              { label: 'Intake',      value: profile?.intake     },
              { label: 'Stage',       value: STAGE_LABEL[stage]  },
            ].filter(r => r.value).map(row => (
              <View key={row.label} style={s.infoRow}>
                <Text style={s.infoLabel}>{row.label}</Text>
                <Text style={s.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'documents' && (
          <View style={{ gap: 8 }}>
            <View style={s.vaultHeader}>
              <Text style={s.vaultTitle}>Digital Vault</Text>
              <View style={s.vaultStats}>
                {[
                  { label: 'Approved', count: docs.filter(d=>d.status==='approved').length, color: '#4ADE80' },
                  { label: 'Pending',  count: docs.filter(d=>d.status==='pending').length,  color: '#FB923C' },
                  { label: 'Rejected', count: docs.filter(d=>d.status==='rejected').length, color: '#F87171' },
                ].map(stat => (
                  <View key={stat.label} style={s.vaultStat}>
                    <Text style={[s.vaultCount, { color: stat.color }]}>{stat.count}</Text>
                    <Text style={s.vaultLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            {docs.length === 0
              ? <Text style={s.emptyText}>No documents uploaded yet</Text>
              : docs.map(doc => (
                <View key={doc.id} style={s.docCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.docName} numberOfLines={1}>{doc.original_name}</Text>
                    <View style={s.docMeta}>
                      <View style={[s.statusDot, { backgroundColor: doc.status === 'approved' ? '#22C55E' : doc.status === 'rejected' ? '#EF4444' : '#F59E0B' }]} />
                      <Text style={s.docStatus}>{doc.status}</Text>
                    </View>
                  </View>
                </View>
              ))}
          </View>
        )}

        {activeTab === 'notes' && (
          <Text style={s.emptyText}>Notes coming soon</Text>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  bg:              { flex: 1, backgroundColor: C.bg },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: C.slate100 },
  back:            { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  headerTitle:     { fontSize: 16, fontWeight: '700', color: C.navy },
  profileCard:     { backgroundColor: C.white, padding: 16, borderBottomWidth: 1, borderColor: C.slate100 },
  row:             { flexDirection: 'row', alignItems: 'center' },
  ringWrap:        { width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  ringAvatar:      { width: 48, height: 48, borderRadius: 24, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  ringText:        { fontSize: 16, fontWeight: '700', color: C.white },
  ringPct:         { position: 'absolute', bottom: -8, fontSize: 10, fontWeight: '800', color: C.blue, backgroundColor: C.white, paddingHorizontal: 3 },
  studentName:     { fontSize: 16, fontWeight: '800', color: C.navy },
  studentNum:      { fontSize: 11, color: C.slate400, fontFamily: 'monospace' },
  metaRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  metaItem:        { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:        { fontSize: 11, color: C.slate500 },
  stageBadge:      { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  stageText:       { fontSize: 10, fontWeight: '700', color: C.blue },
  actionBtn:       { flex: 1, height: 36, backgroundColor: C.blue, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionBtnText:   { fontSize: 12, fontWeight: '600', color: C.white },
  actionBtnGhost:  { flex: 1, height: 36, backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.slate200, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionBtnGhostText: { fontSize: 12, fontWeight: '600', color: C.slate600 },
  actionBtnPurple: { flex: 1, height: 36, backgroundColor: '#FAF5FF', borderRadius: 10, borderWidth: 1, borderColor: '#E9D5FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionBtnPurpleText: { fontSize: 12, fontWeight: '600', color: '#9333EA' },
  tabs:            { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  tab:             { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
  tabActive:       { borderColor: C.blue },
  tabText:         { fontSize: 12, fontWeight: '600', color: C.slate400 },
  tabTextActive:   { color: C.blue },
  content:         { flex: 1, padding: 14 },
  infoRow:         { backgroundColor: C.white, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel:       { fontSize: 12, color: C.slate400, fontWeight: '600' },
  infoValue:       { fontSize: 13, color: C.navy, fontWeight: '600', flex: 1, textAlign: 'right' },
  vaultHeader:     { backgroundColor: C.navy, borderRadius: 16, padding: 16, marginBottom: 8 },
  vaultTitle:      { fontSize: 14, fontWeight: '800', color: '#93C5FD', textTransform: 'uppercase', letterSpacing: 1 },
  vaultStats:      { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  vaultStat:       { alignItems: 'center' },
  vaultCount:      { fontSize: 22, fontWeight: '900' },
  vaultLabel:      { fontSize: 10, color: '#93C5FD', marginTop: 2 },
  docCard:         { backgroundColor: C.white, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' },
  docName:         { fontSize: 13, fontWeight: '600', color: C.navy },
  docMeta:         { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5 },
  statusDot:       { width: 8, height: 8, borderRadius: 4 },
  docStatus:       { fontSize: 11, color: C.slate500, textTransform: 'capitalize' },
  emptyText:       { fontSize: 13, color: C.slate400, textAlign: 'center', marginTop: 24 },
})
