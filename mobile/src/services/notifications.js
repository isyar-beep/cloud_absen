import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import api from './api';

// Notifikasi tetap tampil (banner + suara) walau app sedang dibuka.
//
// shouldShowBanner & shouldShowList menggantikan shouldShowAlert yang
// sudah usang sejak expo-notifications 0.29 -- keduanya wajib diisi,
// karena sekarang banner (muncul sekilas di atas) dan daftar notifikasi
// dikendalikan terpisah.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Minta izin notifikasi, ambil Expo push token, lalu simpan ke backend.
// Dipanggil sekali setelah login berhasil. Gagal diam-diam (mis. di emulator
// tanpa Google Play Services) supaya tidak mengganggu alur login utama.
export async function registerForPushNotifications() {
  try {
    if (!Device.isDevice) {
      console.log('Push notification butuh perangkat fisik, dilewati di emulator/simulator.');
      return;
    }

    // Expo Go tidak lagi bisa menerima push sejak SDK 53 -- modul nativenya
    // dicabut dari aplikasi itu. Tanpa pemeriksaan ini, tiap kali aplikasi
    // dibuka lewat Expo Go muncul dua kotak merah "ERROR" di layar yang
    // terlihat seperti aplikasinya rusak, padahal hanya fitur yang memang
    // tidak tersedia di sana. Di APK hasil build, push tetap berjalan.
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      console.log('Berjalan di Expo Go -- push notification dilewati. Aktif di APK hasil build.');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Izin notifikasi ditolak pengguna.');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    // projectId dibutuhkan Expo untuk menerbitkan push token -- diisi otomatis
    // setelah `eas init` dijalankan sekali (lihat README bagian Push Notification)
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.log('EAS projectId belum diatur -- jalankan `eas init` supaya push notification aktif.');
      return;
    }

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

    await api.put('/auth/push-token', { push_token: expoPushToken });
  } catch (err) {
    console.log('Gagal mendaftarkan push token:', err.message);
  }
}

// Dipanggil saat logout supaya user yang sudah keluar tidak lagi menerima notifikasi.
export async function unregisterPushToken() {
  try {
    await api.put('/auth/push-token', { push_token: null });
  } catch (err) {
    console.log('Gagal menghapus push token:', err.message);
  }
}
