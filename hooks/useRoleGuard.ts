import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'

export function useRoleGuard(allowedRoles: string[]) {
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/(auth)/login'); return }
      supabase.from('users').select('role').eq('id', user.id).single()
        .then(({ data }) => {
          const r = data?.role ?? 'student'
          setRole(r)
          if (!allowedRoles.includes(r)) router.replace('/(main)/home')
        })
    })
  }, [])

  return role
}
