import { View, ActivityIndicator } from 'react-native'
import { C } from '@/constants/colors'

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' }}>
      <ActivityIndicator size="large" color={C.blue} />
    </View>
  )
}
