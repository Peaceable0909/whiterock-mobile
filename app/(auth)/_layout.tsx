import { Stack } from 'expo-router'

export default function AuthLayout() {
  // Transparent scenes — the shared AppCanvas at the root shows through.
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
}
