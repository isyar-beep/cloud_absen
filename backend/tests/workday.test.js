const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hariKerja, hariKerjaShift, ringkasHariKerja, HARI_KERJA_DEFAULT,
} = require('../src/utils/workday');

// ============================================================
// Hari kerja per shift.
//
// Salah di sini berakibat dua arah sekaligus: pegawai ditolak absen di
// hari kerjanya sendiri, atau justru bisa absen di hari kantor tutup lalu
// ikut menaikkan attendance rate sementara penanda alpha melewati hari
// itu. Dua sisi yang tidak konsisten, dan keduanya sulit disadari.
// ============================================================

test('pegawai tanpa shift memakai Senin-Jumat', () => {
  assert.deepEqual(hariKerjaShift(null), HARI_KERJA_DEFAULT);
  assert.deepEqual(hariKerjaShift({}), HARI_KERJA_DEFAULT);
  assert.deepEqual(hariKerjaShift({ work_days: [] }), HARI_KERJA_DEFAULT);
});

test('nilai rusak dari basis data jatuh ke Senin-Jumat, bukan menutup absen', () => {
  // Lebih baik pegawai bisa absen di hari yang keliru daripada seluruh
  // divisi terkunci karena satu kolom yang isinya aneh.
  assert.deepEqual(hariKerjaShift({ work_days: 'bukan array' }), HARI_KERJA_DEFAULT);
  assert.deepEqual(hariKerjaShift({ work_days: [9, 12, -1] }), HARI_KERJA_DEFAULT);
});

test('angka hari yang datang sebagai teks tetap dibaca', () => {
  // Driver Postgres bisa mengembalikan SMALLINT[] sebagai array teks.
  assert.deepEqual(hariKerjaShift({ work_days: ['1', '2', '3'] }), [1, 2, 3]);
});

test('shift akhir pekan mengizinkan Sabtu dan menolak Rabu', () => {
  // 0=Minggu ... 6=Sabtu, sama dengan getDay() dan EXTRACT(DOW) Postgres.
  const piket = { work_days: [0, 6] };
  assert.equal(hariKerja('2026-09-05', piket), true, 'Sabtu 5 Sep 2026');
  assert.equal(hariKerja('2026-09-06', piket), true, 'Minggu 6 Sep 2026');
  assert.equal(hariKerja('2026-09-02', piket), false, 'Rabu 2 Sep 2026');
});

test('tanggal dibaca sebagai waktu lokal, tidak bergeser sehari', () => {
  // `new Date("2026-09-05")` dibaca sebagai tengah malam UTC. Di WITA
  // (UTC+8) itu tetap 5 September, tapi di zona barat GMT ia mundur ke
  // 4 September -- dan Sabtu berubah jadi Jumat tanpa ada yang mengubah
  // apa pun. Uji ini menjaga pembacaan tanggalnya tetap lokal.
  const hanyaSabtu = { work_days: [6] };
  assert.equal(hariKerja('2026-09-05', hanyaSabtu), true);
  const hanyaJumat = { work_days: [5] };
  assert.equal(hariKerja('2026-09-05', hanyaJumat), false);
});

test('ringkasan hari kerja ditulis mulai Senin, bukan mulai Minggu', () => {
  assert.equal(ringkasHariKerja({ work_days: [1, 2, 3, 4, 5] }), 'Senin–Jumat');

  // Dengan urutan angka mentah, akhir pekan terbaca "Minggu, Sabtu" --
  // benar secara data, tapi tidak ada orang yang menyebutnya begitu.
  assert.equal(ringkasHariKerja({ work_days: [0, 6] }), 'Sabtu–Minggu');
});

test('ringkasan menyebut "Setiap hari" saat tujuh hari terisi', () => {
  assert.equal(ringkasHariKerja({ work_days: [0, 1, 2, 3, 4, 5, 6] }), 'Setiap hari');
});

test('hari yang tidak bersambung ditulis terpisah, bukan sebagai rentang', () => {
  // Senin, Rabu, Jumat bukan "Senin–Jumat" -- selisihnya tiga hari kerja.
  assert.equal(ringkasHariKerja({ work_days: [1, 3, 5] }), 'Senin, Rabu, Jumat');
});
