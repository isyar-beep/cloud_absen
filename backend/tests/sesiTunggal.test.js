const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { adaBasisData, siapkan, bersihkan, tutup, ambilPool } = require('./bantuan/basisData');

// ============================================================
// Pegawai hanya satu sesi aktif.
//
// Keadaan yang hendak ditutup: sandi pegawai diketahui rekannya, lalu
// dipakai diam-diam dari HP lain. Tanpa pembatasan ini kedua sesi hidup
// berdampingan selama tujuh hari, dan pemilik akun tidak pernah
// merasakan apa pun.
//
// Yang diuji di sini bukan cuma "sesi lama mati". Tiga sisi lain sama
// pentingnya, dan ketiganya adalah cara fitur ini bisa berubah menjadi
// masalah yang lebih besar daripada yang diperbaikinya:
//
//   - token yang BARU SAJA diberikan tidak boleh ikut mati. Kalau itu
//     terjadi, pegawai berhasil login lalu ditolak di permintaan
//     berikutnya -- dan absensinya menentukan bayarannya;
//   - admin dan konsultan TIDAK ikut dibatasi. Merekalah yang justru
//     bekerja di dua layar sekaligus;
//   - akun lain tidak boleh ikut terputus.
// ============================================================

process.env.JWT_SECRET = process.env.JWT_SECRET || 'rahasia-uji';

const SANDI = 'Merpati#88';

function palsu({ jalur = '/api/attendance/today', token, body = {} } = {}) {
  const res = {
    status(k) { this.kode = k; return this; },
    json(b) { this.badan = b; return this; },
  };
  let lanjut = false;
  return {
    req: {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      originalUrl: jalur, method: 'POST', body, ip: '127.0.0.1',
    },
    res,
    next: (e) => { lanjut = true; if (e) throw e; },
    lanjutKah: () => lanjut,
  };
}

test('pegawai hanya satu sesi aktif', async (t) => {
  if (!(await adaBasisData())) {
    t.skip('PostgreSQL tidak tersedia atau skemanya belum dimigrasi');
    return;
  }

  const d = await siapkan('sesitunggal');
  const p = ambilPool();
  const { authenticate, lupakanSemua } = require('../src/middleware/auth');
  const { login } = require('../src/controllers/authController');
  t.after(async () => { await bersihkan(); await tutup(); });

  // Pengguna uji dibuat dengan password_hash 'x' yang bukan bcrypt.
  // Diisi sandi sungguhan supaya login benar-benar berjalan, bukan
  // dipalsukan.
  const hash = await bcrypt.hash(SANDI, 10);
  await p.query('UPDATE users SET password_hash = $1 WHERE id = ANY($2::int[])',
    [hash, [d.pegawaiA, d.pegawaiB, d.konsultanA, d.admin]]);

  const emailDari = async (id) => (
    await p.query('SELECT email FROM users WHERE id = $1', [id])
  ).rows[0].email;

  // Login sungguhan lewat controller-nya, lalu kembalikan tokennya.
  async function masuk(id) {
    const k = palsu({ jalur: '/api/auth/login', body: { email: await emailDari(id), password: SANDI } });
    await login(k.req, k.res, k.next);
    assert.ok(k.res.badan?.token, 'login harus berhasil');
    lupakanSemua();
    return k.res.badan.token;
  }

  // Apakah token masih diterima middleware.
  async function diterima(token) {
    lupakanSemua();
    const k = palsu({ token });
    await authenticate(k.req, k.res, k.next);
    return { ok: k.lanjutKah(), kode: k.res.kode, badan: k.res.badan };
  }

  const bersihkanSesi = (id) =>
    p.query('UPDATE users SET sesi_sejak_epoch = NULL, sesi_alasan = NULL WHERE id = $1', [id]);

  await t.test('LOGIN BARU MEMATIKAN SESI LAMA pegawai', async () => {
    await bersihkanSesi(d.pegawaiA);

    const hpLama = await masuk(d.pegawaiA);
    assert.equal((await diterima(hpLama)).ok, true, 'sesi pertama harus hidup');

    // Sesi kedua dibuat sedetik kemudian. Jarak ini disengaja: yang
    // ditolak hanya token yang LEBIH TUA dari garis pemutusan, jadi dua
    // login pada detik yang sama memang menyisakan keduanya hidup --
    // batas yang diketahui dan ditulis di authController.
    await new Promise((r) => setTimeout(r, 1100));
    const hpBaru = await masuk(d.pegawaiA);

    assert.equal((await diterima(hpBaru)).ok, true, 'sesi baru harus hidup');

    const lama = await diterima(hpLama);
    assert.equal(lama.ok, false, 'sesi lama harus mati');
    assert.equal(lama.kode, 401);
  });

  await t.test('pegawai yang dikeluarkan diberi tahu ALASANNYA', async () => {
    // Ini bukan soal kehalusan bahasa. Kalimat inilah satu-satunya hal
    // yang memberi tahu pegawai bahwa sandinya dipegang orang lain.
    // "Sesi Anda sudah diakhiri" hanya terbaca sebagai aplikasi rusak:
    // orangnya login kembali, tidak curiga apa pun, dan yang tadi masuk
    // tetap bebas masuk lagi besok.
    await bersihkanSesi(d.pegawaiA);
    const hpLama = await masuk(d.pegawaiA);
    await new Promise((r) => setTimeout(r, 1100));
    await masuk(d.pegawaiA);

    const lama = await diterima(hpLama);
    assert.equal(lama.badan.sesi_alasan, 'login_lain');
    assert.match(lama.badan.message, /perangkat lain/i);
    assert.match(lama.badan.message, /ganti password/i, 'harus menyebut apa yang perlu dilakukan');
  });

  await t.test('TOKEN YANG BARU DIBERIKAN tidak menendang dirinya sendiri', async () => {
    // Cacat sejenis pernah benar-benar terjadi lewat pembulatan
    // ::bigint, dan hanya muncul kalau jatuh pada pecahan detik yang
    // tepat -- lulus di satu jalan, gagal di jalan berikutnya. Karena
    // itu diulang beberapa kali, bukan sekali.
    for (let i = 0; i < 12; i += 1) {
      await bersihkanSesi(d.pegawaiA);
      const token = await masuk(d.pegawaiA);
      const hasil = await diterima(token);
      assert.equal(hasil.ok, true, `putaran ${i}: token sendiri ditolak (${hasil.badan?.message})`);
    }
  });

  await t.test('KONSULTAN tidak dibatasi, dua layar tetap hidup', async () => {
    await bersihkanSesi(d.konsultanA);

    const layar1 = await masuk(d.konsultanA);
    await new Promise((r) => setTimeout(r, 1100));
    const layar2 = await masuk(d.konsultanA);

    assert.equal((await diterima(layar1)).ok, true, 'layar lama konsultan harus tetap hidup');
    assert.equal((await diterima(layar2)).ok, true);
  });

  await t.test('ADMIN tidak dibatasi', async () => {
    await bersihkanSesi(d.admin);

    const layar1 = await masuk(d.admin);
    await new Promise((r) => setTimeout(r, 1100));
    await masuk(d.admin);

    assert.equal((await diterima(layar1)).ok, true);
  });

  await t.test('login pegawai LAIN tidak memutus sesi siapa pun', async () => {
    await bersihkanSesi(d.pegawaiA);
    await bersihkanSesi(d.pegawaiB);

    const tokenA = await masuk(d.pegawaiA);
    await new Promise((r) => setTimeout(r, 1100));
    await masuk(d.pegawaiB);

    assert.equal((await diterima(tokenA)).ok, true, 'sesi pegawai A tidak boleh ikut mati');
  });

  await t.test('garis pemutusan diambil dari iat token, bukan dari NOW()', async () => {
    // Kalau garisnya dari NOW(), nilainya bisa mendahului iat token yang
    // baru saja dibuat. Yang dijaga: keduanya sama persis.
    await bersihkanSesi(d.pegawaiA);
    const token = await masuk(d.pegawaiA);

    const { rows } = await p.query('SELECT sesi_sejak_epoch FROM users WHERE id = $1', [d.pegawaiA]);
    assert.equal(Number(rows[0].sesi_sejak_epoch), jwt.decode(token).iat);
  });

  await t.test('token yang terbit SEBELUM sesi dimulai tetap ditolak', async () => {
    await bersihkanSesi(d.pegawaiA);
    await masuk(d.pegawaiA);

    const tokenPurba = jwt.sign(
      { id: d.pegawaiA, role: 'staff', iat: Math.floor(Date.now() / 1000) - 86400 },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    );
    assert.equal((await diterima(tokenPurba)).ok, false);
  });
});
