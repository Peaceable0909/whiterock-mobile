import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

type Tab = 'overview' | 'journey' | 'interviews' | 'insights'

interface TabBarProps {
  tab: Tab
  onTabChange: (tab: Tab) => void
}

export default function TabBar({ tab, onTabChange }: TabBarProps) {
  const C = useColors()
  const s = mkS(C)

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview',   label: 'Overview',   icon: 'person-outline'     },
    { key: 'journey',    label: 'Journey',    icon: 'map-outline'        },
    { key: 'interviews', label: 'Interviews', icon: 'mic-outline'        },
    { key: 'insights',   label: 'Insights',   icon: 'bulb-outline'       },
  ]

  return (
    <View style={s.tabBar}>
        {tabs.map(t => {
          const active = tab === t.key
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, active && s.tabBtnActive]}
              onPress={() => onTabChange(t.key)}
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
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  tabBar:         { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  tabBtn:         { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  tabBtnActive:   { borderBottomWidth: 3, borderBottomColor: C.blue },
  tabLabel:       { fontSize: 11, fontWeight: '600', color: C.slate400 },
  tabLabelActive: { color: C.navy, fontWeight: '700' },
  tabUnderline:   { position: 'absolute', bottom: 0, width: '100%', height: 3, backgroundColor: C.blue },
})
