import { Modal, View, Image, TouchableOpacity, StyleSheet, StatusBar } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface Props {
  uri: string | null
  onClose: () => void
}

export function ImageModal({ uri, onClose }: Props) {
  if (!uri) return null
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.bg}>
        <StatusBar hidden />
        <Image source={{ uri }} style={s.img} resizeMode="contain" />
        <TouchableOpacity style={s.close} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  bg:    { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  img:   { width: '100%', height: '100%' },
  close: { position: 'absolute', top: 52, right: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
})
