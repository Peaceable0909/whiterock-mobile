import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'
import { unregisterForPush } from './notifications'

// Complete sign-out: the app must behave like a fresh install afterwards.
// - push token removed so the device stops receiving this user's notifications
// - native Google session cleared so the next sign-in shows the account picker
// - Supabase session + secure-store tokens cleared
// - every cached preference (role, wallpaper, theme, pending invites) wiped
export async function fullSignOut() {
  try { await unregisterForPush() } catch {}

  if (Platform.OS !== 'web') {
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin')
      await GoogleSignin.signOut()
    } catch { /* not signed in with Google, or Expo Go — fine */ }
  }

  try { await supabase.auth.signOut() } catch {}
  try { await AsyncStorage.clear() } catch {}
}
