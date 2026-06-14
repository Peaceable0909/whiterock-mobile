import { Stack } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useRoleGuard } from '@/hooks/useRoleGuard'
import { C } from '@/constants/colors'

export default function AdminLayout() {
  const role = useRoleGuard(['admin'])
  if (!role) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator color={C.blue} size="large" />
    </View>
  )
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
}
