const { jendelaTanggal } = require('./shiftWindow');

// ============================================================
// Kelengkapan satu catatan absensi.
//
// Ini BUKAN status, dan sengaja tidak disimpan di basis data.
//
// Alasannya dua. Pertama, faktanya sudah sepenuhnya ditentukan oleh data
// yang ada -- jam yang kosong ditambah jendela shift yang sudah tertutup --
// jadi menyimpannya berarti menduplikasi kebenaran yang bisa dihitung, dan
// membuka kemungkinan keduanya berselisih. Kedua, sifatnya sementara:
// catatan yang hari ini belum lengkap bisa selesai besok lewat koreksi
// admin, sementara status di sistem ini adalah fakta yang menetap.
//
// Ada preseden untuk sikap ini: waktu jenis pengajuan dipecah jadi izin,
// sakit, dan cuti (migrasi 008), statusnya sengaja tetap 'izin' untuk
// ketiganya supaya seluruh rumus kehadiran dan laporan tidak perlu
// diaudit ulang.
//
// Kelengkapan TIDAK memengaruhi tingkat kehadiran. Orangnya terbukti
// datang -- ada foto bercap koordinat dan jam. Lupa menekan tombol pulang
// adalah kelalaian administratif, bukan ketidakhadiran.
// ============================================================

// Kolom shift yang perlu ikut di-SELECT oleh kueri riwayat supaya
// kelengkapannya bisa dihitung. Ditulis sekali di sini supaya ketiga
// kueri riwayat tidak berselisih isinya.
const KOLOM_SHIFT_SQL = `s.start_time AS shift_start, s.end_time AS shift_end,
              s.checkout_close_minutes AS shift_checkout_close`;

// Pegawai tanpa shift dikembalikan null supaya jendelaTanggal memakai
// nilai bawaannya, bukan menimpanya dengan null.
function shiftDariBaris(baris) {
  if (!baris.shift_start) return null;
  return {
    start_time: baris.shift_start,
    end_time: baris.shift_end,
    checkout_close_minutes: baris.shift_checkout_close,
  };
}

// 'pulang' | 'masuk' | null
function kekuranganAbsen(baris, sekarang = new Date()) {
  // Izin, sakit, cuti, dan alpha tidak menuntut foto absen apa pun.
  if (baris.status === 'izin' || baris.status === 'alpha') return null;

  const adaMasuk = !!baris.check_in_time;
  const adaPulang = !!baris.check_out_time;

  if (adaMasuk && adaPulang) return null;
  // Tidak ada keduanya: itu urusan penandaan alpha, bukan kelengkapan.
  if (!adaMasuk && !adaPulang) return null;

  // Ada jam pulang tanpa jam masuk -- bisa terjadi lewat koreksi admin.
  // Janggal terlepas dari jam berapa pun, jadi tidak perlu menunggu
  // jendela tertutup.
  if (!adaMasuk) return 'masuk';

  // Sisanya: sudah absen masuk, belum absen pulang. Baru disebut kurang
  // setelah jendela pulang untuk tanggal shift itu benar-benar tertutup --
  // sebelum itu orangnya memang masih bekerja, bukan lupa. Tanpa syarat
  // ini, setiap pegawai yang sedang bekerja akan tampil bertanda sepanjang
  // hari lalu sembuh sendiri sore harinya, dan tanda yang selalu menyala
  // berhenti diperhatikan orang.
  //
  // Shift diambil dari penugasan pegawai SAAT INI, bukan shift yang
  // berlaku pada tanggal itu. Untuk pertanyaan "apakah waktunya sudah
  // lewat" perbedaan itu tidak berpengaruh kecuali pada catatan satu-dua
  // hari terakhir; untuk tanggal yang lebih lama, jendela shift mana pun
  // sudah tertutup.
  return jendelaTanggal(shiftDariBaris(baris), baris.date, sekarang).pulangTutup
    ? 'pulang'
    : null;
}

// Tambahkan `kurang` ke tiap baris, sekaligus buang kolom shift yang cuma
// dipakai untuk menghitungnya -- supaya bentuk balasan API tetap bersih.
function tandaiKelengkapan(rows, sekarang = new Date()) {
  return rows.map((baris) => {
    const { shift_start, shift_end, shift_checkout_close, ...bersih } = baris;
    return { ...bersih, kurang: kekuranganAbsen(baris, sekarang) };
  });
}

module.exports = { KOLOM_SHIFT_SQL, kekuranganAbsen, tandaiKelengkapan };
