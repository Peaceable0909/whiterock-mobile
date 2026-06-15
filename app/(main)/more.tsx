import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, ActivityIndicator, Alert, TextInput, Switch,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import Constants from 'expo-constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors, useTheme } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'
import type { ThemeMode } from '@/lib/theme'

const SUPABASE_URL = 'https://bpranhebhhtvcgcmuegd.supabase.co'

export default function MoreScreen() {
  const C = useColors()
  const s = mkS(C)
  const { mode, setMode } = useTheme()
  const router  = useRouter()
  const insets  = useSafeAreaInsets()
  const [user, setUser]               = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [uploading, setUploading]     = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState('')
  const [savingName, setSavingName]   = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput]     = useState('')
  const [savingPhone, setSavingPhone]   = useState(false)
  const [notifPush, setNotifPush]     = useState(true)
  const [notifEmail, setNotifEmail]   = useState(true)

  const load = async () => {
    const { data: { user: au } } = await supabase.auth.getUser()
    if (!au) return
    const { data } = await supabase.from('users').select('*').eq('id', au.id).single()
    setUser(data)
    setNameInput(data?.name ?? '')
    setPhoneInput(data?.phone ?? '')
    setNotifPush(data?.preferences?.push_enabled !== false)
    setNotifEmail(data?.preferences?.email_digest !== false)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const changeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access in Settings.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    const ext = asset.uri.split('.').pop() ?? 'jpg'
    const path = `${user.id}/avatar.${ext}`
    setUploading(true)
    try {
      const blob = await fetch(asset.uri).then(r => r.blob())
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, {
        contentType: asset.mimeType ?? 'image/jpeg',
        upsert: true,
      })
      if (upErr) throw upErr
      const url = `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`
      await supabase.from('users').update({ avatar_url: url }).eq('id', user.id)
      setUser((u: any) => ({ ...u, avatar_url: url }))
    } catch (e: any) {
      Alert.alert('Upload failed', e.message)
    } finally {
      setUploading(false)
    }
  }

  const saveName = async () => {
    if (!nameInput.trim()) return
    setSavingName(true)
    await supabase.from('users').update({ name: nameInput.trim() }).eq('id', user.id)
    setUser((u: any) => ({ ...u, name: nameInput.trim() }))
    setSavingName(false)
    setEditingName(false)
  }

  const savePhone = async () => {
    setSavingPhone(true)
    await supabase.from('users').update({ phone: phoneInput.trim() }).eq('id', user.id)
    setUser((u: any) => ({ ...u, phone: phoneInput.trim() }))
    setSavingPhone(false)
    setEditingPhone(false)
  }

  const togglePref = async (key: 'push_enabled' | 'email_digest', val: boolean) => {
    if (key === 'push_enabled') setNotifPush(val)
    else setNotifEmail(val)
    const newPrefs = { ...(user?.preferences ?? {}), [key]: val }
    await supabase.from('users').update({ preferences: newPrefs }).eq('id', user.id)
    setUser((u: any) => ({ ...u, preferences: newPrefs }))
  }

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      `A reset link will be sent to ${user?.email}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            const { error } = await supabase.auth.resetPasswordForEmail(user?.email)
            if (error) Alert.alert('Error', error.message)
            else Alert.alert('Sent!', 'Check your inbox for the password reset link.')
          },
        },
      ]
    )
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
                headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
              })
              if (res.ok) {
                await supabase.auth.signOut()
              } else {
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

  const initials = (user?.name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const roleCap = ((user?.role ?? 'student') as string).charAt(0).toUpperCase() + ((user?.role ?? 'student') as string).slice(1)

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} size="large" /></View>

  const APPEARANCE_OPTIONS: { key: ThemeMode; label: string; icon: string }[] = [
    { key: 'light',  label: 'Light',  icon: 'sunny-outline'       },
    { key: 'dark',   label: 'Dark',   icon: 'moon-outline'        },
    { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  ]

  return (
    <ScrollView style={s.bg} contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]} showsVerticalScrollIndicator={false}>

      {/* ── Profile hero ── */}
      <View style={s.profileCard}>
        <TouchableOpacity style={s.avatarWrap} onPress={changeAvatar} disabled={uploading} accessibilityLabel="Change profile photo">
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={s.avatarImg} />
          ) : (
            <View style={s.avatarFallback}>
              <Text style={s.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={s.cameraBadge}>
            {uploading
              ? <ActivityIndicator size="small" color={C.white} />
              : <Ionicons name="camera-outline" size={13} color={C.white} />}
          </View>
        </TouchableOpacity>
        <View style={s.profileInfo}>
          <Text style={s.profileName}>{user?.name ?? 'User'}</Text>
          <Text style={s.profileEmail} numberOfLines={1}>{user?.email ?? ''}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>{roleCap}</Text>
          </View>
        </View>
      </View>

      {/* ── Quick access ── */}
      <Text style={s.sectionLabel}>QUICK ACCESS</Text>
      <View style={s.card}>
        {([
          { label: 'AI Assistant',  icon: 'hardware-chip-outline', color: '#6366F1', route: '/(main)/ai'            },
          { label: 'Updates',       icon: 'newspaper-outline',     color: C.blue,    route: '/(main)/updates'       },
          { label: 'Notifications', icon: 'notifications-outline', color: '#F59E0B', route: '/(main)/notifications' },
          { label: 'Appointments',  icon: 'calendar-outline',      color: '#16A34A', route: '/(main)/appointments'  },
          { label: 'Documents',     icon: 'folder-open-outline',   color: '#7C3AED', route: '/(main)/documents'     },
        ] as const).map((item, i, arr) => (
          <TouchableOpacity
            key={item.label}
            style={[s.row, i < arr.length - 1 && s.border]}
            onPress={() => router.push(item.route as any)}
          >
            <View style={[s.iconBox, { backgroundColor: item.color + '18' }]}>
              <Ionicons name={item.icon as any} size={18} color={item.color} />
            </View>
            <Text style={s.rowLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={15} color={C.slate300} />
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Profile editing ── */}
      <Text style={s.sectionLabel}>PROFILE</Text>
      <View style={s.card}>
        {/* Display name */}
        <View style={[s.row, s.border]}>
          <View style={[s.iconBox, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="person-outline" size={18} color={C.blue} />
          </View>
          {editingName ? (
            <TextInput
              style={[s.rowLabel, s.inlineInput]}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              onSubmitEditing={saveName}
              returnKeyType="done"
              placeholder="Full name"
              placeholderTextColor={C.slate400}
            />
          ) : (
            <Text style={s.rowLabel} numberOfLines={1}>{user?.name ?? 'User'}</Text>
          )}
          <TouchableOpacity
            onPress={editingName ? saveName : () => setEditingName(true)}
            disabled={savingName}
            style={s.editAction}
          >
            {savingName
              ? <ActivityIndicator size="small" color={C.blue} />
              : <Ionicons name={editingName ? 'checkmark-circle' : 'pencil-outline'} size={20} color={editingName ? C.blue : C.slate400} />}
          </TouchableOpacity>
        </View>

        {/* Phone */}
        <View style={[s.row, s.border]}>
          <View style={[s.iconBox, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="call-outline" size={18} color="#16A34A" />
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
              : <Ionicons name={editingPhone ? 'checkmark-circle' : 'pencil-outline'} size={20} color={editingPhone ? '#16A34A' : C.slate400} />}
          </TouchableOpacity>
        </View>

        {/* Email (read-only) */}
        <View style={[s.row, s.border]}>
          <View style={[s.iconBox, { backgroundColor: '#FEF9C3' }]}>
            <Ionicons name="mail-outline" size={18} color="#CA8A04" />
          </View>
          <Text style={[s.rowLabel, { color: C.slate500 }]} numberOfLines={1}>{user?.email ?? ''}</Text>
          <Text style={s.readOnlyTag}>via auth</Text>
        </View>

        {/* Change password */}
        <View style={s.row}>
          <View style={[s.iconBox, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="key-outline" size={18} color="#D97706" />
          </View>
          <Text style={s.rowLabel}>Change Password</Text>
          <TouchableOpacity onPress={handleChangePassword} style={s.sendLinkBtn}>
            <Text style={s.sendLinkText}>Send Link</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Appearance ── */}
      <Text style={s.sectionLabel}>APPEARANCE</Text>
      <View style={s.card}>
        {APPEARANCE_OPTIONS.map((opt, i) => (
          <TouchableOpacity
            key={opt.key}
            style={[s.row, i < APPEARANCE_OPTIONS.length - 1 && s.border]}
            onPress={() => setMode(opt.key)}
          >
            <View style={[s.iconBox, { backgroundColor: C.blue + '18' }]}>
              <Ionicons name={opt.icon as any} size={18} color={C.blue} />
            </View>
            <Text style={s.rowLabel}>{opt.label}</Text>
            {mode === opt.key && <Ionicons name="checkmark" size={18} color={C.blue} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Notifications ── */}
      <Text style={s.sectionLabel}>NOTIFICATIONS</Text>
      <View style={s.card}>
        <View style={[s.row, s.border]}>
          <View style={[s.iconBox, { backgroundColor: '#EFF6FF' }]}>
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
          <View style={[s.iconBox, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="mail-outline" size={18} color="#16A34A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Email Digest</Text>
            <Text style={s.rowSub}>Weekly summary to your inbox</Text>
          </View>
          <Switch
            value={notifEmail}
            onValueChange={v => togglePref('email_digest', v)}
            trackColor={{ false: C.slate200, true: '#16A34A66' }}
            thumbColor={notifEmail ? '#16A34A' : C.slate400}
          />
        </View>
      </View>

      {/* ── App info ── */}
      <Text style={s.sectionLabel}>APP</Text>
      <View style={s.card}>
        <View style={[s.row, s.border]}>
          <View style={[s.iconBox, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="information-circle-outline" size={18} color={C.blue} />
          </View>
          <Text style={s.rowLabel}>Version</Text>
          <Text style={s.rowValue}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
        <View style={s.row}>
          <View style={[s.iconBox, { backgroundColor: '#F8FAFC' }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={C.slate500} />
          </View>
          <Text style={s.rowLabel}>WhiteRock Connect</Text>
          <Text style={s.rowValue}>UK Placement</Text>
        </View>
      </View>

      {/* ── Account / danger ── */}
      <Text style={s.sectionLabel}>ACCOUNT</Text>
      <View style={s.card}>
        <TouchableOpacity
          style={[s.row, s.border]}
          onPress={() => {
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
            ])
          }}
        >
          <View style={[s.iconBox, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          </View>
          <Text style={[s.rowLabel, { color: '#EF4444' }]}>Sign Out</Text>
          <Ionicons name="chevron-forward" size={15} color={C.slate300} />
        </TouchableOpacity>
        <TouchableOpacity style={s.row} onPress={handleDeleteAccount}>
          <View style={[s.iconBox, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.rowLabel, { color: '#DC2626' }]}>Delete Account</Text>
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
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content:        { padding: 16, paddingBottom: 40 },

  profileCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 22, padding: 18, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  avatarWrap:     { position: 'relative', width: 64, height: 64 },
  avatarImg:      { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 22, fontWeight: '800', color: C.white },
  cameraBadge:    { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white },
  profileInfo:    { flex: 1 },
  profileName:    { fontSize: 17, fontWeight: '800', color: C.navy },
  profileEmail:   { fontSize: 12, color: C.slate500, marginTop: 2 },
  roleBadge:      { marginTop: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  roleText:       { fontSize: 10, fontWeight: '700', color: C.blue, textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionLabel:   { fontSize: 10, fontWeight: '800', color: C.slate400, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 4, paddingHorizontal: 4 },
  card:           { backgroundColor: C.white, borderRadius: 18, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  row:            { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  border:         { borderBottomWidth: 1, borderColor: C.slate100 },
  iconBox:        { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowLabel:       { flex: 1, fontSize: 14, fontWeight: '600', color: C.navy },
  rowSub:         { fontSize: 11, color: C.slate400, marginTop: 1 },
  rowValue:       { fontSize: 12, color: C.slate400 },
  editAction:     { padding: 4 },
  inlineInput:    { borderBottomWidth: 1.5, borderColor: C.blue, paddingVertical: 2, paddingHorizontal: 0, minWidth: 80 },
  readOnlyTag:    { fontSize: 10, color: C.slate400, backgroundColor: C.slate100, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  sendLinkBtn:    { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  sendLinkText:   { fontSize: 12, fontWeight: '700', color: C.blue },
})
