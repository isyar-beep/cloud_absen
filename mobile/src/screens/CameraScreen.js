import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWarna } from '../theme';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import api from '../services/api';
import { pesanGalat } from '../services/galat';

const JUDUL = { 'check-in': 'Absen Masuk', 'check-out': 'Absen Pulang' };

// "5,10612S 119,52484E" -- format yang sama dengan cap yang ditanam server
// di src/utils/capFoto.js, supaya yang dilihat pegawai di layar persis
// sama dengan yang nanti muncul di fotonya.
function formatKoordinat(lat, lon) {
  if (lat == null || lon == null) return null;
  const sisi = (nilai, positif, negatif) =>
    `${Math.abs(nilai).toFixed(5).replace('.', ',')}${nilai < 0 ? negatif : positif}`;
  return `${sisi(lat, 'N', 'S')} ${sisi(lon, 'E', 'W')}`;
}

export default function CameraScreen({ route, navigation }) {
  const { mode } = route.params; // 'check-in' | 'check-out'
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lokasi, setLokasi] = useState(null);
  const [lokasiStatus, setLokasiStatus] = useState('mencari'); // mencari | ada | gagal
  const w = useWarna();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => buatGaya(w), [w]);

  // Lokasi diminta sejak layar dibuka, bukan saat tombol kirim ditekan.
  // GPS bisa perlu beberapa detik untuk mengunci; menunggunya di detik
  // terakhir membuat tombol "Kirim Absensi" terasa menggantung.
  const ambilLokasi = useCallback(async () => {
    setLokasiStatus('mencari');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLokasiStatus('gagal');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLokasi({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setLokasiStatus('ada');
    } catch (err) {
      setLokasiStatus('gagal');
    }
  }, []);

  useEffect(() => {
    ambilLokasi();
  }, [ambilLokasi]);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.tengah]}>
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
      const formData = new FormData();
      formData.append('photo', {
        uri: photo,
        name: 'attendance.jpg',
        type: 'image/jpeg',
      });
      if (lokasi) {
        // FormData React Native mengharuskan nilai string, bukan number
        formData.append('latitude', String(lokasi.latitude));
        formData.append('longitude', String(lokasi.longitude));
      }

      const endpoint = mode === 'check-in' ? '/attendance/check-in' : '/attendance/check-out';
      const res = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Berhasil', res.data.message, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Gagal', pesanGalat(err, 'Terjadi kesalahan saat mengirim absensi.'));
    } finally {
      setLoading(false);
    }
  }

  const koordinat = lokasi ? formatKoordinat(lokasi.latitude, lokasi.longitude) : null;

  // Keterangan lokasi. Absen tetap boleh dikirim tanpa GPS -- koordinat
  // hanya keterangan, bukan syarat, dan tidak ada pembatasan area.
  const lokasiTeks = {
    mencari: 'Mencari lokasi...',
    ada: koordinat,
    gagal: 'Lokasi tidak tersedia — absen tetap bisa dikirim',
  }[lokasiStatus];

  const lokasiWarna = { mencari: '#fbbf24', ada: '#22c55e', gagal: '#f87171' }[lokasiStatus];

  // Dipanggil sebagai fungsi biasa, bukan <Komponen />: komponen yang
  // dideklarasikan di dalam render akan dianggap tipe baru tiap kali
  // render dan dipasang ulang dari nol.
  const barisLokasi = () => (
    <View style={styles.lokasiRow}>
      <View style={[styles.titik, { backgroundColor: lokasiWarna }]} />
      <Text style={styles.lokasiTeks} numberOfLines={1}>{lokasiTeks}</Text>
      {lokasiStatus === 'gagal' ? (
        <TouchableOpacity onPress={ambilLokasi} hitSlop={8}>
          <Text style={styles.ulangi}>Coba lagi</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (photo) {
    return (
      <View style={styles.container}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.topBarText}>{JUDUL[mode] || 'Absensi'}</Text>
        </View>
        <Image source={{ uri: photo }} style={styles.preview} />
        <View style={styles.panelBawah}>
          {barisLokasi()}
          <Text style={styles.keterangan}>
            Koordinat dan jam akan ditanam otomatis di pojok kanan bawah foto.
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setPhoto(null)}>
              <Text style={styles.secondaryButtonText}>Ambil Ulang</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonMati]}
              onPress={submitAttendance}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Mengirim...' : 'Kirim Absensi'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="front" ref={cameraRef} />
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.topBarTombol}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.topBarKembali}>Batal</Text>
        </TouchableOpacity>
        <Text style={styles.topBarText}>{JUDUL[mode] || 'Absensi'}</Text>
        <View style={styles.topBarSpacer} />
      </View>
      <View style={styles.lokasiMengambang}>
        {barisLokasi()}
      </View>
      <TouchableOpacity style={styles.captureButton} onPress={takePhoto} />
    </View>
  );
}

const buatGaya = (w) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  tengah: { justifyContent: 'center' },
  camera: { flex: 1 },
  preview: { flex: 1 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  topBarText: { color: w.teksDiWarna, fontSize: 15, fontWeight: '700' },
  topBarKembali: { color: w.teksDiWarna, fontSize: 13, fontWeight: '600' },
  // Tinggi ketuk minimal supaya "Batal" bisa ditekan dengan ibu jari,
  // bukan hanya dengan ujung kuku.
  topBarTombol: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  topBarSpacer: { width: 56 },

  lokasiMengambang: {
    position: 'absolute', bottom: 120, left: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  lokasiRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titik: { width: 7, height: 7, borderRadius: 4 },
  lokasiTeks: { color: w.teksDiWarna, fontSize: 12, flexShrink: 1, fontWeight: '500' },
  ulangi: { color: w.utama, fontSize: 12, fontWeight: '600' },

  captureButton: {
    position: 'absolute', bottom: 44, alignSelf: 'center',
    width: 70, height: 70, borderRadius: 35, backgroundColor: w.permukaan,
    borderWidth: 4, borderColor: w.garisTebal,
  },

  panelBawah: { backgroundColor: w.permukaan, padding: 16, gap: 10 },
  keterangan: { fontSize: 11, color: w.teksRedup },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 2 },
  button: {
    flex: 1, backgroundColor: w.utama, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  buttonMati: { opacity: 0.5 },
  secondaryButton: {
    flex: 1, backgroundColor: w.permukaan2, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  buttonText: { color: w.teksDiWarna, fontWeight: '600', fontSize: 14 },
  secondaryButtonText: { color: w.teksBadan, fontWeight: '600', fontSize: 14 },
  permissionText: { color: w.teksDiWarna, textAlign: 'center', margin: 24, fontSize: 14 },
});
