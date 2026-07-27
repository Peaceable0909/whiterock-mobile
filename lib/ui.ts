import { Platform, Alert } from 'react-native'
import * as Haptics from 'expo-haptics'

// Alert.alert renders nothing on react-native-web, so errors and confirms
// silently vanish in the browser. These helpers work on all platforms.

export const showAlert = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title)
  } else {
    Alert.alert(title, message)
  }
}

export const confirmDialog = (
  title: string,
  message: string,
  confirmLabel = 'OK',
  destructive = false,
): Promise<boolean> =>
  new Promise(resolve => {
    if (Platform.OS === 'web') {
      resolve(window.confirm(`${title}\n\n${message}`))
      return
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ])
  })

// Safe initials helper — `name` can be null/empty for users who haven't
// finished onboarding yet (invited staff, Google sign-ins pre-redeem), and
// calling .split() directly on that crashes the whole screen.
export const getInitials = (name?: string | null): string => {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return '?'
  return trimmed.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

// expo-haptics rejects on web; swallow everywhere so callers can fire-and-forget.
const canHaptic = Platform.OS !== 'web'
export const haptic = {
  light:     () => { if (canHaptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}) },
  medium:    () => { if (canHaptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}) },
  heavy:     () => { if (canHaptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}) },
  selection: () => { if (canHaptic) Haptics.selectionAsync().catch(() => {}) },
  success:   () => { if (canHaptic) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}) },
  warning:   () => { if (canHaptic) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}) },
}
