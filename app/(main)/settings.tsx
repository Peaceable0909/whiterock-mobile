import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Image, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { supabase, SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import { useColors, useTheme, WALLPAPER_OPTIONS, ACCENT_COLORS, BUBBLE_COLORS, type ThemeMode } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const VERSION    = Constants.expoConfig?.version ?? '1.0.0'

const THEME_OPTIONS: { id: ThemeMode; label: string; icon: string }[] = [
  { id: 'light',  label: 'Light',   icon: 'sunny-outline' },
  { id: 'dark',   label: 'Dark',    icon: 'moon-outline' },
  { id: 'system', label: 'System',  icon: 'phone-portrait-outline' },
]

export default function SettingsScreen() {
  const C          = useColors()
  const s          = mkS(C)
  const router     = useRouter()
  const insets     = useSafeAreaInsets()
  const { mode, setMode, wallpaper, setWallpaper, accentColor, setAccentColor, bubbleColor, setBubbleColor } = useTheme()

  const [user, setUser]               = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [signingOut, setSigningOut]   = useState(false)
  const [uploadingWp, setUploadingWp] = useState(false)
  const [previewWp, setPreviewWp]     = useState<string>(wallpaper)

  // Keep preview in sync when wallpaper changes externally
  useEffect(() => { setPreviewWp(wallpaper) }, [wallpaper])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: au } }) => {
      if (!au) return
      supabase.from('users').select('*').eq('id', au.id).single()
        .then(({ data }) => { setUser(data); setLoading(false) })
    })
  }, [])

  const applyWallpaper = useCallback((id: string) => {
    setPreviewWp(id)
    setWallpaper(id)
  }, [setWallpaper])

  const pickCustomWallpaper = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to pick a wallpaper.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [9, 16],
    })
    if (result.canceled || !result.assets?.[0]) return

    setUploadingWp(true)
    try {
      const { data: { user: au } } = await supabase.auth.getUser()
      if (!au) throw new Error('Not authenticated')

      const uri  = result.assets[0].uri
      const ext  = uri.split('.').pop() ?? 'jpg'
      const path = `${au.id}/wallpaper.${ext}`
      const mime = ext.toLowerCase() === 'jpg' ? 'image/jpeg' : `image/${ext.toLowerCase()}`
      const { data: { session } } = await supabase.auth.getSession()
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/avatars/${path}`)
        xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`)
        xhr.setRequestHeader('apikey', SUPABASE_ANON)
        xhr.setRequestHeader('x-upsert', 'true')
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText))
        xhr.onerror = () => reject(new Error('Upload failed'))
        const fd = new FormData()
        fd.append('file', { uri, name: `wallpaper.${ext}`, type: mime } as any)
        xhr.send(fd)
      })

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`
      applyWallpaper(publicUrl)
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload the image.')
    } finally {
      setUploadingWp(false)
    }
  }

  const resetAppearance = () => {
    Alert.alert('Reset appearance', 'Restore theme to Light and remove wallpaper?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive',
        onPress: () => { setMode('light'); applyWallpaper('') },
      },
    ])
  }

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => { setSigningOut(true); await supabase.auth.signOut() },
      },
    ])
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever', style: 'destructive',
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            try {
              const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-own-account`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
              })
              if (res.ok) { await supabase.auth.signOut() }
              else {
                const body = await res.json().catch(() => ({}))
                Alert.alert('Error', body.error ?? 'Deletion failed. Contact support.')
              }
            } catch {
              Alert.alert('Error', 'Could not reach the server. Try again later.')
            }
          },
        },
      ]
    )
  }

  // Live wallpaper preview behind the settings header
  const bgStyle = (() => {
    if (!previewWp) return {}
    if (previewWp.startsWith('http')) return { backgroundColor: 'transparent' }
    const color = WALLPAPER_OPTIONS.find(w => w.id === previewWp)?.color
    return color ? { backgroundColor: color } : {}
  })()

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>

  const initials = (user?.name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const roleLabel = (user?.role ?? 'student')
  const roleCap   = roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)

  return (
    <View style={[s.bg, { paddingTop: insets.top }]}>
      {/* Custom wallpaper image layer */}
      {previewWp.startsWith('http') && (
        <Image source={{ uri: previewWp }} style={s.wallpaperBg} blurRadius={Platform.OS === 'ios' ? 20 : 10} />
      )}

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={20} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: 48 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={[s.profileCard, bgStyle]}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{user?.name ?? 'User'}</Text>
            <Text style={s.profileEmail}>{user?.email ?? ''}</Text>
            <View style={s.roleBadge}>
              <Text style={s.roleText}>{roleCap}</Text>
            </View>
          </View>
        </View>

        {/* ── APPEARANCE ─────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>APPEARANCE</Text>

        {/* Theme mode */}
        <View style={s.section}>
          <View style={[s.row, s.borderBottom, { paddingBottom: 12 }]}>
            <View style={[s.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="color-palette-outline" size={18} color={C.blue} />
            </View>
            <Text style={s.rowLabel}>Theme</Text>
          </View>
          <View style={s.themeRow}>
            {THEME_OPTIONS.map(opt => {
              const active = mode === opt.id
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.themeBtn, active && s.themeBtnActive]}
                  onPress={() => setMode(opt.id)}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={20}
                    color={active ? C.white : C.slate500}
                  />
                  <Text style={[s.themeBtnText, active && { color: C.white }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Wallpaper */}
        <View style={s.section}>
          <View style={[s.row, s.borderBottom, { paddingBottom: 12 }]}>
            <View style={[s.iconBox, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="image-outline" size={18} color="#7C3AED" />
            </View>
            <Text style={s.rowLabel}>Chat Background</Text>
          </View>

          {/* Built-in swatches */}
          <View style={s.swatchGrid}>
            {WALLPAPER_OPTIONS.map(wp => {
              const active = previewWp === wp.id
              return (
                <TouchableOpacity
                  key={wp.id}
                  style={[
                    s.swatch,
                    wp.color ? { backgroundColor: wp.color } : s.swatchDefault,
                    active && s.swatchActive,
                  ]}
                  onPress={() => applyWallpaper(wp.id)}
                >
                  {!wp.color && (
                    <Ionicons name="ban-outline" size={14} color={C.slate400} />
                  )}
                  {active && (
                    <View style={s.swatchCheck}>
                      <Ionicons name="checkmark" size={12} color={C.white} />
                    </View>
                  )}
                  <Text style={s.swatchLabel}>{wp.name}</Text>
                </TouchableOpacity>
              )
            })}

            {/* Custom upload tile */}
            <TouchableOpacity
              style={[s.swatch, s.swatchUpload, previewWp.startsWith('http') && s.swatchActive]}
              onPress={pickCustomWallpaper}
              disabled={uploadingWp}
            >
              {uploadingWp
                ? <ActivityIndicator size="small" color={C.blue} />
                : <>
                    <Ionicons name="add-circle-outline" size={20} color={C.blue} />
                    {previewWp.startsWith('http') && (
                      <View style={s.swatchCheck}>
                        <Ionicons name="checkmark" size={12} color={C.white} />
                      </View>
                    )}
                  </>}
              <Text style={[s.swatchLabel, { color: C.blue }]}>Custom</Text>
            </TouchableOpacity>
          </View>

          {/* Wallpaper preview strip */}
          {!!previewWp && (
            <View style={s.previewStrip}>
              <View style={[
                s.previewBubble,
                previewWp.startsWith('http')
                  ? {}
                  : { backgroundColor: WALLPAPER_OPTIONS.find(w => w.id === previewWp)?.color ?? C.bg },
              ]}>
                {previewWp.startsWith('http') && (
                  <Image source={{ uri: previewWp }} style={StyleSheet.absoluteFill} blurRadius={4} />
                )}
                <View style={s.previewMsg}>
                  <Text style={s.previewMsgText}>Preview message</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Accent Color */}
        <View style={s.section}>
          <View style={[s.row, s.borderBottom, { paddingBottom: 12 }]}>
            <View style={[s.iconBox, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="sparkles-outline" size={18} color="#8B5CF6" />
            </View>
            <Text style={s.rowLabel}>Accent Color</Text>
          </View>
          <View style={s.swatchGrid}>
            {ACCENT_COLORS.map(ac => {
              const active = accentColor === ac.id
              return (
                <TouchableOpacity
                  key={ac.id}
                  style={[
                    s.swatch,
                    { backgroundColor: ac.color },
                    active && s.swatchActive,
                  ]}
                  onPress={() => setAccentColor(ac.id)}
                >
                  {active && (
                    <View style={s.swatchCheck}>
                      <Ionicons name="checkmark" size={12} color={C.white} />
                    </View>
                  )}
                  <Text style={s.swatchLabel}>{ac.name}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Chat Bubble Color */}
        <View style={s.section}>
          <View style={[s.row, s.borderBottom, { paddingBottom: 12 }]}>
            <View style={[s.iconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="chatbubbles-outline" size={18} color="#F59E0B" />
            </View>
            <Text style={s.rowLabel}>Chat Bubble Color</Text>
          </View>
          <View style={s.swatchGrid}>
            {BUBBLE_COLORS.map(bc => {
              const active = bubbleColor === bc.id
              return (
                <TouchableOpacity
                  key={bc.id}
                  style={[
                    s.swatch,
                    { backgroundColor: bc.color },
                    active && s.swatchActive,
                  ]}
                  onPress={() => setBubbleColor(bc.id)}
                >
                  {active && (
                    <View style={s.swatchCheck}>
                      <Ionicons name="checkmark" size={12} color={C.white} />
                    </View>
                  )}
                  <Text style={s.swatchLabel}>{bc.name}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Reset */}
        <TouchableOpacity style={[s.section, s.resetRow]} onPress={resetAppearance}>
          <Ionicons name="refresh-outline" size={16} color={C.slate500} />
          <Text style={s.resetText}>Reset appearance to default</Text>
        </TouchableOpacity>

        {/* ── ACCOUNT ────────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <View style={s.section}>
          <TouchableOpacity style={s.row} onPress={handleSignOut} disabled={signingOut}>
            <View style={[s.iconBox, { backgroundColor: '#FEF2F2' }]}>
              {signingOut
                ? <ActivityIndicator size="small" color="#EF4444" />
                : <Ionicons name="log-out-outline" size={18} color="#EF4444" />}
            </View>
            <Text style={[s.rowLabel, { color: '#EF4444' }]}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={16} color={C.slate400} />
          </TouchableOpacity>
        </View>

        {/* ── APP INFO ───────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>APP</Text>
        <View style={s.section}>
          <View style={[s.row, s.borderBottom]}>
            <View style={[s.iconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="information-circle-outline" size={18} color={C.blue} />
            </View>
            <Text style={s.rowLabel}>Version</Text>
            <Text style={s.rowValue}>v{VERSION}</Text>
          </View>
          <View style={s.row}>
            <View style={[s.iconBox, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#16A34A" />
            </View>
            <Text style={s.rowLabel}>Connect</Text>
            <Text style={s.rowValue}>University Placement</Text>
          </View>
        </View>

        {/* ── DANGER ZONE ────────────────────────────────────────── */}
        <Text style={s.sectionLabel}>DANGER ZONE</Text>
        <View style={s.section}>
          <TouchableOpacity style={s.row} onPress={handleDeleteAccount}>
            <View style={[s.iconBox, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: '#DC2626' }]}>Delete Account</Text>
              <Text style={s.rowSub}>Permanently deletes all your data</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.slate400} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:             { flex: 1, backgroundColor: C.bg },
  wallpaperBg:    { ...StyleSheet.absoluteFillObject, opacity: 0.18 },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  back:           { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { fontSize: 18, fontWeight: '800', color: C.navy },
  content:        { padding: 16, paddingBottom: 48 },

  profileCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatar:         { width: 56, height: 56, borderRadius: 28, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: 18, fontWeight: '800', color: C.white },
  profileInfo:    { flex: 1 },
  profileName:    { fontSize: 16, fontWeight: '800', color: C.navy },
  profileEmail:   { fontSize: 12, color: C.slate500, marginTop: 2 },
  roleBadge:      { marginTop: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start' },
  roleText:       { fontSize: 10, fontWeight: '700', color: C.blue, textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionLabel:   { fontSize: 10, fontWeight: '800', color: C.slate400, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 4, paddingHorizontal: 4 },
  section:        { backgroundColor: C.white, borderRadius: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, overflow: 'hidden' },
  row:            { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  borderBottom:   { borderBottomWidth: 1, borderColor: C.slate100 },
  iconBox:        { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel:       { flex: 1, fontSize: 14, fontWeight: '600', color: C.navy },
  rowValue:       { fontSize: 12, color: C.slate400 },
  rowSub:         { fontSize: 11, color: C.slate400, marginTop: 1 },

  // Theme selector
  themeRow:       { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  themeBtn:       { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: C.slate200, backgroundColor: C.bg },
  themeBtnActive: { backgroundColor: C.blue, borderColor: C.blue },
  themeBtnText:   { fontSize: 11, fontWeight: '700', color: C.slate500 },

  // Wallpaper swatches
  swatchGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14 },
  swatch:         { width: 68, height: 68, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  swatchDefault:  { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.slate200 },
  swatchUpload:   { backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#BFDBFE', borderStyle: 'dashed' },
  swatchActive:   { borderWidth: 2.5, borderColor: C.blue },
  swatchCheck:    { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  swatchLabel:    { position: 'absolute', bottom: 4, fontSize: 9, fontWeight: '700', color: C.slate600, textAlign: 'center' },

  // Preview strip
  previewStrip:   { marginHorizontal: 14, marginBottom: 14, borderRadius: 14, overflow: 'hidden' },
  previewBubble:  { height: 80, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 12 },
  previewMsg:     { backgroundColor: C.blue, borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 12, paddingVertical: 8 },
  previewMsgText: { fontSize: 12, color: C.white, fontWeight: '600' },

  // Reset
  resetRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginBottom: 16 },
  resetText:      { fontSize: 13, color: C.slate500, fontWeight: '600' },
})
