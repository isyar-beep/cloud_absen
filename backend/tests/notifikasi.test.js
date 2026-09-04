const test = require('node:test');
const assert = require('node:assert/strict');
const { adaBasisData, siapkan, bersihkan, tutup, ambilPool } = require('./bantuan/basisData');

// ============================================================
// Siapa yang menerima pemberitahuan saat seorang pegawai mengajukan.
//
// Aturannya: konsultan penanggung jawab proyek pegawai itu, DAN seluruh
// admin. Keduanya, bukan salah satu -- konsultan yang biasanya
// memutuskan, tapi dinas harus tetap bisa bertindak bila konsultannya
// berhalangan, dan itu mustahil kalau dinas tidak pernah tahu.
//
// Yang paling perlu dijaga adalah sisi NEGATIFNYA: konsultan proyek lain
// tidak boleh menerima apa pun. Kebocoran di sini sulit disadari karena
// tidak ada yang tampak rusak -- hanya ada satu orang tambahan yang
// membaca sesuatu yang bukan haknya.
// ============================================================

test('penyebaran pemberitahuan', async (t) => {
  if (!(await adaBasisData())) {
    t.skip('PostgreSQL tidak tersedia atau skemanya belum dimigrasi');
    return;
  }

  const d = await siapkan('notif');
  const p = ambilPool();
  t.after(async () => { await bersihkan(); await tutup(); });

  // Admin lain mungkin sudah ada di basis data ini; yang diperiksa adalah
  // keanggotaan, bukan jumlah persisnya.
  const { penyeliaPegawai, kirimNotifikasi } = require('../src/utils/notifikasi');

  await t.test('pengajuan sampai ke konsultan proyeknya dan ke dinas', async () => {
    const penerima = await penyeliaPegawai(d.pegawaiA);
    assert.ok(penerima.includes(d.konsultanA), 'konsultan proyek A harus menerima');
    assert.ok(penerima.includes(d.admin), 'dinas harus menerima');
  });

  await t.test('konsultan proyek LAIN tidak menerima apa pun', async () => {
    const penerima = await penyeliaPegawai(d.pegawaiA);
    assert.ok(!penerima.includes(d.konsultanB), 'konsultan proyek B tidak boleh menerima');
    assert.ok(!penerima.includes(d.konsultanKosong), 'konsultan tanpa proyek tidak boleh menerima');
  });

  await t.test('pegawai tidak diberi tahu tentang perbuatannya sendiri', async () => {
    const penerima = await penyeliaPegawai(d.pegawaiA);
    assert.ok(!penerima.includes(d.pegawaiA));
  });

  await t.test('pegawai tanpa proyek hanya sampai ke dinas', async () => {
    // Ini kasus yang membuktikan pembatasannya bekerja: tanpa proyek,
    // tidak ada konsultan yang berhak tahu.
    const penerima = await penyeliaPegawai(d.pegawaiLepas);
    assert.ok(penerima.includes(d.admin), 'dinas tetap menerima');
    assert.ok(!penerima.includes(d.konsultanA));
    assert.ok(!penerima.includes(d.konsultanB));
  });

  await t.test('akun nonaktif tidak lagi menerima pemberitahuan', async () => {
    await p.query('UPDATE users SET is_active = FALSE WHERE id = $1', [d.konsultanA]);
    const penerima = await penyeliaPegawai(d.pegawaiA);
    assert.ok(!penerima.includes(d.konsultanA), 'konsultan yang dinonaktifkan harus berhenti menerima');
    await p.query('UPDATE users SET is_active = TRUE WHERE id = $1', [d.konsultanA]);
  });

  await t.test('satu baris tersimpan per penerima', async () => {
    const hasil = await kirimNotifikasi({
      userIds: [d.konsultanA, d.admin],
      jenis: 'uji',
      judul: 'Judul uji',
      pesan: 'Pesan uji',
      tautan: '/admin/leaves',
      push: false, // jangan menghubungi layanan Expo dari dalam pengujian
    });
    assert.equal(hasil.dibuat, 2);

    const baris = await p.query(
      `SELECT user_id FROM notifications WHERE jenis = 'uji' ORDER BY user_id`
    );
    assert.equal(baris.rows.length, 2);
  });

  await t.test('penerima kembar hanya ditulis sekali', async () => {
    // penyeliaPegawai bisa memuat orang yang sama dua kali kalau seorang
    // admin kebetulan juga konsultan proyek itu. Menulis dua baris berarti
    // satu pemberitahuan tampil dobel di layarnya.
    await p.query(`DELETE FROM notifications WHERE jenis = 'kembar'`);
    const hasil = await kirimNotifikasi({
      userIds: [d.admin, d.admin, d.admin],
      jenis: 'kembar',
      judul: 'Sekali saja',
      push: false,
    });
    assert.equal(hasil.dibuat, 1);
  });

  await t.test('daftar penerima kosong tidak menulis apa pun', async () => {
    assert.equal((await kirimNotifikasi({ userIds: [], jenis: 'x', judul: 'x', push: false })).dibuat, 0);
    assert.equal((await kirimNotifikasi({ userIds: null, jenis: 'x', judul: 'x', push: false })).dibuat, 0);
  });

  await t.test('pemberitahuan lama yang sudah dibaca dibersihkan sendiri', async () => {
    // Dibersihkan saat menulis, bukan lewat cron: cron adalah satu lagi
    // hal yang harus diingat dipasang saat pindah server, dan kalau
    // terlupa tidak ada yang memberi tahu.
    const tanam = async (judul, dibaca, umurHari) => {
      await p.query(
        `INSERT INTO notifications (user_id, jenis, judul, dibaca_pada, created_at)
         VALUES ($1, 'lama', $2, $3, NOW() - ($4 || ' days')::interval)`,
        [d.admin, judul, dibaca ? new Date() : null, umurHari]
      );
    };
    await tanam('dibaca-100hari', true, 100);
    await tanam('belum-100hari', false, 100);
    await tanam('belum-200hari', false, 200);
    await tanam('dibaca-10hari', true, 10);

    // Menulis pemberitahuan baru memicu pembersihan untuk penerima itu.
    await kirimNotifikasi({ userIds: [d.admin], jenis: 'pemicu', judul: 'x', push: false });

    const sisa = await p.query(
      `SELECT judul FROM notifications WHERE user_id = $1 AND jenis = 'lama' ORDER BY judul`,
      [d.admin]
    );
    const judul = sisa.rows.map((r) => r.judul);
    assert.deepEqual(judul, ['belum-100hari', 'dibaca-10hari'],
      'yang dibaca >90 hari dan apa pun >180 hari harus terbuang');
  });
});
