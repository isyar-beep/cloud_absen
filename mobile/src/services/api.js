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

// ============================================================
// Sesi yang ditolak server.
//
// Sebelumnya tidak ada penanganan apa pun di sini, dan akibatnya baru
// terasa berat setelah sesi bisa diputus dari jauh -- sandi diganti,
// perangkat lain dikeluarkan, atau ada login baru di perangkat lain.
// Yang terjadi pada HP: token di penyimpanan tetap ada, aplikasi tetap
// mengira dirinya login, dan setiap layar gagal memuat satu per satu.
// Pegawai melihat aplikasi yang rusak tanpa sebab, dan tidak terpikir
// bahwa yang perlu dilakukan hanyalah login kembali.
//
// Sekarang tokennya dibuang, alasannya dibawa ke layar login, dan
// orangnya dipulangkan ke sana.
// ============================================================
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // 401 dari login itu sendiri berarti email atau sandinya salah --
    // bukan sesi yang berakhir. Layar login yang menampilkan pesannya;
    // memulangkan orang ke layar yang sedang ia buka hanya akan
    // menghapus isian yang baru saja diketiknya.
    const dariLogin = String(error.config?.url || '').includes('/auth/login');

    if (error.response?.status === 401 && !dariLogin) {
      // Dimuat di sini, bukan di puncak berkas: keduanya berujung memuat
      // api.js kembali, dan lingkaran impor pada Metro tidak berhenti
      // dengan galat yang jelas -- yang muncul cuma modul kosong saat
      // dipakai.
      const { useAuthStore } = require('../store/authStore');
      const { pulangKeLogin } = require('./navigasi');

      const sudahKeluar = useAuthStore.getState().token === null;
      if (!sudahKeluar) {
        await useAuthStore.getState().logoutKarena(error.response.data?.message || '');
        pulangKeLogin();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
