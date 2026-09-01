import { create } from 'zustand';

// try/catch: kalau isi localStorage rusak atau pernah diedit tangan,
// JSON.parse melempar galat saat modul dimuat -- dan seluruh aplikasi
// gagal digambar hanya karena satu nilai yang tidak bisa dibaca.
function bacaUser() {
  try {
    const mentah = localStorage.getItem('user');
    return mentah ? JSON.parse(mentah) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create((set) => ({
  user: bacaUser(),
  token: localStorage.getItem('token') || null,

  login: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));

// ============================================================
// Satu peramban = satu sesi.
//
// localStorage dipakai bersama oleh SELURUH tab pada alamat yang sama, jadi
// masuk sebagai pegawai di tab kedua otomatis menggantikan sesi admin di tab
// pertama. Itu memang cara kerja peramban dan tidak diubah di sini.
//
// Yang diperbaiki: tab lama tetap MENAMPILKAN antarmuka admin padahal
// tokennya sudah berganti milik pegawai. Layarnya berbohong soal siapa yang
// sedang masuk -- menu admin masih terpampang, data admin yang terlanjur
// termuat masih terbaca, sementara setiap tindakan di sana ditolak server.
//
// Peristiwa 'storage' hanya menyala di tab LAIN, bukan di tab yang mengubah
// nilainya -- persis yang dibutuhkan. Begitu sesi berganti, ProtectedRoute
// langsung memindahkan tab lama ke halaman yang sesuai peran barunya.
// ============================================================
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== 'token' && e.key !== 'user') return;
    useAuthStore.setState({
      user: bacaUser(),
      token: localStorage.getItem('token') || null,
    });
  });
}
