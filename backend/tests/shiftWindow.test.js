const test = require('node:test');
const assert = require('node:assert/strict');
const {
  jendelaAbsen, lintasTengahMalam, durasiMenit, SHIFT_DEFAULT,
} = require('../src/utils/shiftWindow');

// ============================================================
// Jendela absen dan TANGGAL SHIFT.
//
// Ini bagian paling halus di seluruh sistem, dan paling mahal kalau
// salah: pegawai shift malam yang tidak bisa absen pulang akan tercatat
// tidak lengkap setiap hari, dan tidak ada pesan galat yang menunjuk ke
// sini. Semua waktu diuji sebagai waktu lokal, sama seperti yang dipakai
// server (TZ=Asia/Makassar).
// ============================================================

const SHIFT_PAGI = {
  name: 'Pagi',
  start_time: '08:00:00',
  end_time: '16:00:00',
  work_days: [1, 2, 3, 4, 5],
  checkin_open_minutes: 30,
  checkin_close_minutes: 30,
  checkout_open_minutes: 30,
  checkout_close_minutes: 30,
};

const SHIFT_MALAM = {
  name: 'Malam',
  start_time: '22:00:00',
  end_time: '06:00:00',
  work_days: [1, 2, 3, 4, 5],
  checkin_open_minutes: 30,
  checkin_close_minutes: 60,
  checkout_open_minutes: 30,
  checkout_close_minutes: 60,
};

// 4 September 2026 adalah hari Jumat.
const pada = (jam, menit, hari = 4) => new Date(2026, 8, hari, jam, menit, 0);

test('shift malam dikenali menyeberang tengah malam, shift pagi tidak', () => {
  assert.equal(lintasTengahMalam(SHIFT_MALAM), true);
  assert.equal(lintasTengahMalam(SHIFT_PAGI), false);
});

test('shift 24 jam penuh dihitung 24 jam, bukan nol', () => {
  // 08:00-08:00 punya jam mulai dan selesai yang sama. Kalau durasinya
  // dihitung nol, seluruh jendela absennya runtuh jadi satu titik waktu.
  const penuh = { start_time: '08:00:00', end_time: '08:00:00' };
  assert.equal(lintasTengahMalam(penuh), true);
  assert.equal(durasiMenit(penuh), 1440);
});

test('shift pagi: jendela masuk buka tepat 30 menit sebelum jam mulai', () => {
  assert.equal(jendelaAbsen(SHIFT_PAGI, pada(7, 29)).masuk.boleh, false, '07.29 belum buka');
  assert.equal(jendelaAbsen(SHIFT_PAGI, pada(7, 30)).masuk.boleh, true, '07.30 tepat buka');
  assert.equal(jendelaAbsen(SHIFT_PAGI, pada(8, 30)).masuk.boleh, true, '08.30 tepat tutup');
  assert.equal(jendelaAbsen(SHIFT_PAGI, pada(8, 31)).masuk.boleh, false, '08.31 sudah tutup');
});

test('terlambat dihitung dari jam mulai shift, bukan dari batas jendela', () => {
  // Absen 08.05 masih di dalam jendela (tutup 08.30) tapi tetap terlambat.
  assert.equal(jendelaAbsen(SHIFT_PAGI, pada(7, 45)).terlambat, false);
  assert.equal(jendelaAbsen(SHIFT_PAGI, pada(8, 5)).terlambat, true);
});

test('alasan penolakan menyebutkan jamnya, bukan sekadar "tidak boleh"', () => {
  // Pegawai di lapangan perlu tahu harus kembali pukul berapa.
  const pagi = jendelaAbsen(SHIFT_PAGI, pada(6, 0));
  assert.equal(pagi.masuk.boleh, false);
  assert.match(pagi.masuk.alasan, /07\.30/);
  assert.equal(pagi.masuk.buka, '07.30');
  assert.equal(pagi.masuk.tutup, '08.30');
});

// --- Inti persoalannya: tanggal shift untuk pekerja malam ---

test('shift malam: absen masuk Jumat 22.00 dan pulang Sabtu 06.10 satu tanggal shift', () => {
  // Sebelum tanggal shift diperkenalkan, absen pulang dicari dengan
  // "date = tanggal hari ini", sehingga pegawai yang pulang Sabtu pagi
  // selalu ditolak "belum absen masuk hari ini".
  const saatMasuk = jendelaAbsen(SHIFT_MALAM, pada(22, 0, 4));   // Jumat 22.00
  const saatPulang = jendelaAbsen(SHIFT_MALAM, pada(6, 10, 5));  // Sabtu 06.10

  assert.equal(saatMasuk.masuk.boleh, true, 'Jumat 22.00 boleh absen masuk');
  assert.equal(saatPulang.pulang.boleh, true, 'Sabtu 06.10 boleh absen pulang');

  assert.equal(
    saatPulang.tanggal_shift_pulang,
    saatMasuk.tanggal_shift_masuk,
    'keduanya harus menunjuk tanggal shift yang sama'
  );
  assert.equal(saatMasuk.tanggal_shift_masuk, '2026-09-04', 'tanggal shift = hari shift DIMULAI');
});

test('shift malam: tengah malam masih milik tanggal shift kemarin', () => {
  // 00.30 Sabtu adalah pertengahan shift yang mulai Jumat malam.
  const tengahMalam = jendelaAbsen(SHIFT_MALAM, pada(0, 30, 5));
  assert.equal(tengahMalam.tanggal_shift_masuk, '2026-09-04');
});

test('shift pagi tidak terpengaruh: tanggal shift sama dengan tanggal kalender', () => {
  const pagi = jendelaAbsen(SHIFT_PAGI, pada(8, 0, 4));
  assert.equal(pagi.tanggal_shift_masuk, '2026-09-04');
  assert.equal(pagi.tanggal_shift_pulang, '2026-09-04');
});

test('pegawai tanpa shift memakai nilai bawaan tanpa melempar galat', () => {
  const tanpaShift = jendelaAbsen(null, pada(9, 0));
  assert.equal(tanpaShift.shift.nama, SHIFT_DEFAULT.name);
  assert.equal(tanpaShift.shift.mulai, '08:00');
  assert.equal(tanpaShift.shift.lintas_hari, false);
});

test('shift dari basis data yang kolomnya sebagian kosong tetap utuh', () => {
  // Shift yang dibuat sebelum migration 009 tidak punya work_days.
  const sebagian = { name: 'Lama', start_time: '09:00:00', end_time: '17:00:00' };
  const hasil = jendelaAbsen(sebagian, pada(9, 30));
  assert.equal(hasil.shift.nama, 'Lama');
  assert.deepEqual(hasil.shift.hari_kerja, [1, 2, 3, 4, 5], 'jatuh ke Senin-Jumat');
  assert.equal(hasil.masuk.boleh, true);
});
