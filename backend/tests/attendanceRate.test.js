const test = require('node:test');
const assert = require('node:assert/strict');
const { hitungRate, STATUS_DIHITUNG } = require('../src/utils/attendanceRate');

// ============================================================
// Rumus attendance rate.
//
// Angka ini menentukan penilaian kinerja pegawai, dan dipakai bersama oleh
// statistik, dashboard, dan laporan ekspor. Kalau rumusnya bergeser tanpa
// disadari, ketiganya ikut bergeser serentak -- dan tidak ada yang
// kelihatan rusak, hanya angkanya jadi salah.
// ============================================================

test('izin dan cuti tidak menurunkan angka kehadiran', () => {
  // Ketidakhadiran yang sah bukan pelanggaran: ia dikeluarkan dari
  // perhitungan, bukan dihitung sebagai hari tidak masuk.
  assert.equal(hitungRate({ hadir: 10, terlambat: 0, alpha: 0 }), '100.0');

  // Penyebutnya tidak boleh memuat izin/cuti. Kalau suatu saat keduanya
  // ikut masuk, hasilnya akan turun dari 100.0 dan uji ini gagal.
  assert.ok(!STATUS_DIHITUNG.includes('izin'));
  assert.ok(!STATUS_DIHITUNG.includes('cuti'));
});

test('terlambat tetap terhitung masuk kerja', () => {
  // Terlambat itu soal disiplin jam, bukan soal hadir atau tidak.
  assert.equal(hitungRate({ hadir: 0, terlambat: 5, alpha: 0 }), '100.0');
  assert.equal(hitungRate({ hadir: 3, terlambat: 2, alpha: 0 }), '100.0');
});

test('alpha menurunkan angkanya', () => {
  assert.equal(hitungRate({ hadir: 9, terlambat: 0, alpha: 1 }), '90.0');
  assert.equal(hitungRate({ hadir: 1, terlambat: 0, alpha: 1 }), '50.0');
  assert.equal(hitungRate({ hadir: 0, terlambat: 0, alpha: 4 }), '0.0');
});

test('pegawai baru tanpa catatan apa pun tidak membagi dengan nol', () => {
  // Pembagian dengan nol menghasilkan NaN, dan "NaN%" di layar dashboard
  // terbaca sebagai sistem rusak -- padahal pegawainya memang baru masuk.
  assert.equal(hitungRate({}), '0.0');
  assert.equal(hitungRate({ hadir: 0, terlambat: 0, alpha: 0 }), '0.0');
});

test('angka dari basis data yang berupa teks tetap dihitung, bukan disambung', () => {
  // node-pg mengembalikan COUNT() sebagai STRING. Tanpa Number(), "9" + "1"
  // menjadi "91" dan angkanya melonjak tanpa ada yang curiga.
  assert.equal(hitungRate({ hadir: '9', terlambat: '0', alpha: '1' }), '90.0');
  assert.equal(hitungRate({ hadir: '1', terlambat: '1', alpha: '2' }), '50.0');
});

test('dibulatkan ke satu angka di belakang koma', () => {
  assert.equal(hitungRate({ hadir: 2, terlambat: 0, alpha: 1 }), '66.7');
  assert.equal(hitungRate({ hadir: 1, terlambat: 0, alpha: 2 }), '33.3');
});
