import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColors } from '@/lib/theme'
import { ColorPalette } from '@/constants/colors'

type Resource = { title: string; subtitle: string; url: string }
type Section  = { label: string; icon: string; color: string; bg: string; items: Resource[] }

const SECTIONS: Section[] = [
  {
    label: 'Visa & Immigration',
    icon:  'globe-outline',
    color: '#1D4ED8',
    bg:    '#EFF6FF',
    items: [
      { title: 'Apply for a Student Visa',      subtitle: 'Official gov.uk student visa application',         url: 'https://www.gov.uk/student-visa' },
      { title: 'Immigration Health Surcharge',  subtitle: 'Pay IHS before applying for your visa',            url: 'https://www.immigration-health-surcharge.service.gov.uk' },
      { title: 'Check Your Visa Status',        subtitle: 'Track your UK visa application online',            url: 'https://www.gov.uk/view-prove-immigration-status' },
      { title: 'UKCISA — Visa Advice',          subtitle: 'Independent advice for international students',    url: 'https://ukcisa.org.uk/Information--Advice/Visas-and-Immigration/Student-visa' },
    ],
  },
  {
    label: 'Finance & Funding',
    icon:  'cash-outline',
    color: '#059669',
    bg:    '#F0FDF4',
    items: [
      { title: 'Scholarship Search',           subtitle: 'Find scholarships for UK study',                   url: 'https://www.scholarshipportal.com/scholarships/united-kingdom' },
      { title: 'British Council Scholarships', subtitle: 'GREAT and other UK government scholarships',       url: 'https://www.britishcouncil.org/study-work-abroad/scholarships' },
      { title: 'Proof of Funds Guidance',      subtitle: 'What bank statements your visa needs',             url: 'https://www.gov.uk/student-visa/money' },
      { title: 'Cost of Living Calculator',    subtitle: 'Estimate your monthly UK living costs',            url: 'https://www.numbeo.com/cost-of-living/country_result.jsp?country=United+Kingdom' },
    ],
  },
  {
    label: 'Academic & UCAS',
    icon:  'school-outline',
    color: '#7C3AED',
    bg:    '#F5F3FF',
    items: [
      { title: 'UCAS Track',                   subtitle: 'Monitor your university applications',             url: 'https://track.ucas.com' },
      { title: 'UCAS Application Guide',       subtitle: 'How to write your personal statement',             url: 'https://www.ucas.com/apply' },
      { title: 'Unistats — Course Compare',    subtitle: 'Official UK course comparison data',               url: 'https://www.discoveruni.gov.uk' },
      { title: 'UK University Rankings',       subtitle: 'Guardian and Times university rankings',           url: 'https://www.theguardian.com/education/ng-interactive/2023/sep/09/the-guardian-university-guide-2024-the-rankings' },
    ],
  },
  {
    label: 'Housing & Arrival',
    icon:  'home-outline',
    color: '#D97706',
    bg:    '#FEF9C3',
    items: [
      { title: 'Student Accommodation',        subtitle: 'Find university and private housing',              url: 'https://www.studentcrowd.com' },
      { title: 'Rightmove Student Rooms',      subtitle: 'Private student room listings',                   url: 'https://www.rightmove.co.uk/student-accommodation' },
      { title: 'Collecting Your BRP',          subtitle: 'Biometric Residence Permit guidance',              url: 'https://www.gov.uk/biometric-residence-permits' },
      { title: 'UK Bank Accounts',             subtitle: 'Open a student bank account in the UK',            url: 'https://www.moneysavingexpert.com/banking/student-bank-accounts' },
    ],
  },
  {
    label: 'Health & Support',
    icon:  'medkit-outline',
    color: '#EF4444',
    bg:    '#FEF2F2',
    items: [
      { title: 'Register with a GP',           subtitle: 'Find and register with a local NHS doctor',        url: 'https://www.nhs.uk/nhs-services/gps/how-to-register-with-a-gp-surgery' },
      { title: 'NHS for Students',             subtitle: 'Healthcare rights for international students',     url: 'https://ukcisa.org.uk/Information--Advice/Study--Work/Healthcare-in-the-UK' },
      { title: 'UKCISA Helpline',              subtitle: 'Free advice for international students in the UK', url: 'https://ukcisa.org.uk/About-UKCISA/Contact-us' },
      { title: 'Student Minds',                subtitle: 'UK student mental health support',                 url: 'https://www.studentminds.org.uk' },
    ],
  },
]

export default function ResourcesScreen() {
  const C      = useColors()
  const s      = mkS(C)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={[s.bg, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={s.title}>Resources & Guides</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map(section => (
          <View key={section.label}>
            {/* Section header */}
            <View style={s.sectionHead}>
              <View style={[s.sectionIcon, { backgroundColor: section.bg }]}>
                <Ionicons name={section.icon as any} size={16} color={section.color} />
              </View>
              <Text style={[s.sectionLabel, { color: section.color }]}>{section.label}</Text>
            </View>

            {/* Resource cards */}
            <View style={s.card}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.title}
                  style={[s.row, i < section.items.length - 1 && s.border]}
                  onPress={() => WebBrowser.openBrowserAsync(item.url)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>{item.title}</Text>
                    <Text style={s.rowSub}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="open-outline" size={16} color={C.slate400} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const mkS = (C: ColorPalette) => StyleSheet.create({
  bg:          { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.slate100 },
  back:        { width: 40, height: 40, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 17, fontWeight: '800', color: C.navy },

  sectionHead:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionIcon:  { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },

  card:        { backgroundColor: C.white, borderRadius: 20, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 10 },
  border:      { borderBottomWidth: 1, borderColor: C.slate100 },
  rowTitle:    { fontSize: 14, fontWeight: '700', color: C.navy, marginBottom: 2 },
  rowSub:      { fontSize: 12, color: C.slate400, lineHeight: 16 },
})
