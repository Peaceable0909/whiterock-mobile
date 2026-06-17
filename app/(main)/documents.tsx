import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as WebBrowser from 'expo-web-browser'
import { Ionicons } from '@expo/vector-icons'
import { AppHeader } from '@/components/AppHeader'
import { ImageModal } from '@/components/ImageModal'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'avif'])

const API_BASE     = 'https://whiterock-connect.vercel.app'
const SUPABASE_URL = 'https://bpranhebhhtvcgcmuegd.supabase.co'

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

const UPLOAD_CATEGORIES = [
  { key: 'passport',     label: 'Passport',       icon: 'card-outline',          color: '#3B82F6' },
  { key: 'bank',         label: 'Bank Statement', icon: 'wallet-outline',        color: '#16A34A' },
  { key: 'academic',     label: 'Academic',       icon: 'school-outline',        color: '#7C3AED' },
  { key: 'offer_letter', label: 'Offer Letter',   icon: 'document-text-outline', color: '#EA580C' },
  { key: 'cas',          label: 'CAS Letter',     icon: 'ribbon-outline',        color: '#0D9488' },
  { key: 'visa',         label: 'Visa',           icon: 'globe-outline',         color: '#DC2626' },
  { key: 'other',        label: 'Other',          icon: 'attach-outline',        color: '#6B7280' },
]

const mkStatusConfig = (C: ColorPalette) => ({
  pending:  { bg: C.orange500 + '30', text: C.orange500, label: 'Pending Review' },
  approved: { bg: C.green400  + '30', text: C.green400,  label: 'Approved'       },
  rejected: { bg: C.red500    + '30', text: C.red500,    label: 'Rejected'       },
})

export default function DocumentsScreen() {
  const C = useColors()
  const s = mkS(C)
  const STATUS_CONFIG = mkStatusConfig(C)
  const insets = useSafeAreaInsets()
  const [docs, setDocs]           = useState<any[]>([])
  const [myId, setMyId]           = useState('')
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [catFilter, setCatFilter] = useState('all')
  const [showCatPicker, setShowCatPicker] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [previewImg, setPreviewImg] = useState<string | null>(null)

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
    let picked: DocumentPicker.DocumentPickerResult
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      })
    } catch {
      Alert.alert('Picker error', 'Could not open file picker. Try again.')
      return
    }
    if (picked.canceled || !picked.assets?.[0]) return
    const asset = picked.assets[0]
    const mimeType = asset.mimeType ?? 'application/octet-stream'
    const rawName = asset.name ?? `doc_${Date.now()}`
    const ext = rawName.includes('.') ? rawName.split('.').pop()!.toLowerCase() : 'bin'
    // Path must start with the user's own ID — storage RLS checks the first folder segment
    const path = `${myId}/${category}-${Date.now()}.${ext}`
    const isImage = mimeType.startsWith('image/')
    const fileType = mimeType.includes('pdf') ? 'pdf'
      : mimeType.startsWith('image/') ? 'image'
      : ['doc', 'docx'].includes(ext) ? 'docx'
      : ext === 'zip' ? 'zip' : 'other'

    setUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/documents/${path}`)
        xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`)
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText))
        xhr.onerror = () => reject(new Error('Upload failed'))
        const fd = new FormData()
        fd.append('file', { uri: asset.uri, name: rawName, type: mimeType } as any)
        xhr.send(fd)
      })

      const url = supabase.storage.from('documents').getPublicUrl(path).data.publicUrl

      const { data: doc, error: dbErr } = await supabase.from('documents').insert({
        student_id:    myId,
        category,
        original_name: rawName,
        url,
        file_type:     fileType,
        size:          asset.size ?? 0,
        uploaded_by:   myId,
        status:        'pending',
      }).select('id').single()
      if (dbErr) throw dbErr
      await load()
      if (doc?.id && isImage) analyzeDocument(doc.id, url, category)
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
            // Best-effort storage removal — don't let a missing file block the DB delete
            const match = doc.url?.match(/\/documents\/(.+?)(\?|$)/)
            if (match?.[1]) {
              await supabase.storage.from('documents').remove([decodeURIComponent(match[1])])
            }
            const { error: deleteErr } = await supabase.from('documents').delete().eq('id', doc.id)
            if (deleteErr) {
              Alert.alert('Delete failed', deleteErr.message)
              return
            }
            setDocs(prev => prev.filter(d => d.id !== doc.id))
          },
        },
      ]
    )
  }

  const openDocument = async (url: string, fileType?: string) => {
    if (IMAGE_EXTS.has((fileType ?? '').toLowerCase())) {
      setPreviewImg(url)
    } else {
      await WebBrowser.openBrowserAsync(url)
    }
  }

  const promptUpload = () => setShowCatPicker(true)

  const displayed = catFilter === 'all' ? docs : docs.filter(d => d.category === catFilter)

  const stats = {
    total:    docs.length,
    approved: docs.filter(d => d.status === 'approved').length,
    pending:  docs.filter(d => d.status === 'pending').length,
  }

  if (loading) return (
    <View style={s.bg}>
      <AppHeader title="Digital Vault" />
      <View style={{ padding: 14, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
          {[0, 1, 2].map(i => <Skeleton key={i} height={52} radius={12} style={{ flex: 1 }} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[0, 1, 2, 3].map(i => <Skeleton key={i} height={28} width={70} radius={20} />)}
        </View>
        {[0, 1, 2].map(i => (
          <SkeletonCard key={i}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Skeleton height={40} width={40} radius={10} />
              <View style={{ flex: 1, gap: 7 }}>
                <Skeleton height={13} width={'65%'} radius={4} />
                <Skeleton height={11} width={'40%'} radius={4} />
              </View>
            </View>
          </SkeletonCard>
        ))}
      </View>
    </View>
  )

  return (
    <View style={s.bg}>
      <AppHeader title="Digital Vault" />

      <FlatList
        data={displayed}
        keyExtractor={d => d.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 100 + insets.bottom }}
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
              nestedScrollEnabled
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
              <Text style={s.tipText}>Tap <Text style={{ fontWeight: '700' }}>+</Text> to upload an image or PDF. Staff review within 24–48 hours.</Text>
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
          const st = STATUS_CONFIG[item.status as 'pending' | 'approved' | 'rejected'] ?? STATUS_CONFIG.pending
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
                      <TouchableOpacity style={s.viewBtn} onPress={() => openDocument(item.url, item.file_type)}>
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

      <ImageModal uri={previewImg} onClose={() => setPreviewImg(null)} />

      {/* Category picker bottom sheet */}
      <Modal
        visible={showCatPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCatPicker(false)}
      >
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowCatPicker(false)} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.sheetHandle} />

            <View style={s.sheetHeader}>
              <View style={s.sheetIconWrap}>
                <Ionicons name="cloud-upload-outline" size={22} color={C.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetTitle}>Upload Document</Text>
                <Text style={s.sheetSub}>Choose a category for your file</Text>
              </View>
            </View>

            <View style={s.catGrid}>
              {UPLOAD_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  style={s.catCard}
                  activeOpacity={0.75}
                  onPress={() => {
                    setShowCatPicker(false)
                    uploadDocument(cat.key)
                  }}
                >
                  <View style={[s.catCardIconWrap, { backgroundColor: cat.color + '18' }]}>
                    <Ionicons name={cat.icon as any} size={22} color={cat.color} />
                  </View>
                  <Text style={s.catCardLabel}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={s.sheetCancel} onPress={() => setShowCatPicker(false)}>
              <Text style={s.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  tipBox:        { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: C.blue + '18', borderRadius: 12, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: C.blue + '35' },
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
  rejectionBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: C.red500 + '18', borderRadius: 10, padding: 10 },
  rejectionText: { flex: 1, fontSize: 12, color: C.red500, lineHeight: 17 },
  aiBox:         { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: C.blue + '18', borderRadius: 10, padding: 10 },
  aiText:        { flex: 1, fontSize: 12, color: C.blue, lineHeight: 17 },
  docActions:    { flexDirection: 'row', gap: 8 },
  viewBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.blue + '18', borderRadius: 10 },
  viewBtnText:   { fontSize: 13, fontWeight: '600', color: C.blue },
  deleteBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.red500 + '18', borderRadius: 10 },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: C.red500 },
  fab:           { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: C.blue, shadowOpacity: 0.35, shadowRadius: 8 },
  // Category picker sheet
  sheetOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:            { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12 },
  sheetHandle:      { width: 40, height: 4, backgroundColor: C.slate200, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetHeader:      { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  sheetIconWrap:    { width: 48, height: 48, borderRadius: 14, backgroundColor: C.blue + '18', alignItems: 'center', justifyContent: 'center' },
  sheetTitle:       { fontSize: 17, fontWeight: '800', color: C.navy },
  sheetSub:         { fontSize: 12, color: C.slate400, marginTop: 2 },
  catGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  catCard:          { width: '47.5%', backgroundColor: C.bg, borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: C.slate100 },
  catCardIconWrap:  { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catCardLabel:     { fontSize: 13, fontWeight: '700', color: C.navy },
  sheetCancel:      { height: 50, backgroundColor: C.slate100, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  sheetCancelText:  { fontSize: 15, fontWeight: '700', color: C.slate500 },
})
