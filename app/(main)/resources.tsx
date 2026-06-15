import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

export default function ResourcesScreen() {
  const C = useColors()
  const s = mkS(C)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={[s.bg, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.title}>Resources & Guides</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.center}>
        <View style={[s.iconBox, { backgroundColor: '#FEF9C3' }]}>
          <Ionicons name="library-outline" size={38} color="#D97706" />
        </View>
        <Text style={s.heading}>Coming Soon</Text>
        <Text style={s.body}>
          Access UK visa checklists, document templates, university guides, and study materials to support every step of your application journey.
        </Text>
      </View>
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:      { flex: 1, backgroundColor: C.bg },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  back:    { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 17, fontWeight: '800', color: C.navy },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconBox: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  heading: { fontSize: 22, fontWeight: '800', color: C.navy, marginBottom: 10 },
  body:    { fontSize: 14, color: C.slate400, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
})
