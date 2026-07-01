import { ReactNode, useEffect, useRef } from 'react'
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native'

// Animation primitives built on core Animated (reanimated is not installed).
// FadeInUp: entrance fade + rise, stagger lists with delay={i * 60}.
// ScalePress: tactile press-down scale for cards and buttons.

export function FadeInUp({
  children, delay = 0, distance = 14, duration = 420, style, onLayout,
}: {
  children: ReactNode
  delay?: number
  distance?: number
  duration?: number
  style?: StyleProp<ViewStyle>
  onLayout?: () => void
}) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration, delay, useNativeDriver: true }).start()
  }, [])
  return (
    <Animated.View
      onLayout={onLayout}
      style={[style, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  )
}

export function ScalePress({
  children, onPress, onLongPress, disabled, style, containerStyle, scaleTo = 0.97,
}: {
  children: ReactNode
  onPress?: () => void
  onLongPress?: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  /** Layout props (flex, width, margins) must live on the Pressable itself. */
  containerStyle?: StyleProp<ViewStyle>
  scaleTo?: number
}) {
  const scale = useRef(new Animated.Value(1)).current
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, tension: 300, friction: 18, useNativeDriver: true }).start()
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      style={containerStyle}
    >
      <Animated.View style={[{ flexGrow: 1 }, style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  )
}
