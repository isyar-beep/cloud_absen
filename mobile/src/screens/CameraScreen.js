import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import api from '../services/api';

export default function CameraScreen({ route, navigation }) {
  const { mode } = route.params; // 'check-in' | 'check-out'
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Aplikasi memerlukan izin kamera untuk absensi.</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Izinkan Kamera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function takePhoto() {
    if (cameraRef.current) {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setPhoto(result.uri);
    }
  }

  async function submitAttendance() {
    setLoading(true);
    try {
      let coords = {};
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }

      const formData = new FormData();
      formData.append('photo', {
        uri: photo,
        name: 'attendance.jpg',
        type: 'image/jpeg',
      });
      if (coords.latitude) {
        // FormData React Native mengharuskan nilai string, bukan number
        formData.append('latitude', String(coords.latitude));
        formData.append('longitude', String(coords.longitude));
      }

      const endpoint = mode === 'check-in' ? '/attendance/check-in' : '/attendance/check-out';
      const res = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Berhasil', res.data.message, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Gagal', err.response?.data?.message || 'Terjadi kesalahan saat mengirim absensi.');
    } finally {
      setLoading(false);
    }
  }

  if (photo) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: photo }} style={styles.preview} />
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setPhoto(null)}>
            <Text style={styles.secondaryButtonText}>Ambil Ulang</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={submitAttendance} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Mengirim...' : 'Kirim Absensi'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="front" ref={cameraRef} />
      <TouchableOpacity style={styles.captureButton} onPress={takePhoto} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  preview: { flex: 1 },
  captureButton: {
    position: 'absolute', bottom: 32, alignSelf: 'center',
    width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff',
    borderWidth: 4, borderColor: '#d1d5db',
  },
  actionRow: {
    flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#fff',
  },
  button: {
    flex: 1, backgroundColor: '#2563eb', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  secondaryButton: {
    flex: 1, backgroundColor: '#f3f4f6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  secondaryButtonText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  permissionText: { color: '#fff', textAlign: 'center', margin: 24, fontSize: 14 },
});
