import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { Appearance } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LIGHT, DARK, ColorPalette } from '@/constants/colors'
import { supabase } from '@/lib/supabase'

export type ThemeMode = 'light' | 'dark' | 'system'

export const WALLPAPER_OPTIONS = [
  { id: '',         name: 'Default',  color: null },
  { id: 'sky',      name: 'Sky',      color: '#DBEAFE' },
  { id: 'mint',     name: 'Mint',     color: '#D1FAE5' },
  { id: 'blush',    name: 'Blush',    color: '#FCE7F3' },
  { id: 'sunset',   name: 'Sunset',   color: '#FEF3C7' },
  { id: 'sand',     name: 'Sand',     color: '#F5EFE6' },
  { id: 'night',    name: 'Night',    color: '#1B2B4A' },
  { id: 'slate',    name: 'Slate',    color: '#E2E8F0' },
  { id: 'lavender', name: 'Lavender', color: '#EDE9FE' },
]

export const WALLPAPER_COLORS: Record<string, string> = Object.fromEntries(
  WALLPAPER_OPTIONS.filter(w => w.id && w.color).map(w => [w.id, w.color!])
)

export type ResolvedWallpaper = { color: string } | { uri: string }

type Ctx = {
  mode: ThemeMode
  isDark: boolean
  C: ColorPalette
  setMode: (m: ThemeMode) => void
  wallpaper: string
  setWallpaper: (w: string) => void
  resolvedWallpaper: ResolvedWallpaper | null
}

const ThemeCtx = createContext<Ctx>({
  mode: 'system', isDark: false, C: LIGHT,
  setMode: () => {}, wallpaper: '', setWallpaper: () => {},
  resolvedWallpaper: null,
})

function resolveWp(wp: string): ResolvedWallpaper | null {
  if (!wp) return null
  if (wp.startsWith('http')) return { uri: wp }
  const color = WALLPAPER_COLORS[wp]
  return color ? { color } : null
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState]           = useState<ThemeMode>('system')
  const [wallpaper, setWallpaperState] = useState('')
  const [systemDark, setSystemDark]    = useState(Appearance.getColorScheme() === 'dark')
  const isDark  = mode === 'dark' || (mode === 'system' && systemDark)

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemDark(colorScheme === 'dark'))
    return () => sub.remove()
  }, [])

  useEffect(() => {
    // Fast path: local cache
    Promise.all([
      AsyncStorage.getItem('app_theme'),
      AsyncStorage.getItem('app_wallpaper'),
    ]).then(([t, w]) => {
      if (t === 'light' || t === 'dark' || t === 'system') setModeState(t)
      if (w !== null) setWallpaperState(w)
    })

    // Sync from Supabase for cross-device persistence
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('users').select('preferences').eq('id', user.id).maybeSingle()
      const p = ((data as any)?.preferences ?? {}) as Record<string, string>
      if (p.mobile_theme && ['light', 'dark', 'system'].includes(p.mobile_theme)) {
        setModeState(p.mobile_theme as ThemeMode)
        AsyncStorage.setItem('app_theme', p.mobile_theme)
      }
      if (p.mobile_wallpaper !== undefined) {
        setWallpaperState(p.mobile_wallpaper)
        AsyncStorage.setItem('app_wallpaper', p.mobile_wallpaper)
      }
    }).catch(() => {})
  }, [])

  const pendingPrefs = useRef<Record<string, string>>({})
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistPrefs = (key: string, val: string) => {
    pendingPrefs.current[key] = val
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(async () => {
      const patch = { ...pendingPrefs.current }
      pendingPrefs.current = {}
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('users').select('preferences').eq('id', user.id).maybeSingle()
        const p = ((data as any)?.preferences ?? {}) as Record<string, string>
        await supabase.from('users').update({ preferences: { ...p, ...patch } }).eq('id', user.id)
      } catch { /* best-effort */ }
    }, 300)
  }

  const setMode = (m: ThemeMode) => {
    setModeState(m)
    AsyncStorage.setItem('app_theme', m)
    persistPrefs('mobile_theme', m)
  }

  const setWallpaper = (w: string) => {
    setWallpaperState(w)
    AsyncStorage.setItem('app_wallpaper', w)
    persistPrefs('mobile_wallpaper', w)
  }

  return (
    <ThemeCtx.Provider value={{
      mode, isDark, C: isDark ? DARK : LIGHT,
      setMode, wallpaper, setWallpaper,
      resolvedWallpaper: resolveWp(wallpaper),
    }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export const useColors = (): ColorPalette => useContext(ThemeCtx).C
export const useTheme  = () => useContext(ThemeCtx)
