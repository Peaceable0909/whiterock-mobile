import { Stack } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { useColors } from '@/lib/theme'

export default function AdminLayout() {
  const C    = useColors()
  const role = useRoleGuard(['admin'])
  if (!role) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator color={C.blue} size="large" />
    </View>
  )
  // Transparent scenes — the shared AppCanvas at the root shows through.
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: 'transparent' } }} />
}
