import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Appearance } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LIGHT, DARK, ColorPalette } from '@/constants/colors'

export type ThemeMode = 'light' | 'dark' | 'system'

type Ctx = { mode: ThemeMode; isDark: boolean; C: ColorPalette; setMode: (m: ThemeMode) => void }

const ThemeCtx = createContext<Ctx>({ mode: 'system', isDark: false, C: LIGHT, setMode: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system')
  const system = Appearance.getColorScheme() === 'dark'
  const isDark  = mode === 'dark' || (mode === 'system' && system)

  useEffect(() => {
    AsyncStorage.getItem('app_theme').then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v)
    })
  }, [])

  const setMode = async (m: ThemeMode) => {
    setModeState(m)
    await AsyncStorage.setItem('app_theme', m)
  }

  return (
    <ThemeCtx.Provider value={{ mode, isDark, C: isDark ? DARK : LIGHT, setMode }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export const useColors = (): ColorPalette => useContext(ThemeCtx).C
export const useTheme  = () => useContext(ThemeCtx)
