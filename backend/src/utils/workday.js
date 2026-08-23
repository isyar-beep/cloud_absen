// ============================================================
// Hari kerja: Senin-Jumat, di luar hari libur terdaftar.
//
// Dipakai untuk menolak absen di hari yang memang kantor tutup. Tanpa ini,
// pegawai bisa absen di hari Minggu dan tercatat "hadir" -- ikut menaikkan
// attendance rate padahal bukan hari kerja, sementara penanda alpha justru
// melewati akhir pekan. Dua sisi yang tidak konsisten.
//
// Yang diperiksa selalu TANGGAL SHIFT, bukan tanggal kalender saat tombol
// ditekan. Shift malam yang mulai Jumat 22:00 dan selesai Sabtu 06:00 tetap
// dianggap shift hari Jumat, jadi absen pulangnya Sabtu pagi tidak ditolak.
// ============================================================

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// "2026-08-23" -> Date lokal. Sengaja tidak lewat new Date(teks) karena
// bentuk itu dibaca sebagai UTC dan bisa bergeser satu hari.
function tanggalLokal(tanggal) {
  const [y, b, t] = String(tanggal).split('-').map(Number);
  return new Date(y, b - 1, t);
}

function akhirPekan(tanggal) {
  const hari = tanggalLokal(tanggal).getDay();
  return hari === 0 || hari === 6;
}

// Periksa satu tanggal. Mengembalikan { kerja, alasan, nama_hari, libur }.
async function cekHariKerja(query, tanggal) {
  const namaHari = NAMA_HARI[tanggalLokal(tanggal).getDay()];

  if (akhirPekan(tanggal)) {
    return {
      kerja: false,
      nama_hari: namaHari,
      libur: null,
      alasan: `${namaHari} bukan hari kerja, absen ditutup.`,
    };
  }

  const hasil = await query(
    `SELECT name FROM holidays WHERE date = $1::date`,
    [tanggal]
  );
  if (hasil.rows.length > 0) {
    const nama = hasil.rows[0].name;
    return {
      kerja: false,
      nama_hari: namaHari,
      libur: nama,
      alasan: `Hari libur (${nama}), absen ditutup.`,
    };
  }

  return { kerja: true, nama_hari: namaHari, libur: null, alasan: null };
}

module.exports = { cekHariKerja, akhirPekan, NAMA_HARI };
