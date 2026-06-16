import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/lib/theme'

export default function NotFound() {
  const C      = useColors()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace('/(auth)/login')
        return
      }
      const { data: dbUser } = await supabase
        .from('users').select('role').eq('id', data.session.user.id).single()
      const role = dbUser?.role ?? 'student'
      if (role === 'admin') router.replace('/(admin)/dashboard')
      else router.replace('/(main)/home')
    })
  }, [])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator size="large" color={C.blue} />
    </View>
  )
}
