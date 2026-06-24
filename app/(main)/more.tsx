import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Switch, Image, TextInput
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import Constants from 'expo-constants'
import { supabase } from '@/lib/supabase'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { unregisterForPush } from '@/lib/notifications'
import { useColors, useTheme } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

const APPEARANCE_OPTIONS = [
  { key: 'light',  label: 'Light',  icon: 'sunny-outline' },
  { key: 'dark',   label: 'Dark',   icon: 'moon-outline' },
  { key: 'system', label: 'System', icon: 'settings-outline' },
] as const

export default function MoreScreen() {
  const C      = useColors()
  const { mode, setMode } = useTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const s      = mkS(C)

  const [user, setUser]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
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
      const p = (data?.preferences ?? {}) as any
      setNotifPush(p.push_enabled !== false)
      setNotifEmail(!!p.email_digest)
      setLoading(false)
    }
    load()
  }, [])

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
      const ext = asset.uri.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const formData = new FormData()
      formData.append('file', {
        uri: asset.uri,
        name: `avatar.${ext}`,
        type: `image/${ext}`,
      } as any)

      const { data, error } = await supabase.storage.from('avatars').upload(path, formData)
      if (error) throw error

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id)
      setUser({ ...user, avatar_url: publicUrl })
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message)
    } finally {
      setUploading(false)
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
            else await supabase.auth.signOut()
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

  return (
    <ScrollView style={s.bg} contentContainerStyle={[s.content, { paddingTop: insets.top + 10 }]}>
      <View style={s.pageHeader}>
        <Text style={s.pageTitle}>Profile & Settings</Text>
        <TouchableOpacity style={s.logoContainer} onPress={() => router.push('/(admin)/dashboard' as any)}>
           <Image source={require('../../assets/icon.png')} style={s.logoSmall} resizeMode="contain" />
        </TouchableOpacity>
      </View>

      {/* ── Profile Card ── */}
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

      {/* ── Contact info ── */}
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

      {/* ── App info ── */}
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
                onPress: async () => {
                  await unregisterForPush()
                  await supabase.auth.signOut()
                },
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
})
