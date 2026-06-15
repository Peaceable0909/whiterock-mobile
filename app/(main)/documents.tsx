import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Linking,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { AppHeader } from '@/components/AppHeader'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const API_BASE = 'https://whiterock-connect.vercel.app'

const DOC_CATEGORIES = [
  { key: 'all',          label: 'All',            icon: 'folder-outline'         },
  { key: 'passport',     label: 'Passport',       icon: 'card-outline'           },
  { key: 'bank',         label: 'Bank Stmt',      icon: 'wallet-outline'         },
  { key: 'academic',     label: 'Academic',       icon: 'school-outline'         },
  { key: 'offer_letter', label: 'Offer Letter',   icon: 'document-text-outline'  },
  { key: 'cas',          label: 'CAS',            icon: 'ribbon-outline'         },
  { key: 'visa',         label: 'Visa',           icon: 'globe-outline'           },
  { key: 'other',        label: 'Other',          icon: 'attach-outline'          },
] as const

const STATUS_CONFIG = {
  pending:  { bg: '#FEF9C3', text: '#B45309', label: 'Pending Review' },
  approved: { bg: '#DCFCE7', text: '#16A34A', label: 'Approved'       },
  rejected: { bg: '#FEE2E2', text: '#DC2626', label: 'Rejected'       },
} as const

export default function DocumentsScreen() {
  const C = useColors()
  const s = mkS(C)
  const [docs, setDocs]           = useState<any[]>([])
  const [myId, setMyId]           = useState('')
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [catFilter, setCatFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })

    setDocs(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const analyzeDocument = async (docId: string, url: string, category: string) => {
    setAnalyzing(docId)
    try {
      await fetch(`${API_BASE}/api/analyze-doc-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, studentId: myId, category, imageUrl: url }),
      })
      await load()
    } catch { /* best-effort — analysis is non-critical */ }
    setAnalyzing(null)
  }

  const uploadDocument = async (category: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access to your files in Settings.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    const ext = asset.uri.split('.').pop() ?? 'jpg'
    const path = `docs/${myId}/${category}-${Date.now()}.${ext}`

    setUploading(true)
    try {
      const blob = await fetch(asset.uri).then(r => r.blob())
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(path, blob, { contentType: asset.mimeType ?? 'image/jpeg' })
      if (uploadErr) throw uploadErr

      const url = supabase.storage.from('documents').getPublicUrl(path).data.publicUrl

      const { data: doc, error: dbErr } = await supabase.from('documents').insert({
        student_id: myId,
        category,
        url,
        file_type: ext,
        status: 'pending',
      }).select('id').single()
      if (dbErr) throw dbErr
      await load()
      // Run AI analysis in background after upload
      if (doc?.id) analyzeDocument(doc.id, url, category)
    } catch (e: any) {
      Alert.alert('Upload failed', e.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteDocument = (doc: any) => {
    Alert.alert(
      'Delete Document',
      'This will permanently remove the document. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              const match = doc.url?.match(/\/documents\/(.+?)(\?|$)/)
              if (match?.[1]) {
                await supabase.storage.from('documents').remove([decodeURIComponent(match[1])])
              }
              await supabase.from('documents').delete().eq('id', doc.id)
              setDocs(prev => prev.filter(d => d.id !== doc.id))
            } catch (e: any) {
              Alert.alert('Delete failed', e.message)
            }
          },
        },
      ]
    )
  }

  const openDocument = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url)
      if (supported) {
        await Linking.openURL(url)
      } else {
        Alert.alert('Cannot preview', 'Unable to open this document type on your device.')
      }
    } catch {
      Alert.alert('Preview error', 'Could not open the document. Try again.')
    }
  }

  const promptUpload = () => {
    Alert.alert(
      'Upload Document',
      'Select the document category:',
      DOC_CATEGORIES.slice(1).map(c => ({
        text: c.label,
        onPress: () => uploadDocument(c.key),
      })).concat([{ text: 'Cancel', style: 'cancel' } as any]),
    )
  }

  const displayed = catFilter === 'all' ? docs : docs.filter(d => d.category === catFilter)

  const stats = {
    total:    docs.length,
    approved: docs.filter(d => d.status === 'approved').length,
    pending:  docs.filter(d => d.status === 'pending').length,
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>

  return (
    <View style={s.bg}>
      <AppHeader title="Digital Vault" />

      <FlatList
        data={displayed}
        keyExtractor={d => d.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={C.blue} />}
        ListHeaderComponent={
          <>
            {/* Stats strip */}
            <View style={s.statsRow}>
              {[
                { label: 'Total',    val: stats.total,    color: C.navy  },
                { label: 'Approved', val: stats.approved, color: '#16A34A' },
                { label: 'Pending',  val: stats.pending,  color: '#B45309' },
              ].map((item, i) => (
                <View key={item.label} style={[s.statCell, i < 2 && s.statBorder]}>
                  <Text style={[s.statNum, { color: item.color }]}>{item.val}</Text>
                  <Text style={s.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Category filter */}
            <FlatList
              horizontal
              data={DOC_CATEGORIES}
              keyExtractor={c => c.key}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 12, gap: 8 }}
              renderItem={({ item: f }) => (
                <TouchableOpacity
                  style={[s.catChip, catFilter === f.key && s.catChipActive]}
                  onPress={() => setCatFilter(f.key)}
                >
                  <Ionicons name={f.icon as any} size={12} color={catFilter === f.key ? C.white : C.slate500} />
                  <Text style={[s.catChipText, catFilter === f.key && s.catChipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              )}
            />

            {/* Upload tip */}
            <View style={s.tipBox}>
              <Ionicons name="information-circle-outline" size={14} color={C.blue} />
              <Text style={s.tipText}>Tap <Text style={{ fontWeight: '700' }}>+</Text> to upload a document. Staff review within 24–48 hours.</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Ionicons name="folder-open-outline" size={52} color={C.slate200} />
            <Text style={s.emptyTitle}>No documents yet</Text>
            <Text style={s.emptySub}>Upload your passport, bank statements, offer letters and more.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={promptUpload} disabled={uploading}>
              {uploading
                ? <ActivityIndicator color={C.white} size="small" />
                : <Text style={s.emptyBtnText}>Upload First Document</Text>}
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const st = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
          const catMeta = DOC_CATEGORIES.find(c => c.key === item.category) ?? DOC_CATEGORIES[DOC_CATEGORIES.length - 1]
          const isExpanded = expandedId === item.id

          return (
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.85}
              onPress={() => setExpandedId(isExpanded ? null : item.id)}
            >
              <View style={s.cardRow}>
                <View style={[s.docIcon, { backgroundColor: C.blue + '18' }]}>
                  <Ionicons name={catMeta.icon as any} size={20} color={C.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.docName}>
                    {catMeta.label}
                    {item.file_type ? <Text style={s.docExt}> · {item.file_type.toUpperCase()}</Text> : null}
                  </Text>
                  <Text style={s.docDate}>
                    {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                  <Text style={[s.statusText, { color: st.text }]}>{st.label}</Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={C.slate400}
                  style={{ marginLeft: 4 }}
                />
              </View>

              {isExpanded && (
                <View style={s.expandedContent}>
                  {item.status === 'rejected' && item.rejection_reason && (
                    <View style={s.rejectionBox}>
                      <Ionicons name="warning-outline" size={14} color="#DC2626" />
                      <Text style={s.rejectionText}>{item.rejection_reason}</Text>
                    </View>
                  )}
                  {analyzing === item.id ? (
                    <View style={s.aiBox}>
                      <ActivityIndicator size="small" color={C.blue} />
                      <Text style={s.aiText}>AI is analysing this document…</Text>
                    </View>
                  ) : item.ai_analysis ? (
                    <View style={s.aiBox}>
                      <Ionicons name="hardware-chip-outline" size={14} color={C.blue} />
                      <Text style={s.aiText}>{item.ai_analysis}</Text>
                    </View>
                  ) : null}
                  <View style={s.docActions}>
                    {item.url && (
                      <TouchableOpacity style={s.viewBtn} onPress={() => openDocument(item.url)}>
                        <Ionicons name="eye-outline" size={14} color={C.blue} />
                        <Text style={s.viewBtnText}>View</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={s.deleteBtn} onPress={() => deleteDocument(item)}>
                      <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      <Text style={s.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          )
        }}
      />

      <TouchableOpacity
        style={[s.fab, uploading && { opacity: 0.6 }]}
        onPress={promptUpload}
        disabled={uploading}
        accessibilityLabel="Upload document"
      >
        {uploading
          ? <ActivityIndicator color={C.white} />
          : <Ionicons name="cloud-upload-outline" size={24} color={C.white} />}
      </TouchableOpacity>
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:            { flex: 1, backgroundColor: C.bg },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow:      { flexDirection: 'row', backgroundColor: C.white, borderRadius: 18, marginBottom: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  statCell:      { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statBorder:    { borderRightWidth: 1, borderColor: C.slate100 },
  statNum:       { fontSize: 24, fontWeight: '900' },
  statLabel:     { fontSize: 11, color: C.slate400, fontWeight: '600', marginTop: 2 },
  catChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.slate200 },
  catChipActive: { backgroundColor: C.blue, borderColor: C.blue },
  catChipText:   { fontSize: 11, fontWeight: '600', color: C.slate500 },
  catChipTextActive: { color: C.white },
  tipBox:        { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: '#DBEAFE' },
  tipText:       { flex: 1, fontSize: 12, color: C.blue, lineHeight: 17 },
  emptyBox:      { alignItems: 'center', paddingTop: 50, gap: 10, paddingHorizontal: 24 },
  emptyTitle:    { fontSize: 16, fontWeight: '800', color: C.navy },
  emptySub:      { fontSize: 13, color: C.slate400, textAlign: 'center', lineHeight: 20 },
  emptyBtn:      { height: 46, backgroundColor: C.blue, borderRadius: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  emptyBtnText:  { color: C.white, fontWeight: '700', fontSize: 14 },
  card:          { backgroundColor: C.white, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  cardRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  docIcon:       { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  docName:       { fontSize: 14, fontWeight: '700', color: C.navy },
  docExt:        { fontSize: 11, fontWeight: '400', color: C.slate400 },
  docDate:       { fontSize: 11, color: C.slate400, marginTop: 2 },
  statusBadge:   { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText:    { fontSize: 10, fontWeight: '700' },
  expandedContent:{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: C.slate100, gap: 8 },
  rejectionBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#FFF1F2', borderRadius: 10, padding: 10 },
  rejectionText: { flex: 1, fontSize: 12, color: '#DC2626', lineHeight: 17 },
  aiBox:         { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10 },
  aiText:        { flex: 1, fontSize: 12, color: C.blue, lineHeight: 17 },
  docActions:    { flexDirection: 'row', gap: 8 },
  viewBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#EFF6FF', borderRadius: 10 },
  viewBtnText:   { fontSize: 13, fontWeight: '600', color: C.blue },
  deleteBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#FEF2F2', borderRadius: 10 },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  fab:           { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: C.blue, shadowOpacity: 0.35, shadowRadius: 8 },
})
