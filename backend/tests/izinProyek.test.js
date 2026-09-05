const test = require('node:test');
const assert = require('node:assert/strict');
const { adaBasisData, siapkan, bersihkan, tutup, ambilPool } = require('./bantuan/basisData');

// ============================================================
// Hari izin harus tetap terlihat oleh konsultan proyeknya.
//
// Persetujuan izin/sakit/cuti menulis baris attendance berstatus 'izin'.
// Dulu baris itu dibuat tanpa project_id, dan konsultan menyaring seluruh
// data lewat a.project_id -- NULL tidak pernah cocok dengan syarat apa
// pun, jadi setiap hari izin yang disetujui lenyap dari layarnya.
//
// Bentuk kegagalannya yang membuatnya berbahaya: tidak ada yang tampak
// rusak. Tidak ada galat, tidak ada baris merah. Konsultan hanya melihat
// tidak ada catatan di tanggal itu -- yang justru terbaca seperti
// pegawainya menghilang tanpa kabar, padahal ia sudah benar mengurus
// izinnya dan sudah disetujui.
//
// Ditemukan lewat pengujian manual: admin melihat "Izin" di tanggal 7 dan
// 10 September, konsultan proyek yang sama tidak melihat keduanya.
// ============================================================

process.env.JWT_SECRET = process.env.JWT_SECRET || 'rahasia-uji';

// req/res palsu secukupnya untuk memanggil controller langsung.
function palsu(user, params = {}, body = {}) {
  const res = {
    status(k) { this.kode = k; return this; },
    json(b) { this.badan = b; return this; },
  };
  return {
    req: { user, params, body },
    res,
    galat: null,
    next(err) { this.galat = err; },
  };
}

test('proyek pada hari izin', async (t) => {
  if (!(await adaBasisData())) {
    t.skip('PostgreSQL tidak tersedia atau skemanya belum dimigrasi');
    return;
  }

  const d = await siapkan('izin');
  const p = ambilPool();
  const { reviewLeave } = require('../src/controllers/leaveController');
  const { batasiPerAbsensi } = require('../src/utils/lingkupProyek');
  t.after(async () => { await bersihkan(); await tutup(); });

  const admin = { id: d.admin, role: 'admin' };
  const konsultanA = { id: d.konsultanA, role: 'konsultan' };

  // Mengajukan izin lalu menyetujuinya lewat controller yang sesungguhnya,
  // bukan menulis baris attendance langsung -- yang diuji memang jalur
  // persetujuannya.
  async function ajukanLalliSetujui(userId, mulai, sampai) {
    const r = await p.query(
      `INSERT INTO leave_requests (user_id, start_date, end_date, reason, type, status)
       VALUES ($1, $2, $3, 'uji lingkup proyek', 'izin', 'pending') RETURNING id`,
      [userId, mulai, sampai]
    );
    const k = palsu(admin, { id: r.rows[0].id }, { status: 'approved' });
    await reviewLeave(k.req, k.res, (e) => { k.galat = e; });
    assert.equal(k.galat, null, k.galat?.message);
    return r.rows[0].id;
  }

  const barisIzin = (userId, tanggal) =>
    p.query('SELECT project_id, status FROM attendance WHERE user_id = $1 AND date = $2',
      [userId, tanggal]);

  await t.test('izin yang disetujui tercap proyek pegawainya', async () => {
    await ajukanLalliSetujui(d.pegawaiA, '2026-03-02', '2026-03-02');

    const hasil = await barisIzin(d.pegawaiA, '2026-03-02');
    assert.equal(hasil.rows.length, 1);
    assert.equal(hasil.rows[0].status, 'izin');
    assert.equal(hasil.rows[0].project_id, d.proyekA,
      'tanpa ini barisnya tak terlihat oleh konsultan mana pun');
  });

  await t.test('rentang beberapa hari semuanya tercap, bukan hari pertama saja', async () => {
    await ajukanLalliSetujui(d.pegawaiA, '2026-03-10', '2026-03-12');

    const hasil = await p.query(
      `SELECT to_char(date, 'YYYY-MM-DD') AS tgl, project_id FROM attendance
       WHERE user_id = $1 AND date BETWEEN '2026-03-10' AND '2026-03-12' ORDER BY date`,
      [d.pegawaiA]
    );
    assert.equal(hasil.rows.length, 3);
    for (const b of hasil.rows) {
      assert.equal(b.project_id, d.proyekA, `${b.tgl} tidak tercap proyek`);
    }
  });

  // --- Yang membuktikan bug aslinya benar-benar tertutup ---

  await t.test('KONSULTAN PROYEKNYA MELIHAT hari izin itu', async () => {
    // Meniru persis kueri riwayat: syarat lingkup disusun oleh fungsi yang
    // sama yang dipakai controller, bukan syarat tiruan yang bisa berbeda.
    const kondisi = ["u.role = 'staff'"];
    const params = [];
    assert.equal(await batasiPerAbsensi(konsultanA, kondisi, params), true);

    const hasil = await p.query(
      `SELECT to_char(a.date, 'YYYY-MM-DD') AS tgl, a.status
       FROM attendance a JOIN users u ON a.user_id = u.id
       WHERE ${kondisi.join(' AND ')} AND a.user_id = $${params.length + 1}
       ORDER BY a.date`,
      [...params, d.pegawaiA]
    );

    const tanggal = hasil.rows.map((r) => r.tgl);
    assert.ok(tanggal.includes('2026-03-02'), 'hari izin harus terlihat konsultan');
    assert.ok(tanggal.includes('2026-03-10'));
    assert.ok(tanggal.includes('2026-03-12'));
  });

  await t.test('konsultan proyek LAIN tetap tidak melihatnya', async () => {
    // Perbaikan ini menambah baris yang terlihat; yang tidak boleh ikut
    // terbuka adalah data proyek sebelah.
    const konsultanB = { id: d.konsultanB, role: 'konsultan' };
    const kondisi = ["u.role = 'staff'"];
    const params = [];
    await batasiPerAbsensi(konsultanB, kondisi, params);

    const hasil = await p.query(
      `SELECT a.id FROM attendance a JOIN users u ON a.user_id = u.id
       WHERE ${kondisi.join(' AND ')} AND a.user_id = $${params.length + 1}`,
      [...params, d.pegawaiA]
    );
    assert.equal(hasil.rows.length, 0, 'kebocoran antar proyek');
  });

  await t.test('pegawai tanpa proyek tidak dipaksa punya proyek', async () => {
    // Menebak proyeknya berarti mengarang data. NULL adalah jawaban yang
    // benar di sini, dan konsekuensinya -- hanya dinas yang melihatnya --
    // memang sesuai: tidak ada konsultan yang berhak atas pegawai ini.
    await ajukanLalliSetujui(d.pegawaiLepas, '2026-03-05', '2026-03-05');

    const hasil = await barisIzin(d.pegawaiLepas, '2026-03-05');
    assert.equal(hasil.rows.length, 1);
    assert.equal(hasil.rows[0].project_id, null);
  });

  await t.test('absensi yang sudah tercap proyek TIDAK ditimpa penugasan hari ini', async () => {
    // Pegawai absen di proyek B, lalu dipindah ke proyek A, lalu izinnya
    // untuk tanggal itu disetujui belakangan. Proyek yang tercap saat
    // kehadiran terjadi lebih benar daripada penugasannya sekarang --
    // menimpanya akan memindahkan riwayat lama ke proyek yang tidak ada
    // hubungannya dengan hari itu.
    await p.query(
      `INSERT INTO attendance (user_id, date, status, project_id)
       VALUES ($1, '2026-04-01', 'alpha', $2)`,
      [d.pegawaiA, d.proyekB]
    );

    await ajukanLalliSetujui(d.pegawaiA, '2026-04-01', '2026-04-01');

    const hasil = await barisIzin(d.pegawaiA, '2026-04-01');
    assert.equal(hasil.rows[0].status, 'izin', 'statusnya tetap diperbarui');
    assert.equal(hasil.rows[0].project_id, d.proyekB, 'proyek lamanya harus dipertahankan');
  });

  await t.test('absensi asli yang sudah check-in tidak diubah jadi izin', async () => {
    // Penjagaan lama yang harus tetap utuh sesudah perubahan ini.
    await p.query(
      `INSERT INTO attendance (user_id, date, status, project_id, check_in_time)
       VALUES ($1, '2026-04-08', 'hadir', $2, '2026-04-08 07:30:00')`,
      [d.pegawaiA, d.proyekA]
    );

    await ajukanLalliSetujui(d.pegawaiA, '2026-04-08', '2026-04-08');

    const hasil = await barisIzin(d.pegawaiA, '2026-04-08');
    assert.equal(hasil.rows[0].status, 'hadir', 'kehadiran sungguhan tidak boleh kalah oleh izin');
  });
});
