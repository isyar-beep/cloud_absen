import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import api from './api';

// ============================================================
// Push notification.
//
// PENTING: `expo-notifications` sengaja TIDAK di-import di puncak berkas.
//
// Sejak SDK 53, kemampuan push jarak jauh dicabut dari Expo Go, dan paket
// itu memasang peringatannya sendiri saat modulnya dimuat -- bukan saat
// fungsinya dipanggil. Selama import-nya ada di puncak, peringatan itu
// muncul sebagai kotak merah "Console Error" begitu aplikasi dibuka,
// sebelum satu baris pun kode kita berjalan. Menambahkan pemeriksaan di
// dalam fungsi tidak menolong: peringatannya sudah terlanjur keluar.
//
// Karena itu modulnya dimuat lewat require() di dalam fungsi, setelah
// dipastikan kita TIDAK sedang berjalan di Expo Go. Di APK hasil build,
// jalurnya sama seperti biasa dan push tetap berfungsi penuh.
// ============================================================

function diExpoGo() {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

// Notifikasi tetap tampil (banner + suara) walau app sedang dibuka.
//
// shouldShowBanner & shouldShowList menggantikan shouldShowAlert yang
// sudah usang sejak expo-notifications 0.29 -- keduanya wajib diisi,
// karena sekarang banner (muncul sekilas di atas) dan daftar notifikasi
// dikendalikan terpisah.
function pasangPenangan(Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Minta izin notifikasi, ambil Expo push token, lalu simpan ke backend.
// Dipanggil sekali setelah login berhasil. Gagal diam-diam (mis. di emulator
// tanpa Google Play Services) supaya tidak mengganggu alur login utama.
export async function registerForPushNotifications() {
  try {
    if (diExpoGo()) {
      console.log('Berjalan di Expo Go — push notification dilewati. Aktif di APK hasil build.');
      return;
    }
    if (!Device.isDevice) {
      console.log('Push notification butuh perangkat fisik, dilewati di emulator/simulator.');
      return;
    }

    // eslint-disable-next-line global-require
    const Notifications = require('expo-notifications');
    pasangPenangan(Notifications);

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

// Dipanggil saat logout supaya user yang sudah keluar tidak lagi menerima
// notifikasi. Tidak menyentuh expo-notifications sama sekali -- hanya
// mengosongkan token di server, jadi aman dipanggil di Expo Go.
export async function unregisterPushToken() {
  try {
    await api.put('/auth/push-token', { push_token: null });
  } catch (err) {
    console.log('Gagal menghapus push token:', err.message);
  }
}
