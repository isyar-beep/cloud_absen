const test = require('node:test');
const assert = require('node:assert/strict');
const { kekuranganAbsen, tandaiKelengkapan } = require('../src/utils/kelengkapan');

// ============================================================
// Penanda "absen pulang belum ada".
//
// Tanda ini muncul di galeri dan riwayat, dan gunanya menarik perhatian
// admin ke hari yang perlu dikoreksi. Kalau ia menyala terlalu cepat --
// pada pegawai yang memang masih bekerja -- ia menyala hampir sepanjang
// hari untuk hampir semua orang, dan tanda yang selalu menyala berhenti
// diperhatikan. Justru saat itulah kelalaian yang sungguhan ikut lolos.
// ============================================================

const SHIFT_PAGI = {
  shift_start: '08:00:00',
  shift_end: '16:00:00',
  shift_checkout_close: 60, // jendela pulang tutup 17.00
};

const baris = (isi) => ({
  date: '2026-09-04',
  status: 'hadir',
  check_in_time: null,
  check_out_time: null,
  ...SHIFT_PAGI,
  ...isi,
});

const pada = (jam, menit, hari = 4) => new Date(2026, 8, hari, jam, menit, 0);

test('hari yang lengkap tidak ditandai', () => {
  const lengkap = baris({ check_in_time: '2026-09-04 08:00', check_out_time: '2026-09-04 16:10' });
  assert.equal(kekuranganAbsen(lengkap, pada(18, 0)), null);
});

test('izin dan alpha tidak menuntut foto absen apa pun', () => {
  assert.equal(kekuranganAbsen(baris({ status: 'izin' }), pada(18, 0)), null);
  assert.equal(kekuranganAbsen(baris({ status: 'alpha' }), pada(18, 0)), null);
});

test('tidak absen sama sekali bukan urusan kelengkapan', () => {
  // Itu wilayah penandaan alpha. Menandainya "kurang pulang" akan
  // menghitung hari yang sama dua kali di dua tempat berbeda.
  assert.equal(kekuranganAbsen(baris({}), pada(18, 0)), null);
});

test('pegawai yang MASIH BEKERJA tidak ditandai lupa absen pulang', () => {
  // Pukul 12.00, jendela pulang (tutup 17.00) belum lewat sama sekali.
  const sedangBekerja = baris({ check_in_time: '2026-09-04 08:00' });
  assert.equal(kekuranganAbsen(sedangBekerja, pada(12, 0)), null);
});

test('ditandai hanya setelah jendela pulang benar-benar tertutup', () => {
  const lupaPulang = baris({ check_in_time: '2026-09-04 08:00' });
  assert.equal(kekuranganAbsen(lupaPulang, pada(16, 30)), null, '16.30 jendela masih terbuka');
  assert.equal(kekuranganAbsen(lupaPulang, pada(18, 0)), 'pulang', '18.00 jendela sudah tutup');
});

test('hari-hari lampau tetap ditandai', () => {
  // Jendela tanggal mana pun di masa lalu sudah pasti tertutup.
  const kemarin = baris({ date: '2026-08-20', check_in_time: '2026-08-20 08:00' });
  assert.equal(kekuranganAbsen(kemarin, pada(9, 0)), 'pulang');
});

test('ada jam pulang tanpa jam masuk ditandai janggal seketika', () => {
  // Bisa terjadi lewat koreksi admin. Janggal terlepas dari jam berapa
  // pun, jadi tidak perlu menunggu jendela tertutup.
  const janggal = baris({ check_out_time: '2026-09-04 16:00' });
  assert.equal(kekuranganAbsen(janggal, pada(9, 0)), 'masuk');
});

test('tandaiKelengkapan membuang kolom shift dari balasan API', () => {
  // Kolom shift_* hanya dipakai untuk menghitung `kurang`. Membiarkannya
  // ikut terkirim membocorkan bentuk tabel ke luar tanpa alasan.
  const hasil = tandaiKelengkapan([baris({ check_in_time: '2026-09-04 08:00' })], pada(18, 0));
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].kurang, 'pulang');
  assert.ok(!('shift_start' in hasil[0]), 'shift_start tidak boleh ikut');
  assert.ok(!('shift_end' in hasil[0]), 'shift_end tidak boleh ikut');
  assert.ok(!('shift_checkout_close' in hasil[0]), 'shift_checkout_close tidak boleh ikut');
  assert.equal(hasil[0].date, '2026-09-04', 'kolom aslinya tetap ada');
});

test('pegawai tanpa shift tetap dinilai, memakai jendela bawaan', () => {
  const tanpaShift = {
    date: '2026-09-04', status: 'hadir',
    check_in_time: '2026-09-04 08:00', check_out_time: null,
    shift_start: null, shift_end: null, shift_checkout_close: null,
  };
  // Bawaan: 08:00-17:00, jendela pulang tutup 360 menit setelahnya.
  assert.equal(kekuranganAbsen(tanpaShift, pada(12, 0)), null, 'siang masih bekerja');
  assert.equal(kekuranganAbsen(tanpaShift, pada(23, 30)), 'pulang', 'malam sudah lewat');
});
