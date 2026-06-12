import { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus, Bell } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { C } from '@/constants/colors'

export default function UpdatesScreen() {
  const router  = useRouter()
  const [updates, setUpdates] = useState<any[]>([])
  const [role, setRole]       = useState('student')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single()
      setRole(dbUser?.role ?? 'student')
      const { data } = await supabase.from('updates').select('*').order('created_at', { ascending: false }).limit(30)
      setUpdates(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const canPost = ['agent','counselor','admin'].includes(role)

  if (loading) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>

  return (
    <View style={s.bg}>
      <FlatList
        data={updates}
        keyExtractor={u => u.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={
          <View style={s.header}>
            <Bell size={20} color={C.blue} />
            <Text style={s.headerTitle}>Agency Updates</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Bell size={40} color={C.slate200} />
            <Text style={s.emptyTitle}>No updates yet</Text>
            <Text style={s.emptySub}>Agency announcements will appear here</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={[s.typeDot, { backgroundColor: item.type === 'alert' ? C.orange500 : C.blue }]} />
              <Text style={s.cardType}>{(item.type ?? 'update').toUpperCase()}</Text>
              <Text style={s.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={s.cardTitle}>{item.title}</Text>
            {item.content && <Text style={s.cardContent} numberOfLines={3}>{item.content}</Text>}
          </View>
        )}
      />
      {canPost && (
        <TouchableOpacity style={s.fab}>
          <Plus size={22} color={C.white} />
        </TouchableOpacity>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  bg:         { flex: 1, backgroundColor: C.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  headerTitle:{ fontSize: 18, fontWeight: '800', color: C.navy },
  card:       { backgroundColor: C.white, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  cardTop:    { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  typeDot:    { width: 8, height: 8, borderRadius: 4 },
  cardType:   { fontSize: 9, fontWeight: '800', color: C.slate400, letterSpacing: 1, flex: 1 },
  cardDate:   { fontSize: 11, color: C.slate400 },
  cardTitle:  { fontSize: 15, fontWeight: '700', color: C.navy, marginBottom: 6 },
  cardContent:{ fontSize: 13, color: C.slate500, lineHeight: 20 },
  empty:      { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.slate500 },
  emptySub:   { fontSize: 13, color: C.slate400 },
  fab:        { position: 'absolute', bottom: 20, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', elevation: 6 },
})
