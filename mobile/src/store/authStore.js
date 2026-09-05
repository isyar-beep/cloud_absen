import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,

  // Alasan sesi terakhir berakhir, untuk ditampilkan sekali di layar
  // login. Sengaja TIDAK ikut disimpan ke AsyncStorage: pesan ini hanya
  // berlaku untuk kepulangan ke layar login kali ini. Kalau ikut awet,
  // kalimat "akun Anda dipakai di perangkat lain" akan muncul lagi
  // berhari-hari kemudian saat aplikasi dibuka -- dan peringatan yang
  // muncul tanpa sebab justru melatih orang mengabaikannya.
  pesanSesi: '',

  login: async (user, token) => {
    await AsyncStorage.setItem('user', JSON.stringify(user));
    await AsyncStorage.setItem('token', token);
    set({ user, token });
  },

  // Perbarui sebagian data pengguna yang tersimpan, mis. setelah foto
  // profil diganti. Tanpa ini, avatar di dashboard baru ikut berubah
  // setelah pegawai keluar lalu masuk lagi.
  perbaruiUser: async (sebagian) => {
    const sekarang = useAuthStore.getState().user || {};
    const baru = { ...sekarang, ...sebagian };
    await AsyncStorage.setItem('user', JSON.stringify(baru));
    set({ user: baru });
  },

  // Dipakai setelah mengganti sandi atau memutus sesi perangkat lain.
  //
  // Keduanya membuat token lama tidak berlaku lagi -- termasuk yang
  // sedang dipegang HP ini. Tanpa menyimpan token pengganti, pegawai yang
  // baru saja mengamankan akunnya justru terlempar ke layar login, dan di
  // HP layar yang tiba-tiba kembali ke login mudah disalahartikan sebagai
  // kegagalan.
  gantiToken: async (token) => {
    if (!token) return;
    await AsyncStorage.setItem('token', token);
    set({ token });
  },

  restoreSession: async () => {
    const userStr = await AsyncStorage.getItem('user');
    const token = await AsyncStorage.getItem('token');
    if (userStr && token) {
      set({ user: JSON.parse(userStr), token });
      return token;
    }
    return null;
  },

  logout: async () => {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('token');
    set({ user: null, token: null, pesanSesi: '' });
  },

  // Dipakai penyadap 401: sesi diputus server, bukan oleh pemiliknya.
  //
  // Bedanya dengan logout biasa cuma satu, tapi itu yang penting --
  // alasannya dibawa serta. Tanpa alasan, pegawai yang akunnya dipakai
  // orang lain cuma melihat aplikasinya tiba-tiba kembali ke layar login
  // dan mengira aplikasinya rusak.
  logoutKarena: async (pesan) => {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('token');
    set({ user: null, token: null, pesanSesi: pesan || '' });
  },

  // Dipanggil layar login setelah pesannya ditampilkan, supaya tidak
  // muncul dua kali.
  hapusPesanSesi: () => set({ pesanSesi: '' }),
}));
