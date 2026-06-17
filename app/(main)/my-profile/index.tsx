import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

type Tab = 'overview' | 'journey' | 'interviews' | 'insights'

export default function MyProfileScreen() {
  const C      = useColors()
  const s      = mkS(C)
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [tab,  setTab] = useState<Tab>('overview')

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview',   label: 'Overview',   icon: 'person-outline'     },
    { key: 'journey',    label: 'Journey',    icon: 'map-outline'        },
    { key: 'interviews', label: 'Interviews', icon: 'mic-outline'        },
    { key: 'insights',   label: 'Insights',   icon: 'bulb-outline'       },
  ]

  const navTo = (t: Tab) => {
    setTab(t)
    router.push(`/(main)/my-profile/${t}` as any)
  }

  return (
    <View style={s.bg}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab buttons */}
      <View style={s.tabBar}>
        {tabs.map(t => {
          const active = tab === t.key
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, active && s.tabBtnActive]}
              onPress={() => navTo(t.key)}
            >
              <Ionicons
                name={t.icon as any}
                size={18}
                color={active ? C.blue : C.slate400}
              />
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>
                {t.label}
              </Text>
              {active && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:             { flex: 1, backgroundColor: C.bg },
  header:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.navy },
  tabBar:         { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  tabBtn:         { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  tabBtnActive:   { borderBottomWidth: 3, borderBottomColor: C.blue },
  tabLabel:       { fontSize: 11, fontWeight: '600', color: C.slate400 },
  tabLabelActive: { color: C.navy, fontWeight: '700' },
  tabUnderline:   { position: 'absolute', bottom: 0, width: '100%', height: 3, backgroundColor: C.blue },
})
