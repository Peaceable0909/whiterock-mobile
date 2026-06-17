import { useEffect, useState } from 'react'
import { Tabs, router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { registerForPush } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'

export default function MainLayout() {
  const [role, setRole] = useState<string | null>(null)
  const C      = useColors()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    // Fast path: cached role → instant tab bar on re-open
    AsyncStorage.getItem('cached_role').then(r => { if (r) setRole(r) })

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setRole('staff'); return }
      const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
      const r = data?.role ?? 'student'
      setRole(r)
      AsyncStorage.setItem('cached_role', r)
    })

    registerForPush()
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any
      if (data?.screen === 'messages' && data?.convId) {
        router.push(`/(main)/messages/${data.convId}` as any)
      } else if (data?.screen === 'students' && data?.studentId) {
        router.push(`/(main)/students/${data.studentId}` as any)
      } else {
        router.push('/(main)/notifications')
      }
    })
    return () => sub.remove()
  }, [])

  const isStudent = role === 'student'

  const tabBarStyle = isStudent ? {
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.slate100,
    height: 60 + insets.bottom,
    paddingBottom: insets.bottom + 6,
    paddingTop: 8,
    elevation: 12,
    shadowColor: '#1B2B4A',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
  } : { display: 'none' as const }

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle,
      tabBarActiveTintColor: C.blue,
      tabBarInactiveTintColor: C.slate400,
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: -2 },
    }}>
      <Tabs.Screen name="home" options={{
        tabBarLabel: 'Home',
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
        ),
      }} />
      <Tabs.Screen name="messages/index" options={{
        tabBarLabel: 'Messages',
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={22} color={color} />
        ),
      }} />
      <Tabs.Screen name="ai" options={{
        tabBarLabel: 'AI',
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? 'hardware-chip' : 'hardware-chip-outline'} size={22} color={color} />
        ),
      }} />
      {/* Slot 4 swaps: students for staff, updates for students */}
      <Tabs.Screen name="students/index" options={{
        href: isStudent ? null : undefined,
        tabBarLabel: 'Students',
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} />
        ),
      }} />
      <Tabs.Screen name="updates" options={{
        href: isStudent ? undefined : null,
        tabBarLabel: 'Updates',
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? 'newspaper' : 'newspaper-outline'} size={22} color={color} />
        ),
      }} />
      <Tabs.Screen name="more" options={{
        tabBarLabel: 'More',
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
        ),
      }} />

      {/* Push-only / deep-link screens */}
      <Tabs.Screen name="messages/[id]"         options={{ href: null }} />
      <Tabs.Screen name="students/[id]"         options={{ href: null }} />
      <Tabs.Screen name="notifications"         options={{ href: null }} />
      <Tabs.Screen name="update-compose"        options={{ href: null }} />
      <Tabs.Screen name="appointments"          options={{ href: null }} />
      <Tabs.Screen name="documents"             options={{ href: null }} />
      <Tabs.Screen name="settings"              options={{ href: null }} />
      <Tabs.Screen name="payments"              options={{ href: null }} />
      <Tabs.Screen name="university-offers"     options={{ href: null }} />
      <Tabs.Screen name="resources"             options={{ href: null }} />
      <Tabs.Screen name="tasks"                 options={{ href: null }} />
      <Tabs.Screen name="calendar"              options={{ href: null }} />
      <Tabs.Screen name="groups/index"          options={{ href: null }} />
      <Tabs.Screen name="groups/[id]"           options={{ href: null }} />
      <Tabs.Screen name="my-profile/index"      options={{ href: null }} />
    </Tabs>
  )
}
