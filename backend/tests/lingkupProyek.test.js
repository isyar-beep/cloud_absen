const test = require('node:test');
const assert = require('node:assert/strict');
const { adaBasisData, siapkan, bersihkan, tutup } = require('./bantuan/basisData');

// ============================================================
// Pembatasan antar proyek -- bagian paling penting untuk kerahasiaan.
//
// Sistem ini dipakai beberapa konsultan sekaligus, dan data kehadiran
// menjadi dasar pembayaran. Konsultan yang bisa melihat -- apalagi
// MEMUTUSKAN -- pengajuan pegawai proyek lain bukan sekadar cacat
// tampilan; itu kebocoran yang merusak kepercayaan pada seluruh sistem.
//
// Yang paling berbahaya bukan daftar yang bocor, melainkan alamat
// bernomor seperti /api/leaves/57/review: alamat itu tidak melewati
// penyaring daftar mana pun. Karena itu bolehAksesPegawai diuji paling
// teliti di sini.
//
// Butuh PostgreSQL sungguhan. Tanpa basis data, seluruh berkas ini
// dilewati dengan keterangan -- BUKAN dianggap lulus diam-diam.
// ============================================================

test('pembatasan proyek', async (t) => {
  // Diperiksa DI DALAM, bukan di tingkat berkas: `await` tingkat atas
  // tidak berlaku di CommonJS. Dilewati dengan keterangan, bukan
  // dinyatakan lulus -- uji yang diam-diam tidak berjalan lebih buruk
  // daripada tidak ada ujinya sama sekali.
  if (!(await adaBasisData())) {
    t.skip('PostgreSQL tidak tersedia atau skemanya belum dimigrasi');
    return;
  }

  const d = await siapkan('lingkup');
  t.after(async () => { await bersihkan(); await tutup(); });

  await t.test('admin melihat semua tanpa syarat tambahan', async () => {
    const { batasiPerPegawai } = require('../src/utils/lingkupProyek');
    const syarat = []; const params = [];
    const boleh = await batasiPerPegawai({ id: d.admin, role: 'admin' }, syarat, params);
    assert.equal(boleh, true);
    assert.equal(syarat.length, 0, 'admin tidak perlu dibatasi');
  });

  await t.test('konsultan dibatasi pada proyeknya sendiri', async () => {
    const { batasiPerPegawai } = require('../src/utils/lingkupProyek');
    const syarat = []; const params = [];
    const boleh = await batasiPerPegawai({ id: d.konsultanA, role: 'konsultan' }, syarat, params);
    assert.equal(boleh, true);
    assert.equal(syarat.length, 1, 'harus ada satu syarat lingkup');
    assert.deepEqual(params[0], [d.proyekA], 'hanya proyek A');
  });

  await t.test('konsultan tanpa proyek dibalas FALSE, bukan dibiarkan lolos', async () => {
    // Ini jebakan yang paling mahal: kalau fungsinya membalas true tanpa
    // menambah syarat, kueri berjalan TANPA pembatasan sama sekali dan
    // seluruh data terbuka. Pemanggil wajib memeriksa nilai ini.
    const { batasiPerPegawai } = require('../src/utils/lingkupProyek');
    const syarat = []; const params = [];
    const boleh = await batasiPerPegawai({ id: d.konsultanKosong, role: 'konsultan' }, syarat, params);
    assert.equal(boleh, false);
    assert.equal(syarat.length, 0);
  });

  await t.test('konsultan boleh menyentuh pegawai proyeknya', async () => {
    const { bolehAksesPegawai } = require('../src/utils/lingkupProyek');
    assert.equal(await bolehAksesPegawai({ id: d.konsultanA, role: 'konsultan' }, d.pegawaiA), true);
  });

  await t.test('konsultan DITOLAK menyentuh pegawai proyek lain', async () => {
    // Inilah yang menjaga /api/leaves/:id/review dari tebak nomor.
    const { bolehAksesPegawai } = require('../src/utils/lingkupProyek');
    assert.equal(await bolehAksesPegawai({ id: d.konsultanA, role: 'konsultan' }, d.pegawaiB), false);
  });

  await t.test('konsultan DITOLAK menyentuh pegawai tanpa proyek', async () => {
    const { bolehAksesPegawai } = require('../src/utils/lingkupProyek');
    assert.equal(await bolehAksesPegawai({ id: d.konsultanA, role: 'konsultan' }, d.pegawaiLepas), false);
  });

  await t.test('pegawai hanya boleh menyentuh dirinya sendiri', async () => {
    const { bolehAksesPegawai } = require('../src/utils/lingkupProyek');
    const dia = { id: d.pegawaiA, role: 'staff' };
    assert.equal(await bolehAksesPegawai(dia, d.pegawaiA), true);
    assert.equal(await bolehAksesPegawai(dia, d.pegawaiB), false);
  });

  await t.test('admin boleh menyentuh siapa pun', async () => {
    const { bolehAksesPegawai } = require('../src/utils/lingkupProyek');
    const dinas = { id: d.admin, role: 'admin' };
    assert.equal(await bolehAksesPegawai(dinas, d.pegawaiA), true);
    assert.equal(await bolehAksesPegawai(dinas, d.pegawaiB), true);
    assert.equal(await bolehAksesPegawai(dinas, d.pegawaiLepas), true);
  });

  await t.test('konsultan hanya boleh menyentuh proyeknya sendiri', async () => {
    const { bolehAksesProyek } = require('../src/utils/lingkupProyek');
    const ka = { id: d.konsultanA, role: 'konsultan' };
    assert.equal(await bolehAksesProyek(ka, d.proyekA), true);
    assert.equal(await bolehAksesProyek(ka, d.proyekB), false);
  });

  await t.test('riwayat disaring lewat proyek yang TERCAP di absensi', async () => {
    // Bedanya penting: pegawai yang dipindah proyek harus tetap terbaca
    // oleh konsultan proyek LAMANYA untuk hari-hari yang memang terjadi
    // di sana. Karena itu syaratnya menyebut a.project_id, bukan
    // u.project_id.
    const { batasiPerAbsensi } = require('../src/utils/lingkupProyek');
    const syarat = []; const params = [];
    await batasiPerAbsensi({ id: d.konsultanA, role: 'konsultan' }, syarat, params);
    assert.match(syarat[0], /a\.project_id/);
    assert.ok(!syarat[0].includes('u.project_id'));
  });
});
