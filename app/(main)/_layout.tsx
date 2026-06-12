import { useEffect, useState } from 'react'
import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { Home, MessageCircle, Users, Bell, Bot } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

function TabIcon({ icon: Icon, focused, label }: { icon: any; focused: boolean; label: string }) {
  return (
    <View style={[ti.wrap, focused && ti.wrapActive]}>
      <Icon size={20} color={focused ? C.white : C.slate500} strokeWidth={focused ? 2.5 : 1.8} />
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
        tabBarIcon: ({ focused }) => <TabIcon icon={Home} focused={focused} label="Home" />,
      }} />
      <Tabs.Screen name="messages/index" options={{
        title: 'Messages',
        tabBarIcon: ({ focused }) => <TabIcon icon={MessageCircle} focused={focused} label="Messages" />,
        tabBarBadge: unread > 0 ? unread : undefined,
      }} />
      <Tabs.Screen name="students/index" options={{
        title: 'Students',
        tabBarIcon: ({ focused }) => <TabIcon icon={Users} focused={focused} label="Students" />,
      }} />
      <Tabs.Screen name="updates" options={{
        title: 'Updates',
        tabBarIcon: ({ focused }) => <TabIcon icon={Bell} focused={focused} label="Updates" />,
      }} />
      <Tabs.Screen name="ai" options={{
        title: 'AI',
        tabBarIcon: ({ focused }) => <TabIcon icon={Bot} focused={focused} label="AI" />,
      }} />
      {/* Hide nested screens from tab bar */}
      <Tabs.Screen name="messages/[id]" options={{ href: null }} />
      <Tabs.Screen name="students/[id]" options={{ href: null }} />
    </Tabs>
  )
}
