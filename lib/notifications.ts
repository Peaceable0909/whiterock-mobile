import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase'

// Show notifications even while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

// Ask permission, grab the FCM device token, save it so the server can push.
// Safe to call on every app start — upsert keeps one row per device.
export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice) return // emulators without Play services can't receive pushes

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1B2B4A',
      })
    }

    const { status: existing } = await Notifications.getPermissionsAsync()
    let status = existing
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync()
      status = req.status
    }
    if (status !== 'granted') return

    const { data: token } = await Notifications.getDevicePushTokenAsync()
    if (!token) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('push_tokens').upsert(
      { user_id: user.id, token: String(token), platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' }
    )
  } catch { /* push is best-effort — never block the app */ }
}
