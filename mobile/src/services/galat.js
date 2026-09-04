import { API_URL } from './api';

// ============================================================
// Menerjemahkan kegagalan permintaan menjadi kalimat yang menolong.
//
// Sebelumnya semua kegagalan berujung pada satu kalimat: "Terjadi
// kesalahan." Kalimat itu benar tapi tidak berguna -- ia sama saja
// untuk password salah, server mati, dan HP yang lepas dari WiFi,
// padahal tindakan yang harus diambil pemakainya berbeda-beda.
//
// Yang paling mahal justru kasus TIDAK ADA JAWABAN sama sekali:
// permintaannya tidak pernah sampai ke server. Di lapangan itu berarti
// sinyal hilang; saat pengembangan itu berarti alamat servernya salah.
// Keduanya perlu disebut, karena "Terjadi kesalahan" membuat orang
// mencari-cari di tempat yang keliru.
// ============================================================

export function pesanGalat(err, bawaan = 'Terjadi kesalahan.') {
  // Server menjawab dan menjelaskan sendiri -- itu yang paling tepat.
  const dariServer = err?.response?.data?.message;
  if (dariServer) return dariServer;

  if (err?.code === 'ECONNABORTED') {
    return 'Server tidak menjawab tepat waktu. Periksa koneksi Anda, lalu coba lagi.';
  }

  // Tidak ada `response` sama sekali berarti permintaannya tidak pernah
  // sampai: tidak ada sinyal, server mati, atau alamatnya tidak terjangkau.
  if (err?.request && !err?.response) {
    return `Tidak bisa menghubungi server di ${API_URL}.\n\n`
      + 'Pastikan HP dan server berada di jaringan yang sama, dan servernya sedang berjalan.';
  }

  if (err?.response?.status >= 500) {
    return 'Server sedang bermasalah. Coba lagi beberapa saat lagi.';
  }

  return bawaan;
}
