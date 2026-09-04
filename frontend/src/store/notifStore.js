import { create } from 'zustand';
import api from '../api/axios';

// ============================================================
// Jumlah pemberitahuan yang belum dibaca.
//
// Disimpan di satu tempat, bukan dihitung sendiri-sendiri oleh menu dan
// halaman Pemberitahuan. Keduanya menampilkan angka yang sama, dan angka
// yang sama dari dua sumber pasti berselisih cepat atau lambat: menandai
// satu pemberitahuan sudah dibaca di halaman harus SEKETIKA menurunkan
// angka di menu, bukan menunggu penyegaran berkala berikutnya.
//
// Disegarkan berkala, bukan lewat sambungan langsung. Pemberitahuan di
// sini tidak menuntut ketepatan detik, sementara WebSocket menambah satu
// bagian lagi yang harus dijaga hidup di VPS.
// ============================================================

export const SELANG_SEGARKAN = 60000;

export const useNotifStore = create((set, get) => ({
  belum: 0,

  // Dipanggil menu tiap satu menit, dan oleh halaman Pemberitahuan setiap
  // kali daftarnya dimuat ulang.
  segarkan: async () => {
    try {
      const res = await api.get('/notifications/saya', { params: { limit: 1 } });
      set({ belum: res.data.belum_dibaca });
    } catch {
      // Sengaja diam. Angka di menu bukan isi utama halaman; pesan galat
      // untuk sesuatu yang tidak diminta pemakainya hanya mengganggu, dan
      // penyegaran berikutnya akan memperbaikinya sendiri.
    }
  },

  // Dipakai setelah penandaan di layar, supaya angkanya turun seketika
  // tanpa menunggu jawaban server. Kalau permintaannya ternyata gagal,
  // penyegaran berikutnya mengembalikan angka yang benar.
  setel: (n) => set({ belum: Math.max(0, n) }),
  kurangi: (n = 1) => set({ belum: Math.max(0, get().belum - n) }),
}));
