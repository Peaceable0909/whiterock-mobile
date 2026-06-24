import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useColors } from '@/lib/theme'

interface Props {
  title: string
  onBack?: () => void
  right?: React.ReactNode
  noBorder?: boolean
}

export function AppHeader({ title, onBack, right, noBorder }: Props) {
  const insets  = useSafeAreaInsets()
  const router  = useRouter()
  const C       = useColors()

  const handleBack = onBack ?? (() => router.back())
  const topPadding = Platform.OS === 'web' ? 16 : insets.top + 10

  return (
    <View style={[
      s.base,
      { paddingTop: topPadding, backgroundColor: C.white, borderColor: C.slate100 },
      noBorder && { borderBottomWidth: 0 },
    ]}>
      {onBack !== null && (
        <TouchableOpacity onPress={handleBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
      )}
      <Text style={[s.title, { color: C.navy }]} numberOfLines={1}>{title}</Text>
      <View style={s.right}>{right}</View>
    </View>
  )
}

const s = StyleSheet.create({
  base:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, gap: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:   { flex: 1, fontSize: 17, fontWeight: '800' },
  right:   { flexShrink: 0, minWidth: 36, alignItems: 'flex-end' },
})
