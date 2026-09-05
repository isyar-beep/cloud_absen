// ============================================================
// Penanda dan nama perangkat, versi peramban.
//
// Kembaran mobile/src/services/perangkat.js. Dipakai server untuk
// mengenali "akun ini sudah pernah dipakai dari sini", lalu memberi tahu
// pemiliknya saat muncul yang baru.
//
// Penandanya lebih lemah daripada di aplikasi HP: ia hilang begitu
// riwayat peramban dibersihkan, dan jendela penyamaran selalu tampak
// sebagai perangkat baru. Itu diterima apa adanya -- cara gagalnya aman,
// yaitu satu peringatan tambahan, bukan orang yang gagal masuk.
// ============================================================

const KUNCI = 'sidik_perangkat';

export function sidikPerangkat() {
  try {
    const tersimpan = localStorage.getItem(KUNCI);
    if (tersimpan) return tersimpan;

    const baru = (crypto.randomUUID && crypto.randomUUID())
      || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(KUNCI, baru);
    return baru;
  } catch {
    // Penyimpanan diblokir peramban. Mengembalikan null lebih baik
    // daripada penanda acak yang berganti tiap kali -- yang justru
    // membuat setiap login terbaca sebagai perangkat baru dan membanjiri
    // pemiliknya dengan peringatan palsu.
    return null;
  }
}

// Kalimat siap baca, bukan User-Agent mentah: "Chrome di Windows".
//
// Peramban tidak memberi tahu merek laptopnya, jadi ini yang paling
// dekat. Disusun di sini, bukan di server, karena User-Agent mentah tidak
// layak ditampilkan ke pegawai dan menguraikannya di server berarti satu
// lagi daftar yang harus dirawat mengikuti versi peramban baru.
export function namaPerangkat() {
  const ua = navigator.userAgent || '';

  const peramban =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    // Safari harus diperiksa terakhir: Chrome dan Edge ikut menyebut
    // "Safari" di User-Agent-nya masing-masing.
    : /Safari\//.test(ua) ? 'Safari'
    : 'Peramban';

  const sistem =
    /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'Mac'
    : /Linux/.test(ua) ? 'Linux'
    : null;

  return sistem ? `${peramban} di ${sistem}` : peramban;
}
