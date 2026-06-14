import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { C } from '@/constants/colors'

interface Props {
  title: string
  onBack?: () => void
  right?: React.ReactNode
  noBorder?: boolean
}

export function AppHeader({ title, onBack, right, noBorder }: Props) {
  const { top } = useSafeAreaInsets()
  const router  = useRouter()

  const handleBack = onBack ?? (() => router.back())

  return (
    <View style={[s.header, { paddingTop: top + 10 }, noBorder && { borderBottomWidth: 0 }]}>
      {onBack !== null && (
        <TouchableOpacity onPress={handleBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
      )}
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      <View style={s.right}>{right}</View>
    </View>
  )
}

const s = StyleSheet.create({
  header:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.slate100, gap: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:   { flex: 1, fontSize: 17, fontWeight: '800', color: C.navy },
  right:   { flexShrink: 0, minWidth: 36, alignItems: 'flex-end' },
})
