import { useEffect, useRef } from 'react'
import { Animated, View, Text, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/lib/theme'

export function Skeleton({
  width, height, radius = 8, style,
}: {
  width?: number | `${number}%`
  height: number
  radius?: number
  style?: ViewStyle
}) {
  const C = useColors()
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [])

  return (
    <Animated.View
      style={[{ width: width ?? '100%', height, borderRadius: radius, backgroundColor: C.slate200, opacity }, style]}
    />
  )
}

export function SkeletonCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const C = useColors()
  return (
    <View style={[{
      backgroundColor: C.white, borderRadius: 20, padding: 16,
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    }, style]}>
      {children}
    </View>
  )
}

export function EmptyState({
  icon, title, subtitle,
}: {
  icon: string
  title: string
  subtitle?: string
}) {
  const C = useColors()
  return (
    <View style={{ alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 12 }}>
      <View style={{
        width: 64, height: 64, borderRadius: 20,
        backgroundColor: '#EFF6FF',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 4,
        shadowColor: C.blue, shadowOpacity: 0.1, shadowRadius: 12, elevation: 2,
      }}>
        <Ionicons name={icon as any} size={30} color={C.blue} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '800', color: C.navy, textAlign: 'center' }}>{title}</Text>
      {subtitle ? (
        <Text style={{ fontSize: 13, color: C.slate500, textAlign: 'center', lineHeight: 20 }}>{subtitle}</Text>
      ) : null}
    </View>
  )
}
