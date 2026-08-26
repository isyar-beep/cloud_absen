// ============================================================
// Hari kerja: ditentukan per SHIFT, di luar hari libur terdaftar.
//
// Dipakai untuk menolak absen di hari yang memang kantor tutup. Tanpa ini,
// pegawai bisa absen di hari yang bukan hari kerjanya dan tercatat "hadir"
// -- ikut menaikkan attendance rate, sementara penanda alpha justru
// melewati hari itu. Dua sisi yang tidak konsisten.
//
// Dulu Sabtu & Minggu tertutup untuk semua orang dan dipaku di berkas ini.
// Akibatnya divisi yang memang bertugas akhir pekan tidak bisa absen sama
// sekali. Sekarang daftar harinya menempel di shift (kolom work_days,
// migration 009); yang belum punya shift memakai Senin-Jumat seperti dulu.
//
// Hari libur tetap berlaku untuk semua shift. Kalau nanti ada divisi yang
// tetap masuk saat libur nasional, itu pengecualian yang perlu dipikirkan
// terpisah -- bukan diam-diam ikut ke sini.
//
// Yang diperiksa selalu TANGGAL SHIFT, bukan tanggal kalender saat tombol
// ditekan. Shift malam yang mulai Jumat 22:00 dan selesai Sabtu 06:00 tetap
// dianggap shift hari Jumat, jadi absen pulangnya Sabtu pagi tidak ditolak.
// ============================================================

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Nomor hari ala JavaScript getDay() dan Postgres EXTRACT(DOW):
// 0=Minggu ... 6=Sabtu. Keduanya sama, jadi tidak ada penerjemahan di tengah.
const HARI_KERJA_DEFAULT = [1, 2, 3, 4, 5];

// "2026-08-23" -> Date lokal. Sengaja tidak lewat new Date(teks) karena
// bentuk itu dibaca sebagai UTC dan bisa bergeser satu hari.
function tanggalLokal(tanggal) {
  const [y, b, t] = String(tanggal).split('-').map(Number);
  return new Date(y, b - 1, t);
}

// Daftar hari kerja sebuah shift, dengan cadangan Senin-Jumat.
// Menerima bentuk apa adanya dari database (array angka atau teks).
function hariKerjaShift(shift) {
  const mentah = shift?.work_days;
  if (!Array.isArray(mentah) || mentah.length === 0) return HARI_KERJA_DEFAULT;
  const bersih = mentah.map(Number).filter((h) => Number.isInteger(h) && h >= 0 && h <= 6);
  return bersih.length > 0 ? bersih : HARI_KERJA_DEFAULT;
}

// Rangkuman hari kerja untuk ditampilkan: "Senin-Jumat", "Sabtu-Minggu".
//
// Diurutkan mulai Senin, bukan mulai Minggu seperti penomoran aslinya.
// Dengan urutan angka mentah, shift piket akhir pekan terbaca "Minggu,
// Sabtu" -- benar secara data, tapi tidak ada orang yang menyebut akhir
// pekan begitu. Mulai dari Senin, keduanya jadi bersebelahan dan tertulis
// "Sabtu-Minggu".
function ringkasHariKerja(shift) {
  const hari = [...new Set(hariKerjaShift(shift))];
  if (hari.length === 7) return 'Setiap hari';

  // Posisi dalam minggu yang dimulai Senin: Senin=0 ... Minggu=6.
  const posisi = (h) => (h + 6) % 7;
  const urut = hari.sort((a, b) => posisi(a) - posisi(b));

  // Deret bersebelahan ditulis sebagai rentang supaya tidak jadi daftar
  // panjang; kebersebelahan dinilai pada posisi, bukan nomor harinya.
  const bagian = [];
  let mulai = urut[0];
  let akhir = urut[0];
  for (let i = 1; i <= urut.length; i += 1) {
    if (i < urut.length && posisi(urut[i]) === posisi(akhir) + 1) {
      akhir = urut[i];
      continue;
    }
    bagian.push(mulai === akhir
      ? NAMA_HARI[mulai]
      : `${NAMA_HARI[mulai]}–${NAMA_HARI[akhir]}`);
    mulai = urut[i];
    akhir = urut[i];
  }
  return bagian.join(', ');
}

// Apakah tanggal ini termasuk hari kerja shift tersebut (belum melihat libur).
function hariKerja(tanggal, shift) {
  return hariKerjaShift(shift).includes(tanggalLokal(tanggal).getDay());
}

// Periksa satu tanggal untuk satu shift.
// Mengembalikan { kerja, alasan, nama_hari, libur }.
//
// `shift` boleh null -- pegawai yang belum di-assign shift diperlakukan
// Senin-Jumat, sama seperti sebelum hari kerja bisa diatur.
async function cekHariKerja(query, tanggal, shift = null) {
  const namaHari = NAMA_HARI[tanggalLokal(tanggal).getDay()];

  if (!hariKerja(tanggal, shift)) {
    return {
      kerja: false,
      nama_hari: namaHari,
      libur: null,
      alasan: `${namaHari} bukan hari kerja shift Anda (${ringkasHariKerja(shift)}), absen ditutup.`,
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

module.exports = {
  cekHariKerja,
  hariKerja,
  hariKerjaShift,
  ringkasHariKerja,
  HARI_KERJA_DEFAULT,
  NAMA_HARI,
};
