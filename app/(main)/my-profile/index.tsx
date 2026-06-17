import { useState } from 'react'
import {
  View, TouchableOpacity, Text, StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'
import OverviewTab from './overview'
import JourneyTab from './journey'
import InterviewsTab from './interviews'
import AIInsightsTab from './ai-insights'
import TabBar from './tab-bar'

type Tab = 'overview' | 'journey' | 'interviews' | 'insights'

export default function MyProfileScreen() {
  const C      = useColors()
  const s      = mkS(C)
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [tab,  setTab] = useState<Tab>('overview')

  return (
    <View style={s.bg}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Profile</Text>
        <View style={{ width: 40 }} />
      </View>
      <TabBar tab={tab} onTabChange={setTab} />
      {tab === 'overview' && <OverviewTab />}
      {tab === 'journey' && <JourneyTab />}
      {tab === 'interviews' && <InterviewsTab />}
      {tab === 'insights' && <AIInsightsTab />}
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:             { flex: 1, backgroundColor: C.bg },
  header:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.slate100 },
  backBtn:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.navy },
})
