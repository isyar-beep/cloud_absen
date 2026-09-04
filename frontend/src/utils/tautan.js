// ============================================================
// Penyaring tujuan pindah halaman.
//
// Pemberitahuan menyimpan alamat tujuannya sebagai teks di basis data,
// lalu layar memanggil navigate() dengan teks itu. Selama teksnya ditulis
// backend kita sendiri, isinya aman. Tapi bentuk "teks dari luar masuk ke
// navigate()" ITU SENDIRI yang berbahaya, dan justru bentuk itulah yang
// disebut peringatan keamanan react-router GHSA-wrjc-x8rr-h8h6: alamat
// yang diawali garis miring terbalik bisa lolos dibaca sebagai alamat
// situs LAIN, sehingga pemakainya terlempar keluar aplikasi.
//
// Menaikkan versi react-router menutup celah hari ini. Penyaring ini
// menutup seluruh kelasnya: sekali pun nanti ada yang membiarkan isi
// `tautan` dipengaruhi masukan pemakai, atau pustakanya kembali bercelah,
// tujuan di luar aplikasi tetap tidak akan pernah dijalankan.
//
// Diizinkan HANYA alamat dalam aplikasi: satu garis miring, lalu huruf,
// angka, dan tanda baca yang dipakai rute kita. Yang lain ditolak --
// termasuk "//situs-lain.com", "/\situs-lain.com", "https://...", dan
// "javascript:...".
// ============================================================

const POLA_AMAN = /^\/[A-Za-z0-9\-._~/]*(\?[A-Za-z0-9\-._~=&%]*)?$/;

export function tautanAman(nilai) {
  if (typeof nilai !== 'string' || nilai === '') return null;
  // "//" dan "/\" adalah alamat berprotokol-relatif: keduanya menunjuk
  // situs lain walau diawali garis miring seperti alamat dalam aplikasi.
  if (nilai.startsWith('//') || nilai.startsWith('/\\')) return null;
  if (!POLA_AMAN.test(nilai)) return null;
  return nilai;
}
