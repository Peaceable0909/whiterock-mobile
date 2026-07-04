import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Switch, Image, TextInput
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import Constants from 'expo-constants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase, SUPABASE_URL, SUPABASE_ANON } from '@/lib/supabase'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fullSignOut } from '@/lib/auth'
import { useColors, useTheme, WALLPAPER_OPTIONS, ACCENT_COLORS, BUBBLE_COLORS } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const APPEARANCE_OPTIONS = [
  { key: 'light',  label: 'Light',  icon: 'sunny-outline' },
  { key: 'dark',   label: 'Dark',   icon: 'moon-outline' },
  { key: 'system', label: 'System', icon: 'settings-outline' },
] as const

const BRIGHTNESS_LEVELS = [
  { value: 0.2, label: 'Dim',    icon: 'moon-outline' },
  { value: 0.4, label: 'Low',    icon: 'partly-sunny-outline' },
  { value: 0.6, label: 'Mid',    icon: 'sunny-outline' },
  { value: 0.8, label: 'Bright', icon: 'sunny' },
  { value: 1.0, label: 'Full',   icon: 'sunny' },
] as const

export default function MoreScreen() {
  const C      = useColors()
  const { mode, setMode, wallpaper, setWallpaper, wallpaperBrightness, setWallpaperBrightness, accentColor, setAccentColor, bubbleColor, setBubbleColor } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const s      = mkS(C)

  const [user, setUser]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)

  // Preferences
  const [notifPush, setNotifPush]   = useState(true)
  const [notifEmail, setNotifEmail] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      setUser(data)
      setPhoneInput(data?.phone ?? '')
      const p = (data?.preferences ?? {})
      setNotifPush(p.push_enabled !== false)
      setNotifEmail(!!p.email_digest)
      setLoading(false)
    }
    load()
  }, [])

  // RN's fetch(uri).blob() cannot be serialized by supabase-js on Android;
  // XHR + FormData is the only upload path that works reliably in Expo Go.
  const xhrUpload = async (bucket: string, path: string, uri: string, name: string, type: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`)
      xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`)
      xhr.setRequestHeader('apikey', SUPABASE_ANON)
      xhr.setRequestHeader('x-upsert', 'true')
      const fd = new FormData()
      fd.append('file', { uri, name, type } as any)
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText)))
      xhr.onerror = () => reject(new Error('Network error during upload'))
      xhr.send(fd)
    })
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    })
    if (res.canceled) return
    const asset = res.assets[0]

    setUploading(true)
    try {
      const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase()
      const publicUrl = await xhrUpload('avatars', `${user.id}/${Date.now()}.${ext}`, asset.uri, `avatar.${ext}`, `image/${ext}`)
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id)
      setUser((u: any) => ({ ...u, avatar_url: publicUrl }))
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message)
    } finally {
      setUploading(false)
    }
  }

  const pickWallpaperPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permission needed', 'Please allow access to your photo library.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    })
    if (result.canceled || !result.assets[0]) return
    setUploadingWallpaper(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      // avatars bucket: public (documents is private, so its URLs never render)
      // and its RLS grants own-folder insert/update/delete.
      const oldUrl = wallpaper
      const publicUrl = await xhrUpload(
        'avatars', `${authUser.id}/wallpaper-${Date.now()}.jpg`,
        result.assets[0].uri, 'wallpaper.jpg', 'image/jpeg',
      )
      setWallpaper(publicUrl)
      // Best-effort cleanup of the previous custom wallpaper file.
      const prefix = `${SUPABASE_URL}/storage/v1/object/public/avatars/`
      if (oldUrl.startsWith(prefix)) {
        supabase.storage.from('avatars').remove([decodeURIComponent(oldUrl.slice(prefix.length))]).then(() => {})
      }
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Please try again.')
    } finally {
      setUploadingWallpaper(false)
    }
  }

  const togglePref = async (key: string, val: boolean) => {
    if (key === 'push_enabled') setNotifPush(val)
    else if (key === 'email_digest') setNotifEmail(val)

    const prefs = { ...(user?.preferences ?? {}), [key]: val }
    await supabase.from('users').update({ preferences: prefs }).eq('id', user.id)
    setUser({ ...user, preferences: prefs })
  }

  const savePhone = async () => {
    setSavingPhone(true)
    await supabase.from('users').update({ phone: phoneInput }).eq('id', user.id)
    setUser({ ...user, phone: phoneInput })
    setEditingPhone(false)
    setSavingPhone(false)
  }

  const handleChangePassword = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: 'whiterock://reset-password',
    })
    if (error) Alert.alert('Error', error.message)
    else Alert.alert('Link Sent', 'Check your email for a password reset link.')
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This is permanent. All your data will be deleted immediately. Are you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.functions.invoke('delete-own-account')
            if (error) Alert.alert('Error', error.message)
            else await fullSignOut()
          },
        },
      ]
    )
  }

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color={C.blue} size="large" />
    </View>
  )

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U'
  const isAdmin  = user?.role === 'admin'

  return (
    <ScrollView style={s.bg} contentContainerStyle={[s.content, { paddingTop: insets.top + 10 }]}>
      <View style={s.pageHeader}>
        <Text style={s.pageTitle}>Profile & Settings</Text>
        {isAdmin && (
          <TouchableOpacity style={s.logoContainer} onPress={() => router.push('/(admin)/dashboard')}>
            <Image source={require('../../assets/icon.png')} style={s.logoSmall} resizeMode="contain" />
          </TouchableOpacity>
        )}
      </View>

      {/* â”€â”€ Profile Card â”€â”€ */}
      <View style={s.profileCard}>
        <TouchableOpacity onPress={pickImage} disabled={uploading} style={s.avatarWrap}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={s.avatarImg} />
          ) : (
            <View style={s.avatarFallback}>
              <Text style={s.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={s.cameraBadge}>
            {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={12} color="#fff" />}
          </View>
        </TouchableOpacity>
        <View style={s.profileInfo}>
          <Text style={s.profileName}>{user.name}</Text>
          <Text style={s.profileEmail}>{user.email}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>{user.role}</Text>
          </View>
        </View>
      </View>

      {/* â”€â”€ Contact info â”€â”€ */}
      <Text style={s.sectionLabel}>CONTACT INFO</Text>
      <View style={s.card}>
        <View style={[s.row, s.border]}>
          <View style={[s.iconBox, { backgroundColor: C.green400 + '18' }]}>
            <Ionicons name="call-outline" size={18} color={C.green400} />
          </View>
          {editingPhone ? (
            <TextInput
              style={[s.rowLabel, s.inlineInput]}
              value={phoneInput}
              onChangeText={setPhoneInput}
              autoFocus
              keyboardType="phone-pad"
              onSubmitEditing={savePhone}
              returnKeyType="done"
              placeholder="Phone number"
              placeholderTextColor={C.slate400}
            />
          ) : (
            <Text style={[s.rowLabel, !user?.phone && { color: C.slate400 }]} numberOfLines={1}>
              {user?.phone || 'Add phone number'}
            </Text>
          )}
          <TouchableOpacity
            onPress={editingPhone ? savePhone : () => setEditingPhone(true)}
            disabled={savingPhone}
            style={s.editAction}
          >
            {savingPhone
              ? <ActivityIndicator size="small" color={C.blue} />
              : <Ionicons name={editingPhone ? 'checkmark-circle' : 'pencil-outline'} size={20} color={editingPhone ? C.green400 : C.slate400} />}
          </TouchableOpacity>
        </View>

        <View style={[s.row, s.border]}>
          <View style={[s.iconBox, { backgroundColor: C.orange500 + '20' }]}>
            <Ionicons name="mail-outline" size={18} color={C.orange500} />
          </View>
          <Text style={[s.rowLabel, { color: C.slate500 }]} numberOfLines={1}>{user?.email ?? ''}</Text>
          <Text style={s.readOnlyTag}>via auth</Text>
        </View>

        <View style={s.row}>
          <View style={[s.iconBox, { backgroundColor: C.orange500 + '25' }]}>
            <Ionicons name="key-outline" size={18} color={C.orange500} />
          </View>
          <Text style={s.rowLabel}>Change Password</Text>
          <TouchableOpacity onPress={handleChangePassword} style={s.sendLinkBtn}>
            <Text style={s.sendLinkText}>Send Link</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* â”€â”€ Appearance â”€â”€ */}
      <Text style={s.sectionLabel}>APPEARANCE</Text>
      <View style={s.card}>
        {APPEARANCE_OPTIONS.map((opt, i) => (
          <TouchableOpacity
            key={opt.key}
            style={[s.row, i < APPEARANCE_OPTIONS.length - 1 && s.border]}
            onPress={() => setMode(opt.key)}
          >
            <View style={[s.iconBox, { backgroundColor: C.blue + '18' }]}>
              <Ionicons name={opt.icon} size={18} color={C.blue} />
            </View>
            <Text style={s.rowLabel}>{opt.label}</Text>
            {mode === opt.key && <Ionicons name="checkmark" size={18} color={C.blue} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* â”€â”€ Notifications â”€â”€ */}
      <Text style={s.sectionLabel}>NOTIFICATIONS</Text>
      <View style={s.card}>
        <View style={[s.row, s.border]}>
          <View style={[s.iconBox, { backgroundColor: C.blue + '18' }]}>
            <Ionicons name="notifications-outline" size={18} color={C.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Push Notifications</Text>
            <Text style={s.rowSub}>Real-time alerts on your device</Text>
          </View>
          <Switch
            value={notifPush}
            onValueChange={v => togglePref('push_enabled', v)}
            trackColor={{ false: C.slate200, true: C.blue + '66' }}
            thumbColor={notifPush ? C.blue : C.slate400}
          />
        </View>
        <View style={s.row}>
          <View style={[s.iconBox, { backgroundColor: C.green400 + '18' }]}>
            <Ionicons name="mail-outline" size={18} color={C.green400} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Email Digest</Text>
            <Text style={s.rowSub}>Weekly summary to your inbox</Text>
          </View>
          <Switch
            value={notifEmail}
            onValueChange={v => togglePref('email_digest', v)}
            trackColor={{ false: C.slate200, true: C.green400 + '66' }}
            thumbColor={notifEmail ? C.green400 : C.slate400}
          />
        </View>
      </View>

      {/* â”€â”€ App info â”€â”€ */}
      {user?.role === 'admin' && (
        <>
          <Text style={s.sectionLabel}>ADMINISTRATION</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.row} onPress={() => router.push('/(admin)/dashboard')}>
              <View style={[s.iconBox, { backgroundColor: C.blue + '18' }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={C.blue} />
              </View>
              <Text style={s.rowLabel}>Admin Console</Text>
              <Ionicons name="chevron-forward" size={15} color={C.slate400} />
            </TouchableOpacity>
          </View>
        </>
      )}

      <Text style={s.sectionLabel}>APP</Text>
      <View style={s.card}>
        <View style={[s.row, s.border]}>
          <View style={[s.iconBox, { backgroundColor: C.blue + '18' }]}>
            <Ionicons name="information-circle-outline" size={18} color={C.blue} />
          </View>
          <Text style={s.rowLabel}>Version</Text>
          <Text style={s.rowValue}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
        <View style={s.row}>
          <View style={[s.iconBox, { backgroundColor: C.slate100 }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={C.slate500} />
          </View>
          <Text style={s.rowLabel}>Connect</Text>
          <Text style={s.rowValue}>Premium UK Student Placement</Text>
        </View>
      </View>

      {/* ── Legal ── */}
      <Text style={s.sectionLabel}>LEGAL</Text>
      <View style={s.card}>
        <TouchableOpacity style={[s.row, s.border]} onPress={() => router.push('/(main)/policy?type=privacy')}>
          <View style={[s.iconBox, { backgroundColor: C.blue + '18' }]}>
            <Ionicons name="lock-closed-outline" size={18} color={C.blue} />
          </View>
          <Text style={s.rowLabel}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={15} color={C.slate400} />
        </TouchableOpacity>
        <TouchableOpacity style={s.row} onPress={() => router.push('/(main)/policy?type=company')}>
          <View style={[s.iconBox, { backgroundColor: C.slate100 }]}>
            <Ionicons name="business-outline" size={18} color={C.slate500} />
          </View>
          <Text style={s.rowLabel}>Company Policy</Text>
          <Ionicons name="chevron-forward" size={15} color={C.slate400} />
        </TouchableOpacity>
      </View>

      {/* ── Wallpaper ── */}
      <Text style={s.sectionLabel}>WALLPAPER</Text>
      <View style={s.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.swatchRow}>
          {WALLPAPER_OPTIONS.map(opt => (
            <TouchableOpacity key={opt.id} style={s.swatchWrap} onPress={() => setWallpaper(opt.id)}>
              <View style={[
                s.swatch,
                opt.color ? { backgroundColor: opt.color } : s.swatchDefault,
                (wallpaper === opt.id || (opt.id === '' && !wallpaper)) && s.swatchActive,
              ]} />
              <Text style={[s.swatchLabel, (wallpaper === opt.id || (opt.id === '' && !wallpaper)) && { color: C.blue }]}>{opt.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[s.row, { borderTopWidth: 1, borderTopColor: C.slate100 }]}
          onPress={pickWallpaperPhoto}
          disabled={uploadingWallpaper}
        >
          <View style={[s.iconBox, { backgroundColor: C.blue + '18' }]}>
            {uploadingWallpaper
              ? <ActivityIndicator size="small" color={C.blue} />
              : <Ionicons name="image-outline" size={18} color={C.blue} />}
          </View>
          <Text style={s.rowLabel}>{uploadingWallpaper ? 'Uploading…' : 'Upload Custom Photo'}</Text>
          {!uploadingWallpaper && <Ionicons name="chevron-forward" size={15} color={C.slate400} />}
        </TouchableOpacity>

        {wallpaper.startsWith('http') && (
          <TouchableOpacity
            style={[s.row, { borderTopWidth: 1, borderTopColor: C.slate100 }]}
            onPress={() => setWallpaper('')}
          >
            <View style={[s.iconBox, { backgroundColor: C.red500 + '18' }]}>
              <Ionicons name="trash-outline" size={18} color={C.red500} />
            </View>
            <Text style={[s.rowLabel, { color: C.red500 }]}>Remove Custom Photo</Text>
          </TouchableOpacity>
        )}
      </View>

      {wallpaper.startsWith('http') && (
        <>
          <Text style={s.sectionLabel}>WALLPAPER BRIGHTNESS</Text>
          <View style={s.card}>
            <View style={s.brightnessRow}>
              {BRIGHTNESS_LEVELS.map(level => (
                <TouchableOpacity
                  key={level.value}
                  onPress={() => setWallpaperBrightness(level.value)}
                  style={[s.brightnessBtn, wallpaperBrightness === level.value && s.brightnessBtnActive]}
                >
                  <Ionicons name={level.icon as any} size={16} color={wallpaperBrightness === level.value ? C.white : C.slate500} />
                  <Text style={[s.brightnessLabel, wallpaperBrightness === level.value && { color: C.white }]}>{level.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}

      {/* ── Accent Color ── */}
      <Text style={s.sectionLabel}>ACCENT COLOR</Text>
      <View style={s.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.swatchRow}>
          {ACCENT_COLORS.map(opt => (
            <TouchableOpacity key={opt.id} style={s.swatchWrap} onPress={() => setAccentColor(opt.id)}>
              <View style={[s.swatch, { backgroundColor: opt.color }, accentColor === opt.id && s.swatchActive]} />
              <Text style={[s.swatchLabel, accentColor === opt.id && { color: C.blue }]}>{opt.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Bubble Color ── */}
      <Text style={s.sectionLabel}>BUBBLE COLOR</Text>
      <View style={s.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.swatchRow}>
          {BUBBLE_COLORS.map(opt => (
            <TouchableOpacity key={opt.id} style={s.swatchWrap} onPress={() => setBubbleColor(opt.id)}>
              <View style={[s.swatch, { backgroundColor: opt.color }, bubbleColor === opt.id && s.swatchActive]} />
              <Text style={[s.swatchLabel, bubbleColor === opt.id && { color: C.blue }]}>{opt.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Account / danger ── */}
      <Text style={s.sectionLabel}>ACCOUNT</Text>
      <View style={s.card}>
        <TouchableOpacity
          style={[s.row, s.border]}
          onPress={() => {
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign Out', style: 'destructive',
                onPress: () => fullSignOut(),
              },
            ])
          }}
        >
          <View style={[s.iconBox, { backgroundColor: C.red500 + '18' }]}>
            <Ionicons name="log-out-outline" size={18} color={C.red500} />
          </View>
          <Text style={[s.rowLabel, { color: C.red500 }]}>Sign Out</Text>
          <Ionicons name="chevron-forward" size={15} color={C.slate300} />
        </TouchableOpacity>
        <TouchableOpacity style={s.row} onPress={handleDeleteAccount}>
          <View style={[s.iconBox, { backgroundColor: C.red500 + '18' }]}>
            <Ionicons name="trash-outline" size={18} color={C.red500} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.rowLabel, { color: C.red500 }]}>Delete Account</Text>
            <Text style={s.rowSub}>Permanently deletes all your data</Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={C.slate300} />
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:             { flex: 1, backgroundColor: C.bg },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  content:        { padding: 20, paddingBottom: 40 },
  pageHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, marginBottom: 8 },
  pageTitle:      { fontSize: 20, fontWeight: '800', color: C.navy },
  logoContainer:  { width: 40, height: 40, borderRadius: 12, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  logoSmall:      { width: 24, height: 24 },

  profileCard:    { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.white, borderRadius: 24, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  avatarWrap:     { position: 'relative', width: 64, height: 64 },
  avatarImg:      { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 22, fontWeight: '800', color: C.white },
  cameraBadge:    { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white },
  profileInfo:    { flex: 1 },
  profileName:    { fontSize: 18, fontWeight: '800', color: C.navy },
  profileEmail:   { fontSize: 13, color: C.slate500, marginTop: 2 },
  roleBadge:      { marginTop: 8, backgroundColor: C.blue + '14', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' },
  roleText:       { fontSize: 10, fontWeight: '800', color: C.blue, textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionLabel:   { fontSize: 10, fontWeight: '800', color: C.slate400, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 4, paddingHorizontal: 4 },
  card:           { backgroundColor: C.white, borderRadius: 22, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  row:            { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  border:         { borderBottomWidth: 1, borderColor: C.slate100 },
  iconBox:        { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowLabel:       { flex: 1, fontSize: 14, fontWeight: '600', color: C.navy },
  rowSub:         { fontSize: 11, color: C.slate400, marginTop: 2 },
  rowValue:       { fontSize: 12, color: C.slate400 },
  editAction:     { padding: 4 },
  inlineInput:    { borderBottomWidth: 1.5, borderColor: C.blue, paddingVertical: 2, paddingHorizontal: 0, minWidth: 100 },
  readOnlyTag:    { fontSize: 10, color: C.slate400, backgroundColor: C.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  sendLinkBtn:    { backgroundColor: C.blue + '14', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  sendLinkText:   { fontSize: 12, fontWeight: '700', color: C.blue },
  swatchRow:        { paddingHorizontal: 16, paddingVertical: 14, gap: 16 },
  swatchWrap:       { alignItems: 'center', gap: 6 },
  swatch:           { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  swatchDefault:    { backgroundColor: C.slate100, borderStyle: 'dashed', borderColor: C.slate400 },
  swatchActive:     { borderColor: C.blue, shadowColor: C.blue, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  swatchLabel:      { fontSize: 10, fontWeight: '600', color: C.slate400 },
  brightnessRow:    { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  brightnessBtn:    { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: C.slate100, gap: 4 },
  brightnessBtnActive: { backgroundColor: C.blue },
  brightnessLabel:  { fontSize: 10, fontWeight: '700', color: C.slate500 },
})

