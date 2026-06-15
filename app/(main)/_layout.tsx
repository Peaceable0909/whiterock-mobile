import { useEffect } from 'react'
import { Tabs, router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { registerForPush } from '@/lib/notifications'

export default function MainLayout() {
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

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="messages/index" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="students/index" />
      <Tabs.Screen name="more" />
      <Tabs.Screen name="updates"           options={{ href: null }} />
      <Tabs.Screen name="messages/[id]"     options={{ href: null }} />
      <Tabs.Screen name="students/[id]"     options={{ href: null }} />
      <Tabs.Screen name="notifications"     options={{ href: null }} />
      <Tabs.Screen name="update-compose"    options={{ href: null }} />
      <Tabs.Screen name="appointments"      options={{ href: null }} />
      <Tabs.Screen name="documents"         options={{ href: null }} />
      <Tabs.Screen name="settings"          options={{ href: null }} />
      <Tabs.Screen name="payments"          options={{ href: null }} />
      <Tabs.Screen name="university-offers" options={{ href: null }} />
      <Tabs.Screen name="resources"         options={{ href: null }} />
    </Tabs>
  )
}
