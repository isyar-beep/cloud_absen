const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { adaBasisData, siapkan, bersihkan, tutup, ambilPool } = require('./bantuan/basisData');

// ============================================================
// Keamanan akun pegawai.
//
// Tiga keadaan yang diuji di sini, ketiganya nyata terjadi di lapangan
// dan ketiganya tidak menampakkan gejala apa pun sebelum diperbaiki:
//
// 1. Pegawai lupa sandi, admin menetapkan sandi baru lalu membacakannya
//    lewat telepon. Sandi itu dulu bisa dipakai SELAMANYA -- siapa pun
//    yang ikut mendengar memegang akses permanen.
//
// 2. Seseorang mengganti sandinya karena curiga ada yang tahu. Dulu
//    penggantian itu TIDAK memutus sesi di perangkat lain, jadi yang
//    memegang token lama tetap masuk tanpa perlu tahu sandi barunya.
//    Penggantian sandi yang tidak memutus sesi adalah jaminan palsu.
//
// 3. Pemilik akun tidak punya apa pun yang bisa diperiksa sendiri untuk
//    menyadari akunnya dipakai orang lain.
// ============================================================

process.env.JWT_SECRET = process.env.JWT_SECRET || 'rahasia-uji';

function palsu(token, { jalur = '/api/attendance/today', metode = 'GET', body = {}, user } = {}) {
  const res = {
    status(k) { this.kode = k; return this; },
    json(b) { this.badan = b; return this; },
  };
  let lanjut = false;
  return {
    req: {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      originalUrl: jalur, method: metode, body, user,
    },
    res,
    next: () => { lanjut = true; },
    lanjutKah: () => lanjut,
  };
}

const tokenUntuk = (id, peran, opsi = {}) =>
  jwt.sign({ id, email: 'x@uji.local', role: peran }, process.env.JWT_SECRET,
    { expiresIn: '7d', ...opsi });

test('keamanan akun', async (t) => {
  if (!(await adaBasisData())) {
    t.skip('PostgreSQL tidak tersedia atau skemanya belum dimigrasi');
    return;
  }

  const d = await siapkan('keamanan');
  const p = ambilPool();
  const { authenticate, lupakanSemua } = require('../src/middleware/auth');
  const { changePassword, keluarSemua } = require('../src/controllers/authController');
  const { resetPassword } = require('../src/controllers/userController');

  t.after(async () => { await bersihkan(); await tutup(); });
  t.beforeEach(() => lupakanSemua());

  const bersihkanTanda = async (id) => {
    await p.query(
      `UPDATE users SET harus_ganti_sandi = FALSE, sesi_sejak_epoch = NULL WHERE id = $1`,
      [id]
    );
    lupakanSemua();
  };

  // --- 1. Sandi sementara wajib diganti ---

  await t.test('akun dengan sandi sementara DITOLAK di seluruh jalur biasa', async () => {
    await p.query('UPDATE users SET harus_ganti_sandi = TRUE WHERE id = $1', [d.pegawaiA]);
    const k = palsu(tokenUntuk(d.pegawaiA, 'staff'), { jalur: '/api/attendance/today' });
    await authenticate(k.req, k.res, k.next);

    assert.equal(k.lanjutKah(), false);
    assert.equal(k.res.kode, 403);
    // Penanda ini yang dibaca web dan HP untuk membuka layar ganti sandi.
    // Tanpanya keduanya cuma melihat 403 dan menampilkan "tidak punya
    // akses" -- pesan yang salah, dan pengguna tidak tahu harus apa.
    assert.equal(k.res.badan.harus_ganti_sandi, true);

    await bersihkanTanda(d.pegawaiA);
  });

  await t.test('tapi jalur ganti sandi TETAP terbuka -- kalau tidak, akunnya terkunci selamanya', async () => {
    await p.query('UPDATE users SET harus_ganti_sandi = TRUE WHERE id = $1', [d.pegawaiA]);

    for (const jalur of ['/api/auth/change-password', '/api/auth/me']) {
      lupakanSemua();
      const k = palsu(tokenUntuk(d.pegawaiA, 'staff'), { jalur });
      await authenticate(k.req, k.res, k.next);
      assert.equal(k.lanjutKah(), true, `${jalur} harus tetap terbuka`);
    }

    await bersihkanTanda(d.pegawaiA);
  });

  await t.test('tanda itu tidak menghalangi jalur yang mirip tapi berbeda', async () => {
    // Kalau pencocokannya memakai "diawali dengan", alamat seperti
    // /api/auth/me-something ikut lolos. Daftar izin harus cocok persis.
    await p.query('UPDATE users SET harus_ganti_sandi = TRUE WHERE id = $1', [d.pegawaiA]);
    const k = palsu(tokenUntuk(d.pegawaiA, 'staff'), { jalur: '/api/auth/mendaftar' });
    await authenticate(k.req, k.res, k.next);
    assert.equal(k.res.kode, 403);
    await bersihkanTanda(d.pegawaiA);
  });

  await t.test('parameter kueri tidak bisa dipakai menyiasati daftar izin', async () => {
    await p.query('UPDATE users SET harus_ganti_sandi = TRUE WHERE id = $1', [d.pegawaiA]);
    const k = palsu(tokenUntuk(d.pegawaiA, 'staff'), { jalur: '/api/auth/me?x=1' });
    await authenticate(k.req, k.res, k.next);
    assert.equal(k.lanjutKah(), true, 'kueri harus diabaikan saat mencocokkan jalur');
    await bersihkanTanda(d.pegawaiA);
  });

  await t.test('reset oleh admin MENANDAI sandi itu sebagai sementara', async () => {
    const k = {
      req: { params: { id: d.pegawaiB }, body: { newPassword: 'Merpati#88' }, user: { id: d.admin, role: 'admin' } },
      res: { status(c) { this.kode = c; return this; }, json(b) { this.badan = b; return this; } },
    };
    await resetPassword(k.req, k.res, (e) => { throw e; });

    const baris = await p.query('SELECT harus_ganti_sandi FROM users WHERE id = $1', [d.pegawaiB]);
    assert.equal(baris.rows[0].harus_ganti_sandi, true);

    await bersihkanTanda(d.pegawaiB);
  });

  await t.test('mengganti sandi sendiri MELEPAS tanda itu', async () => {
    const lama = 'Merpati#88';
    await p.query('UPDATE users SET password_hash = $1, harus_ganti_sandi = TRUE WHERE id = $2',
      [await bcrypt.hash(lama, 10), d.pegawaiA]);
    lupakanSemua();

    const k = {
      req: {
        user: { id: d.pegawaiA, name: 'Uji', email: 'uji@uji.local', role: 'staff' },
        body: { oldPassword: lama, newPassword: 'Kunang2Malam' },
      },
      res: { status(c) { this.kode = c; return this; }, json(b) { this.badan = b; return this; } },
    };
    await changePassword(k.req, k.res, (e) => { throw e; });

    const baris = await p.query('SELECT harus_ganti_sandi FROM users WHERE id = $1', [d.pegawaiA]);
    assert.equal(baris.rows[0].harus_ganti_sandi, false);
    assert.ok(k.res.badan.token, 'token baru dikirim supaya perangkat ini tidak ikut keluar');

    await bersihkanTanda(d.pegawaiA);
  });

  // --- 2. Sesi diputus ---

  await t.test('TOKEN LAMA DITOLAK setelah sandi diganti', async () => {
    // Inti perbaikannya. Token ini dibuat sebelum garis waktunya, persis
    // seperti token yang dipegang orang lain di perangkat lain.
    const tokenLama = jwt.sign(
      { id: d.pegawaiA, role: 'staff', iat: Math.floor(Date.now() / 1000) - 3600 },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    );

    const sebelum = palsu(tokenLama);
    await authenticate(sebelum.req, sebelum.res, sebelum.next);
    assert.equal(sebelum.lanjutKah(), true, 'sebelum diputus, token ini sah');

    await p.query(
      `UPDATE users SET sesi_sejak_epoch = FLOOR(EXTRACT(EPOCH FROM NOW()))::bigint WHERE id = $1`,
      [d.pegawaiA]
    );
    lupakanSemua();

    const sesudah = palsu(tokenLama);
    await authenticate(sesudah.req, sesudah.res, sesudah.next);
    assert.equal(sesudah.lanjutKah(), false, 'token lama harus ditolak');
    assert.equal(sesudah.res.kode, 401);
    assert.match(sesudah.res.badan.message, /sesi/i);

    await bersihkanTanda(d.pegawaiA);
  });

  await t.test('token yang terbit SESUDAH pemutusan tetap diterima', async () => {
    await p.query(
      `UPDATE users SET sesi_sejak_epoch = FLOOR(EXTRACT(EPOCH FROM NOW()))::bigint WHERE id = $1`,
      [d.pegawaiA]
    );
    lupakanSemua();

    const k = palsu(tokenUntuk(d.pegawaiA, 'staff'));
    await authenticate(k.req, k.res, k.next);
    assert.equal(k.lanjutKah(), true,
      'token baru tidak boleh tertolak oleh garis waktu yang dibuat pada detik yang sama');

    await bersihkanTanda(d.pegawaiA);
  });

  await t.test('akun yang tidak pernah memutus sesi tidak terpengaruh sama sekali', async () => {
    // Kolomnya NULL untuk seluruh akun yang sudah ada saat migrasi
    // dipasang. Kalau NULL diperlakukan sebagai "nol", setiap orang
    // langsung terkunci begitu migrasi dijalankan.
    await p.query('UPDATE users SET sesi_sejak_epoch = NULL WHERE id = $1', [d.pegawaiB]);
    lupakanSemua();

    const k = palsu(tokenUntuk(d.pegawaiB, 'staff'));
    await authenticate(k.req, k.res, k.next);
    assert.equal(k.lanjutKah(), true);
  });

  await t.test('reset oleh admin ikut memutus sesi yang sedang berjalan', async () => {
    // Alasan admin mereset sandi seringkali justru karena akunnya diduga
    // dipakai orang lain. Reset tanpa memutus sesi membiarkan orang itu
    // tetap masuk memakai token lamanya.
    const tokenLama = jwt.sign(
      { id: d.pegawaiB, role: 'staff', iat: Math.floor(Date.now() / 1000) - 3600 },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    );

    const k = {
      req: { params: { id: d.pegawaiB }, body: { newPassword: 'Kunang2Malam' }, user: { id: d.admin, role: 'admin' } },
      res: { status(c) { this.kode = c; return this; }, json(b) { this.badan = b; return this; } },
    };
    await resetPassword(k.req, k.res, (e) => { throw e; });
    lupakanSemua();

    const cek = palsu(tokenLama);
    await authenticate(cek.req, cek.res, cek.next);
    assert.equal(cek.lanjutKah(), false, 'token lama harus mati setelah admin mereset');

    await bersihkanTanda(d.pegawaiB);
  });

  await t.test('memutus sesi TIDAK mengeluarkan perangkat yang menekannya', async () => {
    const k = {
      req: { user: { id: d.pegawaiA, name: 'Uji', email: 'uji@uji.local', role: 'staff' }, kode: 'ujixx' },
      res: { status(c) { this.kode = c; return this; }, json(b) { this.badan = b; return this; } },
    };
    await keluarSemua(k.req, k.res, (e) => { throw e; });
    lupakanSemua();

    assert.ok(k.res.badan.token, 'harus mengirim token pengganti');

    // Tombol keamanan yang mengeluarkan penekannya sendiri membuat orang
    // ragu menekannya -- dan tombol yang orang ragu menekannya sama saja
    // dengan tidak ada.
    const lanjutan = palsu(k.res.badan.token);
    await authenticate(lanjutan.req, lanjutan.res, lanjutan.next);
    assert.equal(lanjutan.lanjutKah(), true, 'perangkat ini harus tetap masuk');

    await bersihkanTanda(d.pegawaiA);
  });

  await t.test('sesi yang diputus tidak mengubah keadaan akun lain', async () => {
    await p.query(
      `UPDATE users SET sesi_sejak_epoch = FLOOR(EXTRACT(EPOCH FROM NOW()))::bigint WHERE id = $1`,
      [d.pegawaiA]
    );
    lupakanSemua();

    const tokenLamaB = jwt.sign(
      { id: d.pegawaiB, role: 'staff', iat: Math.floor(Date.now() / 1000) - 3600 },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    );
    const k = palsu(tokenLamaB);
    await authenticate(k.req, k.res, k.next);
    assert.equal(k.lanjutKah(), true, 'akun lain tidak boleh ikut terputus');

    await bersihkanTanda(d.pegawaiA);
  });
});
