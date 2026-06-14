import { useEffect, useState } from 'react'
import { Tabs, router } from 'expo-router'
import { View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { supabase } from '@/lib/supabase'
import { registerForPush } from '@/lib/notifications'
import { C } from '@/constants/colors'

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View style={[ti.wrap, focused && ti.wrapActive]}>
      <Ionicons name={name as any} size={20} color={focused ? C.white : C.slate500} />
    </View>
  )
}

const ti = StyleSheet.create({
  wrap:       { width: 44, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  wrapActive: { backgroundColor: C.blue },
})

export default function MainLayout() {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const fetchUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single()
      const role = dbUser?.role ?? 'student'
      const { data: convs } = await supabase.from('conversations').select('unread_student, unread_staff')
      if (convs) {
        const total = convs.reduce((s, c) => s + (role === 'student' ? (c.unread_student ?? 0) : (c.unread_staff ?? 0)), 0)
        setUnread(total)
      }
    }
    fetchUnread()
  }, [])

  // Push notifications: register this device + open the app on tap
  useEffect(() => {
    registerForPush()
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/(main)/notifications')
    })
    return () => sub.remove()
  }, [])

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: C.white,
        borderTopColor: C.slate100,
        height: 68,
        paddingBottom: 12,
        paddingTop: 8,
      },
      tabBarShowLabel: true,
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      tabBarActiveTintColor: C.blue,
      tabBarInactiveTintColor: C.slate400,
    }}>
      <Tabs.Screen name="home" options={{
        title: 'Home',
        tabBarIcon: ({ focused }) => <TabIcon name="home-outline" focused={focused} />,
      }} />
      <Tabs.Screen name="messages/index" options={{
        title: 'Messages',
        tabBarIcon: ({ focused }) => <TabIcon name="chatbubble-outline" focused={focused} />,
        tabBarBadge: unread > 0 ? unread : undefined,
      }} />
      <Tabs.Screen name="students/index" options={{
        title: 'Students',
        tabBarIcon: ({ focused }) => <TabIcon name="people-outline" focused={focused} />,
      }} />
      <Tabs.Screen name="updates" options={{
        title: 'Updates',
        tabBarIcon: ({ focused }) => <TabIcon name="notifications-outline" focused={focused} />,
      }} />
      <Tabs.Screen name="ai" options={{
        title: 'AI',
        tabBarIcon: ({ focused }) => <TabIcon name="hardware-chip-outline" focused={focused} />,
      }} />
      {/* Hide nested screens from tab bar */}
      <Tabs.Screen name="messages/[id]" options={{ href: null }} />
      <Tabs.Screen name="students/[id]" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="update-compose" options={{ href: null }} />
    </Tabs>
  )
}
