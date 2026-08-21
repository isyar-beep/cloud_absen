import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from './api';

// Notifikasi tetap tampil (banner + suara) walau app sedang dibuka
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
