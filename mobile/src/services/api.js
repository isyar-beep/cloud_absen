import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// ============================================================
// Alamat backend.
//
// Dulu dipaku "http://localhost:5000/api", dan itu keliru begitu
// aplikasinya dijalankan di HP sungguhan: bagi HP, "localhost" berarti
// HP ITU SENDIRI, bukan komputer tempat backend berjalan. Permintaannya
// tidak pernah berangkat ke mana-mana, dan layar hanya menampilkan
// "Terjadi kesalahan" tanpa petunjuk apa pun.
//
// Sekarang alamatnya ditemukan sendiri saat pengembangan. Expo tahu
// alamat IP komputer yang sedang menyajikan kode -- itu alamat yang
// sama yang tertulis di QR code -- jadi tinggal dipinjam, lalu portnya
// ditukar ke port backend. Tidak ada yang perlu diedit saat berpindah
// komputer atau berpindah jaringan WiFi.
//
// Untuk APK yang dibagikan, alamatnya diambil dari EXPO_PUBLIC_API_URL
// yang ditanam saat build. Nilai itu WAJIB diisi sebelum membangun APK
// produksi; tanpa itu aplikasi akan menunjuk komputer pengembang yang
// tidak bisa dijangkau dari luar.
// ============================================================

const PORT_BACKEND = 5000;

function alamatPengembangan() {
  // Contoh isinya: "192.168.1.5:8081" -- IP komputer plus port Metro.
  const host = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (!host) return null;
  const ip = String(host).split(':')[0];
  if (!ip || ip === 'localhost' || ip === '127.0.0.1') return null;
  return `http://${ip}:${PORT_BACKEND}/api`;
}

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL
  || alamatPengembangan()
  || `http://localhost:${PORT_BACKEND}/api`;

const api = axios.create({
  baseURL: API_URL,
  // Tanpa batas waktu, permintaan ke alamat yang tidak ada menggantung
  // lama sekali sebelum menyerah -- pemakainya menekan tombol lalu
  // menatap layar diam tanpa tahu apakah sedang berjalan atau macet.
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
