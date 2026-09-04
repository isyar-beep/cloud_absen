const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('../src/utils/retensi');

// ============================================================
// Masa simpan foto.
//
// Yang diuji di sini adalah kode yang MENGHAPUS BERKAS ORANG LAIN, dan
// itu menuntut pengujian yang berbeda sifatnya. Pada kebanyakan hal,
// kesalahan berarti sesuatu tidak berjalan dan seseorang mengeluh. Di
// sini, kesalahan berarti foto absensi dua tahun lenyap tanpa salinan --
// tidak ada yang mengeluh hari itu, dan baru ketahuan bertahun kemudian
// oleh orang yang mencarinya untuk pemeriksaan.
//
// Karena itu yang paling banyak diuji justru KEADAAN YANG HARUS MENOLAK,
// bukan keadaan yang berhasil.
// ============================================================

function ruangUji() {
  const akar = fs.mkdtempSync(path.join(os.tmpdir(), 'retensi-'));
  const dasar = path.join(akar, 'uploads');
  const arsipDir = path.join(akar, 'arsip');
  return { akar, dasar, arsipDir };
}

function tanamBerkas(dasar, jenis, bulan, nama, isi) {
  const dir = path.join(dasar, jenis, bulan);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, nama), isi);
  return path.join(dir, nama);
}

test('penentuan bulan yang lewat masa simpan', async (t) => {
  const sekarang = new Date('2026-09-15T10:00:00');
  const lewat = (b) => R.lewatMasaSimpan(b, { bulanSimpan: 24, sekarang });

  await t.test('bulan yang jelas tua sudah lewat', () => {
    assert.equal(lewat('2023-01'), true);
    assert.equal(lewat('2024-06'), true);
  });

  await t.test('bulan baru belum lewat', () => {
    assert.equal(lewat('2026-08'), false);
    assert.equal(lewat('2025-12'), false);
  });

  await t.test('batasnya condong MENYIMPAN, bukan menghapus', () => {
    // Folder 2024-09 berisi berkas berumur 23-24 bulan pada September
    // 2026. Membuangnya berarti ada berkas yang dihapus sebelum genap
    // dua tahun. Kelebihan simpan sebulan cuma memakan disk; kekurangan
    // simpan sehari bisa berarti bukti yang hilang saat diperiksa.
    assert.equal(lewat('2024-09'), false, '24 bulan tepat: masih disimpan');
    assert.equal(lewat('2024-08'), true, 'lebih dari 24 bulan: baru dibuang');
  });

  await t.test('pergantian tahun tidak membuatnya terpeleset', () => {
    // Perbandingan sebagai teks akan menyangka "2025-01" lebih tua dari
    // "2024-12".
    const awalTahun = new Date('2026-01-10T10:00:00');
    assert.equal(R.lewatMasaSimpan('2023-12', { bulanSimpan: 24, sekarang: awalTahun }), true);
    assert.equal(R.lewatMasaSimpan('2024-01', { bulanSimpan: 24, sekarang: awalTahun }), false);
  });

  await t.test('nama folder yang bukan bulan diabaikan, bukan dihapus', () => {
    // Folder asing di dalam uploads/ tidak boleh ikut terbawa.
    assert.equal(lewat('sementara'), false);
    assert.equal(lewat('2024-13'), false);
    assert.equal(lewat(''), false);
  });
});

test('pengarsipan sebelum penghapusan', async (t) => {
  await t.test('arsip menyalin isinya dan mencatat sidik tiap berkas', () => {
    const { dasar, arsipDir } = ruangUji();
    tanamBerkas(dasar, 'absensi', '2024-01', 'a.jpg', 'isi foto a');
    tanamBerkas(dasar, 'absensi', '2024-01', 'b.jpg', 'isi foto b');

    const m = R.arsipkanBulan({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });

    assert.equal(m.jumlah, 2);
    assert.equal(fs.readFileSync(path.join(arsipDir, 'absensi', '2024-01', 'a.jpg'), 'utf8'), 'isi foto a');
    assert.ok(fs.existsSync(R.jalurManifes(arsipDir, 'absensi', '2024-01')));
    assert.equal(m.berkas[0].sha256.length, 64);
  });

  await t.test('bulan yang sudah diarsipkan boleh dihapus', () => {
    const { dasar, arsipDir } = ruangUji();
    tanamBerkas(dasar, 'absensi', '2024-01', 'a.jpg', 'isi foto a');
    R.arsipkanBulan({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });

    const p = R.bolehDihapus({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });
    assert.equal(p.boleh, true);
  });

  // --- Yang harus MENOLAK ---

  await t.test('bulan yang belum diarsipkan TIDAK boleh dihapus', () => {
    // Ini penjagaan yang paling penting dari seluruh berkas ini.
    const { dasar, arsipDir } = ruangUji();
    tanamBerkas(dasar, 'absensi', '2024-01', 'a.jpg', 'isi foto a');

    const p = R.bolehDihapus({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });
    assert.equal(p.boleh, false);
    assert.match(p.alasan, /belum diarsipkan/);
  });

  await t.test('berkas yang masuk SETELAH pengarsipan menahan penghapusan', () => {
    // Keadaan nyata: koreksi absensi yang disetujui belakangan menambah
    // foto ke bulan yang sudah diarsipkan. Foto itu tidak punya salinan,
    // dan tanpa pemeriksaan ini ia akan terhapus tanpa jejak.
    const { dasar, arsipDir } = ruangUji();
    tanamBerkas(dasar, 'absensi', '2024-01', 'a.jpg', 'isi foto a');
    R.arsipkanBulan({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });

    tanamBerkas(dasar, 'absensi', '2024-01', 'susulan.jpg', 'foto koreksi');

    const p = R.bolehDihapus({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });
    assert.equal(p.boleh, false);
    assert.match(p.alasan, /setelah pengarsipan/);
  });

  await t.test('berkas yang berubah setelah diarsipkan menahan penghapusan', () => {
    const { dasar, arsipDir } = ruangUji();
    const berkas = tanamBerkas(dasar, 'absensi', '2024-01', 'a.jpg', 'isi foto a');
    R.arsipkanBulan({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });

    fs.writeFileSync(berkas, 'isi yang sudah berbeda');

    const p = R.bolehDihapus({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });
    assert.equal(p.boleh, false);
    assert.match(p.alasan, /tidak cocok/);
  });

  await t.test('manifes yang rusak menahan penghapusan', () => {
    // Manifes yang tidak bisa dibaca berarti keadaannya tidak diketahui,
    // dan keadaan yang tidak diketahui bukan alasan untuk menghapus.
    const { dasar, arsipDir } = ruangUji();
    tanamBerkas(dasar, 'absensi', '2024-01', 'a.jpg', 'isi foto a');
    R.arsipkanBulan({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });

    fs.writeFileSync(R.jalurManifes(arsipDir, 'absensi', '2024-01'), '{ rusak');

    const p = R.bolehDihapus({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });
    assert.equal(p.boleh, false);
    assert.match(p.alasan, /rusak/);
  });

  await t.test('salinan yang dihapus orang tidak lolos begitu saja', () => {
    // Manifesnya masih ada, tapi arsipnya sudah tidak. Pemeriksaan
    // berikutnya harus tetap menolak -- lihat catatan di bawah.
    const { dasar, arsipDir } = ruangUji();
    tanamBerkas(dasar, 'absensi', '2024-01', 'a.jpg', 'isi foto a');
    R.arsipkanBulan({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });

    fs.rmSync(path.join(arsipDir, 'absensi', '2024-01'), { recursive: true });

    const p = R.bolehDihapus({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });
    assert.equal(p.boleh, false, 'manifes tanpa salinan bukan bukti apa pun');
  });
});

test('pencocokan berkas dengan manifesnya', async (t) => {
  t.beforeEach(() => R.lupakanSinggahan());

  await t.test('bulan dan jenis terbaca dari URL foto', () => {
    assert.deepEqual(R.bulanDariUrl('/uploads/absensi/2026-08/x.jpg'),
      { jenis: 'absensi', bulan: '2026-08' });
    assert.deepEqual(R.bulanDariUrl('/uploads/dokumen/2025-12/s.pdf'),
      { jenis: 'dokumen', bulan: '2025-12' });
  });

  await t.test('URL yang tidak dikenali menjawab null, bukan menebak', () => {
    // Menebak di sini berarti menghapus berkas yang letaknya tidak
    // dipahami. Lebih baik menolak dan melapor.
    assert.equal(R.bulanDariUrl('/uploads/avatar/x.jpg'), null);
    assert.equal(R.bulanDariUrl(''), null);
    assert.equal(R.bulanDariUrl(null), null);
    assert.equal(R.bulanDariUrl('/uploads/absensi/x.jpg'), null);
  });

  await t.test('manifesMemuat hanya membenarkan berkas yang benar-benar tercatat', () => {
    const { dasar, arsipDir } = ruangUji();
    tanamBerkas(dasar, 'absensi', '2024-01', 'a.jpg', 'isi foto a');
    R.arsipkanBulan({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });

    assert.equal(R.manifesMemuat(arsipDir, 'absensi', '2024-01', 'a.jpg'), true);
    assert.equal(R.manifesMemuat(arsipDir, 'absensi', '2024-01', 'susulan.jpg'), false);
    assert.equal(R.manifesMemuat(arsipDir, 'absensi', '2099-01', 'a.jpg'), false);
  });

  await t.test('manifes tanpa salinan tidak membenarkan penghapusan', () => {
    // Ini jalur yang benar-benar menghapus. Pemeriksaan yang lebih
    // longgar di sini akan membuat pemeriksaan ketat di bolehDihapus()
    // sekadar pajangan -- foto tetap terhapus tanpa salinan.
    const { dasar, arsipDir } = ruangUji();
    tanamBerkas(dasar, 'absensi', '2024-01', 'a.jpg', 'isi foto a');
    R.arsipkanBulan({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });

    // Folder arsip dipindahkan ke penyimpanan dinas -- tindakan yang
    // justru wajar dan diharapkan.
    fs.rmSync(path.join(arsipDir, 'absensi', '2024-01'), { recursive: true });
    R.lupakanSinggahan();

    assert.equal(R.manifesMemuat(arsipDir, 'absensi', '2024-01', 'a.jpg'), false);
  });

  await t.test('salinan yang rusak tidak membenarkan penghapusan', () => {
    const { dasar, arsipDir } = ruangUji();
    tanamBerkas(dasar, 'absensi', '2024-01', 'a.jpg', 'isi foto a');
    R.arsipkanBulan({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });

    fs.writeFileSync(path.join(arsipDir, 'absensi', '2024-01', 'a.jpg'), 'rusak');
    R.lupakanSinggahan();

    assert.equal(R.manifesMemuat(arsipDir, 'absensi', '2024-01', 'a.jpg'), false);
    const p = R.bolehDihapus({ dasar, arsipDir, jenis: 'absensi', bulan: '2024-01' });
    assert.equal(p.boleh, false);
    assert.match(p.alasan, /rusak/);
  });
});
