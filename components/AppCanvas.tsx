import { Image, StyleSheet, View } from 'react-native'
import { useTheme } from '@/lib/theme'

// One canvas behind the entire app (the WhatsApp model): a base colour from
// the theme or the chosen wallpaper colour, the brand doodle at low opacity,
// and — when the user picked a custom photo — that photo with blur + scrim.
// Every screen renders on a transparent background, so headers, lists, chat
// and the tab bar all share this single continuous surface.
//
// assets/doodle.webp is the education doodle: faint outlines baked onto a
// cream base, so the contrast is already whisper-quiet. Over a light canvas
// it blends at moderate opacity to read as natural texture; over dark
// canvases it is dropped to a faint wash so it never lifts the black.

const doodleAsset = require('../assets/doodle.webp')

const isLightHex = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return ((0.299 * ((n >> 16) & 255)) + (0.587 * ((n >> 8) & 255)) + (0.114 * (n & 255))) / 255 > 0.6
}

export function AppCanvas() {
  const { C, resolvedWallpaper, wallpaperBrightness, doodle } = useTheme()

  const baseColor = resolvedWallpaper && 'color' in resolvedWallpaper ? resolvedWallpaper.color : C.bg
  const photo     = resolvedWallpaper && 'uri' in resolvedWallpaper ? resolvedWallpaper.uri : null
  const doodleOpacity = isLightHex(baseColor) ? 0.45 : 0.06

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: baseColor }]} />
      {doodle && !photo && (
        <Image
          source={doodleAsset}
          style={[StyleSheet.absoluteFill, { width: undefined, height: undefined, opacity: doodleOpacity }]}
          resizeMode="cover"
        />
      )}
      {photo && (
        <>
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: Math.max(0.16, 1 - wallpaperBrightness) }]} />
        </>
      )}
    </View>
  )
}
