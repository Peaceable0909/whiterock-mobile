import { useEffect, useState, useRef } from 'react'
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
  const [role, setRole]     = useState<string | null>(null)
  const roleRef = useRef<string>('student')

  useEffect(() => {
    let uid = ''
    const fetchUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      uid = user.id
      const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single()
      const r = dbUser?.role ?? 'student'
      roleRef.current = r
      setRole(r)
      const { data: convs } = await supabase.from('conversations').select('unread_student, unread_staff')
      if (convs) {
        const total = convs.reduce((s, c) => s + (r === 'student' ? (c.unread_student ?? 0) : (c.unread_staff ?? 0)), 0)
        setUnread(total)
      }
    }
    fetchUnread()

    // Realtime: update badge when any conversation changes
    const sub = supabase.channel('main-layout-convs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, async () => {
        const { data: convs } = await supabase.from('conversations').select('unread_student, unread_staff')
        if (convs) {
          const r = roleRef.current
          const total = convs.reduce((s, c) => s + (r === 'student' ? (c.unread_student ?? 0) : (c.unread_staff ?? 0)), 0)
          setUnread(total)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [])

  // Push notifications: register this device + open the app on tap
  useEffect(() => {
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
      {/* Slot 3: AI for students, Students for staff — whichever is visible lands at position 3 */}
      <Tabs.Screen name="ai" options={{
        title: 'AI',
        href: isStudent ? undefined : null,
        tabBarIcon: ({ focused }) => <TabIcon name="hardware-chip-outline" focused={focused} />,
      }} />
      <Tabs.Screen name="students/index" options={{
        title: 'Students',
        href: isStudent ? null : undefined,
        tabBarIcon: ({ focused }) => <TabIcon name="people-outline" focused={focused} />,
      }} />
      <Tabs.Screen name="more" options={{
        title: 'More',
        tabBarIcon: ({ focused }) => <TabIcon name="grid-outline" focused={focused} />,
      }} />
      {/* Screens accessible as routes but hidden from tab bar */}
      <Tabs.Screen name="updates"          options={{ href: null }} />
      <Tabs.Screen name="messages/[id]"    options={{ href: null }} />
      <Tabs.Screen name="students/[id]"    options={{ href: null }} />
      <Tabs.Screen name="notifications"    options={{ href: null }} />
      <Tabs.Screen name="update-compose"   options={{ href: null }} />
      <Tabs.Screen name="appointments"     options={{ href: null }} />
      <Tabs.Screen name="documents"        options={{ href: null }} />
      <Tabs.Screen name="settings"         options={{ href: null }} />
    </Tabs>
  )
}
