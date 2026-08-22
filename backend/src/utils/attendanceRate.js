// ============================================================
// Satu-satunya tempat rumus attendance rate ditulis.
//
// Aturan: izin dan cuti yang sudah disetujui TIDAK menurunkan
// angka kehadiran -- ketidakhadiran yang sah bukan pelanggaran.
// Jadi keduanya dikeluarkan dari perhitungan, bukan dihitung
// sebagai hari tidak masuk.
//
//   rate = (hadir + terlambat) / (hadir + terlambat + alpha)
//
// Dipakai bersama oleh statistik, dashboard, dan laporan supaya
// angkanya tidak mungkin berbeda antar halaman.
// ============================================================

// Status yang dianggap masuk kerja (terlambat tetap masuk kerja)
const STATUS_MASUK = ['hadir', 'terlambat'];

// Status yang ikut jadi penyebut. 'izin' dan 'cuti' sengaja tidak ada di sini.
const STATUS_DIHITUNG = ['hadir', 'terlambat', 'alpha'];

function hitungRate({ hadir = 0, terlambat = 0, alpha = 0 }) {
  const masuk = Number(hadir) + Number(terlambat);
  const hariEfektif = masuk + Number(alpha);
  return hariEfektif > 0 ? ((masuk / hariEfektif) * 100).toFixed(1) : '0.0';
}

module.exports = { hitungRate, STATUS_MASUK, STATUS_DIHITUNG };
