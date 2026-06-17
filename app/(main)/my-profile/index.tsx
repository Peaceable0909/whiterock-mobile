import { useState } from 'react'
import {
  View, StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
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
  const router = useRouter()
  const [tab,  setTab] = useState<Tab>('overview')

  return (
    <View style={s.bg}>
      <TabBar tab={tab} onTabChange={setTab} />
      {tab === 'overview' && <OverviewTab />}
      {tab === 'journey' && <JourneyTab />}
      {tab === 'interviews' && <InterviewsTab />}
      {tab === 'insights' && <AIInsightsTab />}
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: C.bg },
})
