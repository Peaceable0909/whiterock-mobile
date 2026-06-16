import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking, Modal, TextInput,
  FlatList, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const STAGES = ['lead','application_submitted','offer_received','deposit_paid','cas_requested','cas_issued','visa_submitted','visa_decision']
const STAGE_LABEL: Record<string,string> = {
  lead:'New Lead', application_submitted:'Applied', offer_received:'Offer Accepted',
  deposit_paid:'Deposit Paid', cas_requested:'CAS Pending', cas_issued:'CAS Issued',
  visa_submitted:'Visa Submitted', visa_decision:'Visa Decision',
}

const API_BASE = 'https://whiterock-connect.vercel.app'

export default function StudentProfileScreen() {
  const C        = useColors()
  const { id }   = useLocalSearchParams<{ id: string }>()
  const router   = useRouter()

  const [student, setStudent]     = useState<any>(null)
  const [profile, setProfile]     = useState<any>(null)
  const [docs, setDocs]           = useState<any[]>([])
  const [notes, setNotes]         = useState<any[]>([])
  const [myId, setMyId]           = useState('')
  const [myName, setMyName]       = useState('')
  const [convId, setConvId]       = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [activeTab, setTab]       = useState('overview')

  // Stage modal
  const [stageModal, setStageModal]   = useState(false)
  const [savingStage, setSavingStage] = useState(false)

  // Notes
  const [noteText, setNoteText]       = useState('')
  const [addingNote, setAddingNote]   = useState(false)

  // AI Summary
  const [aiSummary, setAiSummary]     = useState('')
  const [loadingAI, setLoadingAI]     = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    const [{ data: s }, { data: p }, { data: d }, { data: notesData }, { data: me }] = await Promise.all([
      supabase.from('users').select('*').eq('id', id).single(),
      supabase.from('student_profiles').select('*').eq('user_id', id).maybeSingle(),
      supabase.from('documents').select('*').eq('student_id', id).order('created_at', { ascending: false }),
      supabase.from('notes').select('*, author:author_id(name)').eq('student_id', id).order('created_at', { ascending: false }),
      supabase.from('users').select('name').eq('id', user.id).single(),
    ])

    setStudent(s)
    setProfile(p)
    setDocs(d ?? [])
    setNotes(notesData ?? [])
    setMyName(me?.name ?? '')

    // Find conversation for this student assigned to current staff member
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('student_id', id)
      .or(`counselor_id.eq.${user.id},agent_id.eq.${user.id}`)
      .maybeSingle()
    setConvId(conv?.id ?? null)

    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // ─── Stage update ───────────────────────────────────────────────
  const updateStage = async (newStage: string) => {
    setSavingStage(true)
    await supabase.from('student_profiles').update({ stage: newStage }).eq('user_id', id)
    setProfile((p: any) => ({ ...p, stage: newStage }))
    // Notify student
    await supabase.from('notifications').insert({
      user_id: id, type: 'info', is_read: false,
      title: 'Application Stage Updated',
      body: `Your application has moved to: ${STAGE_LABEL[newStage]}`,
    })
    setSavingStage(false)
    setStageModal(false)
  }

  // ─── Document approve/reject ────────────────────────────────────
  const reviewDoc = async (docId: string, status: 'approved' | 'rejected') => {
    await supabase.from('documents').update({ status }).eq('id', docId)
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, status } : d))
    await supabase.from('notifications').insert({
      user_id: id, type: 'info', is_read: false,
      title: `Document ${status === 'approved' ? 'Approved' : 'Rejected'}`,
      body: `Your document has been ${status}.`,
    })
  }

  // ─── Message ────────────────────────────────────────────────────
  const openConversation = async () => {
    if (convId) {
      router.push(`/(main)/messages/${convId}`)
      return
    }
    // Create conversation if none exists
    const { data: newConv, error } = await supabase.from('conversations')
      .insert({ student_id: id, counselor_id: myId })
      .select('id').single()
    if (error) { Alert.alert('Error', error.message); return }
    setConvId(newConv.id)
    router.push(`/(main)/messages/${newConv.id}`)
  }

  // ─── Call ───────────────────────────────────────────────────────
  const callStudent = () => {
    if (!student?.phone) { Alert.alert('No phone number', 'This student has not added a phone number.'); return }
    Linking.openURL(`tel:${student.phone}`)
  }

  // ─── AI Review ──────────────────────────────────────────────────
  const requestAiReview = async () => {
    setLoadingAI(true)
    setAiSummary('')
    try {
      const stage   = profile?.stage ?? 'lead'
      const prompt  = `Provide a brief counselor review for this student application:
Name: ${student?.name}
Stage: ${STAGE_LABEL[stage]}
University: ${profile?.school ?? 'Not set'}
Programme: ${profile?.program_of_interest ?? 'Not set'}
Intake: ${profile?.intake ?? 'Not set'}
Nationality: ${profile?.nationality ?? 'Not set'}
Documents: ${docs.length} uploaded, ${docs.filter((d:any)=>d.status==='approved').length} approved, ${docs.filter((d:any)=>d.status==='pending').length} pending.

Summarize the application status and suggest 2-3 next steps.`

      const res = await fetch(`${API_BASE}/api/ai-chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      const { reply } = await res.json()
      setAiSummary(reply ?? 'No response from AI.')
      setTab('overview')
    } catch {
      setAiSummary('AI temporarily unavailable.')
    }
    setLoadingAI(false)
  }

  // ─── Notes ──────────────────────────────────────────────────────
  const addNote = async () => {
    if (!noteText.trim()) return
    setAddingNote(true)
    const { data, error } = await supabase.from('notes')
      .insert({ student_id: id, author_id: myId, content: noteText.trim() })
      .select('*, author:author_id(name)').single()
    if (!error && data) setNotes(prev => [data, ...prev])
    else if (error) Alert.alert('Error', error.message)
    setNoteText('')
    setAddingNote(false)
  }

  const deleteNote = (noteId: string) => {
    Alert.alert('Delete note?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('notes').delete().eq('id', noteId)
          setNotes(prev => prev.filter(n => n.id !== noteId))
        },
      },
    ])
  }

  const s = mkS(C)
  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>
  if (!student) return <View style={s.center}><Text>Student not found</Text></View>

  const stage    = profile?.stage ?? 'lead'
  const idx      = STAGES.indexOf(stage)
  const pct      = Math.round((idx / (STAGES.length - 1)) * 100)
  const initials = student.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2).toUpperCase()

  const pendingDocs   = docs.filter(d => d.status === 'pending').length
  const approvedDocs  = docs.filter(d => d.status === 'approved').length
  const rejectedDocs  = docs.filter(d => d.status === 'rejected').length

  return (
    <View style={s.bg}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Student Profile</Text>
        <TouchableOpacity onPress={requestAiReview} style={s.aiReviewBtn} disabled={loadingAI}>
          {loadingAI
            ? <ActivityIndicator size="small" color="#9333EA" />
            : <Ionicons name="hardware-chip-outline" size={18} color="#9333EA" />}
        </TouchableOpacity>
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
              {profile?.nationality && <View style={s.metaItem}><Ionicons name="flag-outline" size={12} color={C.slate400} /><Text style={s.metaText}>{profile.nationality}</Text></View>}
              {profile?.intake && <View style={s.metaItem}><Ionicons name="calendar-outline" size={12} color={C.slate400} /><Text style={s.metaText}>{profile.intake}</Text></View>}
            </View>
            <TouchableOpacity style={s.stageBadge} onPress={() => setStageModal(true)}>
              <Text style={s.stageText}>{STAGE_LABEL[stage]}</Text>
              <Ionicons name="chevron-down" size={10} color={C.blue} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Action row */}
        <View style={[s.row, { gap: 8, marginTop: 14 }]}>
          <TouchableOpacity style={s.actionBtn} onPress={openConversation}>
            <Ionicons name="chatbubble-outline" size={14} color={C.white} />
            <Text style={s.actionBtnText}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtnGhost} onPress={callStudent}>
            <Ionicons name="call-outline" size={14} color={C.slate600} />
            <Text style={s.actionBtnGhostText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtnPurple} onPress={requestAiReview} disabled={loadingAI}>
            {loadingAI
              ? <ActivityIndicator size="small" color="#9333EA" />
              : <Ionicons name="hardware-chip-outline" size={14} color="#9333EA" />}
            <Text style={s.actionBtnPurpleText}>AI Review</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* AI Summary card */}
      {aiSummary !== '' && (
        <View style={s.aiCard}>
          <View style={s.aiCardHeader}>
            <Ionicons name="hardware-chip-outline" size={14} color="#9333EA" />
            <Text style={s.aiCardTitle}>AI Application Review</Text>
            <TouchableOpacity onPress={() => setAiSummary('')} style={{ marginLeft: 'auto' }}>
              <Ionicons name="close" size={16} color={C.slate400} />
            </TouchableOpacity>
          </View>
          <Text style={s.aiCardBody}>{aiSummary}</Text>
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabs}>
        {(['overview', 'documents', 'notes'] as const).map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tab, activeTab === t && s.tabActive]}>
            <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>
              {t === 'documents' ? `Docs${pendingDocs > 0 ? ` (${pendingDocs})` : ''}` : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={s.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Overview tab */}
        {activeTab === 'overview' && (
          <View style={{ gap: 12 }}>
            {[
              { label: 'Full Name',   value: student.name        },
              { label: 'Email',       value: student.email       },
              { label: 'Phone',       value: student.phone       },
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

        {/* Documents tab */}
        {activeTab === 'documents' && (
          <View style={{ gap: 8 }}>
            <View style={s.vaultHeader}>
              <Text style={s.vaultTitle}>Digital Vault</Text>
              <View style={s.vaultStats}>
                {[
                  { label: 'Approved', count: approvedDocs, color: '#4ADE80' },
                  { label: 'Pending',  count: pendingDocs,  color: '#FB923C' },
                  { label: 'Rejected', count: rejectedDocs, color: '#F87171' },
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
                  <Ionicons name="document-text-outline" size={18} color={C.blue} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.docName} numberOfLines={1}>{doc.original_name ?? doc.file_name ?? 'Document'}</Text>
                    <View style={s.docMeta}>
                      <View style={[s.statusDot, {
                        backgroundColor: doc.status === 'approved' ? '#22C55E' : doc.status === 'rejected' ? '#EF4444' : '#F59E0B'
                      }]} />
                      <Text style={s.docStatus}>{doc.status}</Text>
                    </View>
                  </View>
                  {doc.status === 'pending' && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={[s.reviewBtn, { backgroundColor: '#D1FAE5' }]}
                        onPress={() => reviewDoc(doc.id, 'approved')}
                      >
                        <Ionicons name="checkmark" size={14} color="#059669" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.reviewBtn, { backgroundColor: '#FEE2E2' }]}
                        onPress={() => reviewDoc(doc.id, 'rejected')}
                      >
                        <Ionicons name="close" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
          </View>
        )}

        {/* Notes tab */}
        {activeTab === 'notes' && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Note input */}
            <View style={s.noteInput}>
              <TextInput
                style={s.noteTextInput}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Add a note about this student..."
                placeholderTextColor={C.slate400}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[s.noteSubmit, (!noteText.trim() || addingNote) && { opacity: 0.4 }]}
                onPress={addNote}
                disabled={!noteText.trim() || addingNote}
              >
                {addingNote
                  ? <ActivityIndicator size="small" color={C.white} />
                  : <Ionicons name="send-outline" size={16} color={C.white} />}
              </TouchableOpacity>
            </View>

            {notes.length === 0
              ? (
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                  <Ionicons name="document-text-outline" size={40} color={C.slate200} />
                  <Text style={[s.emptyText, { marginTop: 8 }]}>No notes yet</Text>
                </View>
              )
              : notes.map(note => (
                <View key={note.id} style={s.noteCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.noteContent}>{note.content}</Text>
                    <Text style={s.noteMeta}>
                      {note.author?.name ?? myName} · {new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  {note.author_id === myId && (
                    <TouchableOpacity onPress={() => deleteNote(note.id)} style={s.noteDelete}>
                      <Ionicons name="trash-outline" size={14} color={C.slate400} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
          </KeyboardAvoidingView>
        )}
      </ScrollView>

      {/* Stage picker modal */}
      <Modal visible={stageModal} transparent animationType="slide" onRequestClose={() => setStageModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Update Stage</Text>
            {savingStage && <ActivityIndicator color={C.blue} style={{ marginBottom: 8 }} />}
            <FlatList
              data={STAGES}
              keyExtractor={st => st}
              ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
              renderItem={({ item }) => {
                const active = stage === item
                return (
                  <TouchableOpacity
                    style={[s.stageOption, active && { backgroundColor: C.blue }]}
                    onPress={() => updateStage(item)}
                    disabled={savingStage}
                  >
                    <Text style={[s.stageOptionText, active && { color: C.white }]}>{STAGE_LABEL[item]}</Text>
                    {active && <Ionicons name="checkmark" size={16} color={C.white} />}
                  </TouchableOpacity>
                )
              }}
            />
            <TouchableOpacity style={s.cancelBtn} onPress={() => setStageModal(false)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:               { flex: 1, backgroundColor: C.bg },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:           { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: C.slate100 },
  back:             { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  headerTitle:      { flex: 1, fontSize: 16, fontWeight: '700', color: C.navy },
  aiReviewBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FAF5FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E9D5FF' },
  profileCard:      { backgroundColor: C.white, padding: 16, borderBottomWidth: 1, borderColor: C.slate100 },
  row:              { flexDirection: 'row', alignItems: 'center' },
  ringWrap:         { width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: C.blue, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  ringAvatar:       { width: 48, height: 48, borderRadius: 24, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  ringText:         { fontSize: 16, fontWeight: '700', color: C.white },
  ringPct:          { position: 'absolute', bottom: -8, fontSize: 10, fontWeight: '800', color: C.blue, backgroundColor: C.white, paddingHorizontal: 3 },
  studentName:      { fontSize: 16, fontWeight: '800', color: C.navy },
  studentNum:       { fontSize: 11, color: C.slate400, fontFamily: 'monospace' },
  metaRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  metaItem:         { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText:         { fontSize: 11, color: C.slate500 },
  stageBadge:       { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  stageText:        { fontSize: 10, fontWeight: '700', color: C.blue },
  actionBtn:        { flex: 1, height: 36, backgroundColor: C.blue, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionBtnText:    { fontSize: 12, fontWeight: '600', color: C.white },
  actionBtnGhost:   { flex: 1, height: 36, backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.slate200, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionBtnGhostText: { fontSize: 12, fontWeight: '600', color: C.slate600 },
  actionBtnPurple:  { flex: 1, height: 36, backgroundColor: '#FAF5FF', borderRadius: 10, borderWidth: 1, borderColor: '#E9D5FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionBtnPurpleText: { fontSize: 12, fontWeight: '600', color: '#9333EA' },
  aiCard:           { backgroundColor: '#FAF5FF', borderBottomWidth: 1, borderColor: '#E9D5FF', padding: 14 },
  aiCardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiCardTitle:      { fontSize: 12, fontWeight: '700', color: '#9333EA' },
  aiCardBody:       { fontSize: 13, color: C.navy, lineHeight: 19 },
  tabs:             { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  tab:              { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
  tabActive:        { borderColor: C.blue },
  tabText:          { fontSize: 12, fontWeight: '600', color: C.slate400 },
  tabTextActive:    { color: C.blue },
  content:          { flex: 1, padding: 14 },
  infoRow:          { backgroundColor: C.white, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel:        { fontSize: 12, color: C.slate400, fontWeight: '600' },
  infoValue:        { fontSize: 13, color: C.navy, fontWeight: '600', flex: 1, textAlign: 'right' },
  vaultHeader:      { backgroundColor: C.navy, borderRadius: 16, padding: 16, marginBottom: 8 },
  vaultTitle:       { fontSize: 14, fontWeight: '800', color: '#93C5FD', textTransform: 'uppercase', letterSpacing: 1 },
  vaultStats:       { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  vaultStat:        { alignItems: 'center' },
  vaultCount:       { fontSize: 22, fontWeight: '900' },
  vaultLabel:       { fontSize: 10, color: '#93C5FD', marginTop: 2 },
  docCard:          { backgroundColor: C.white, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' },
  docName:          { fontSize: 13, fontWeight: '600', color: C.navy },
  docMeta:          { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5 },
  statusDot:        { width: 8, height: 8, borderRadius: 4 },
  docStatus:        { fontSize: 11, color: C.slate500, textTransform: 'capitalize' },
  reviewBtn:        { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  noteInput:        { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: C.white, borderRadius: 14, padding: 12, marginBottom: 12, gap: 8, borderWidth: 1, borderColor: C.slate200 },
  noteTextInput:    { flex: 1, fontSize: 13, color: C.navy, maxHeight: 80, minHeight: 40 },
  noteSubmit:       { width: 36, height: 36, borderRadius: 18, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  noteCard:         { backgroundColor: C.white, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  noteContent:      { fontSize: 13, color: C.navy, lineHeight: 19, flex: 1 },
  noteMeta:         { fontSize: 10, color: C.slate400, marginTop: 6 },
  noteDelete:       { padding: 4 },
  emptyText:        { fontSize: 13, color: C.slate400, textAlign: 'center', marginTop: 24 },
  modalBg:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal:            { backgroundColor: C.white, borderRadius: 24, padding: 20, margin: 12, maxHeight: '70%' },
  modalTitle:       { fontSize: 16, fontWeight: '800', color: C.navy, marginBottom: 14 },
  stageOption:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.slate100, borderRadius: 12, padding: 14 },
  stageOptionText:  { fontSize: 14, fontWeight: '600', color: C.navy },
  cancelBtn:        { padding: 14, alignItems: 'center', marginTop: 8 },
  cancelText:       { fontSize: 14, fontWeight: '600', color: C.slate400 },
})
