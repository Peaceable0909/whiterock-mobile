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
