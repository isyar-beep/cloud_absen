const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { adaBasisData, siapkan, bersihkan, tutup, ambilPool } = require('./bantuan/basisData');

// ============================================================
// Penjagaan permintaan masuk.
//
// Yang diuji di sini adalah lubang yang pernah ada: token berlaku 7 hari,
// dan dulu middleware hanya memverifikasi tanda tangannya. Akibatnya
// pegawai yang dipecat hari ini masih bisa bekerja seminggu penuh, dan
// admin yang diturunkan masih memegang kuasa admin.
//
// Tidak ada gejala yang menampakkan keduanya. Hanya pengujian yang bisa
// menjaganya tetap tertutup.
// ============================================================

process.env.JWT_SECRET = process.env.JWT_SECRET || 'rahasia-uji';

// Membangun req/res palsu secukupnya untuk memanggil middleware langsung.
// Lebih tepat daripada menembak lewat HTTP: yang diuji memang middleware
// itu sendiri, bukan perjalanan permintaannya.
function palsu(token) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = {
    status(k) { this.kode = k; return this; },
    json(b) { this.badan = b; return this; },
  };
  let lanjut = false;
  return { req, res, next: () => { lanjut = true; }, lanjutKah: () => lanjut };
}

const tokenUntuk = (id, peran) =>
  jwt.sign({ id, email: 'x@uji.local', role: peran }, process.env.JWT_SECRET, { expiresIn: '7d' });

test('penjagaan permintaan', async (t) => {
  if (!(await adaBasisData())) {
    t.skip('PostgreSQL tidak tersedia atau skemanya belum dimigrasi');
    return;
  }

  const d = await siapkan('auth');
  const p = ambilPool();
  const { authenticate, authorize, lupakanPengguna, lupakanSemua } = require('../src/middleware/auth');
  t.after(async () => { await bersihkan(); await tutup(); });
  t.beforeEach(() => lupakanSemua());

  await t.test('akun aktif diteruskan, dan datanya diambil dari basis data', async () => {
    const k = palsu(tokenUntuk(d.pegawaiA, 'staff'));
    await authenticate(k.req, k.res, k.next);
    assert.equal(k.lanjutKah(), true);
    assert.equal(k.req.user.id, d.pegawaiA);
    assert.equal(k.req.user.role, 'staff');
  });

  await t.test('tanpa token ditolak', async () => {
    const k = palsu(null);
    await authenticate(k.req, k.res, k.next);
    assert.equal(k.lanjutKah(), false);
    assert.equal(k.res.kode, 401);
  });

  await t.test('token yang tanda tangannya palsu ditolak', async () => {
    const palsuToken = jwt.sign({ id: d.pegawaiA, role: 'admin' }, 'kunci-yang-salah');
    const k = palsu(palsuToken);
    await authenticate(k.req, k.res, k.next);
    assert.equal(k.lanjutKah(), false);
    assert.equal(k.res.kode, 401);
  });

  await t.test('token kedaluwarsa ditolak', async () => {
    const kadaluwarsa = jwt.sign(
      { id: d.pegawaiA, role: 'staff' }, process.env.JWT_SECRET, { expiresIn: '-1s' }
    );
    const k = palsu(kadaluwarsa);
    await authenticate(k.req, k.res, k.next);
    assert.equal(k.res.kode, 401);
  });

  // --- Inti persoalannya ---

  await t.test('AKUN YANG DINONAKTIFKAN langsung ditolak walau tokennya masih berlaku', async () => {
    const token = tokenUntuk(d.pegawaiA, 'staff');

    // Masih aktif: lolos.
    const sebelum = palsu(token);
    await authenticate(sebelum.req, sebelum.res, sebelum.next);
    assert.equal(sebelum.lanjutKah(), true);

    // Dinonaktifkan, lalu ingatannya dibatalkan seperti yang dilakukan
    // controller. Tokennya TIDAK diganti -- persis keadaan pegawai yang
    // baru dipecat sementara aplikasinya masih terbuka di HP-nya.
    await p.query('UPDATE users SET is_active = FALSE WHERE id = $1', [d.pegawaiA]);
    lupakanPengguna(d.pegawaiA);

    const sesudah = palsu(token);
    await authenticate(sesudah.req, sesudah.res, sesudah.next);
    assert.equal(sesudah.lanjutKah(), false, 'harus ditolak');
    assert.equal(sesudah.res.kode, 401);
    assert.match(sesudah.res.badan.message, /dinonaktifkan/i);

    await p.query('UPDATE users SET is_active = TRUE WHERE id = $1', [d.pegawaiA]);
    lupakanPengguna(d.pegawaiA);
  });

  await t.test('akun yang dihapus ditolak, tidak melempar galat', async () => {
    const k = palsu(tokenUntuk(999999999, 'admin'));
    await authenticate(k.req, k.res, k.next);
    assert.equal(k.lanjutKah(), false);
    assert.equal(k.res.kode, 401);
  });

  await t.test('PERAN diambil dari basis data, bukan dari token', async () => {
    // Token menyebut 'admin', basis data menyebut 'staff'. Yang menang
    // harus basis data -- kalau tidak, admin yang diturunkan tetap
    // memegang kuasanya sampai tokennya kedaluwarsa.
    const tokenBohong = tokenUntuk(d.pegawaiA, 'admin');
    const k = palsu(tokenBohong);
    await authenticate(k.req, k.res, k.next);
    assert.equal(k.lanjutKah(), true);
    assert.equal(k.req.user.role, 'staff', 'peran harus yang dari basis data');
  });

  await t.test('kenaikan peran berlaku tanpa login ulang', async () => {
    const token = tokenUntuk(d.pegawaiA, 'staff');
    await p.query("UPDATE users SET role = 'konsultan' WHERE id = $1", [d.pegawaiA]);
    lupakanPengguna(d.pegawaiA);

    const k = palsu(token);
    await authenticate(k.req, k.res, k.next);
    assert.equal(k.req.user.role, 'konsultan');

    await p.query("UPDATE users SET role = 'staff' WHERE id = $1", [d.pegawaiA]);
    lupakanPengguna(d.pegawaiA);
  });

  await t.test('authorize memakai peran terbaru, bukan peran di token', async () => {
    const tokenBohong = tokenUntuk(d.pegawaiA, 'admin');
    const k = palsu(tokenBohong);
    await authenticate(k.req, k.res, k.next);

    const j = palsu(null);
    j.req = k.req;
    authorize('admin')(j.req, j.res, j.next);
    assert.equal(j.lanjutKah(), false, 'pegawai tidak boleh lolos penjaga admin');
    assert.equal(j.res.kode, 403);
  });

  await t.test('ingatan menahan kueri berulang, tapi tidak menahan pembatalan', async () => {
    const token = tokenUntuk(d.pegawaiB, 'staff');

    const a = palsu(token);
    await authenticate(a.req, a.res, a.next);
    assert.equal(a.lanjutKah(), true);

    // Diubah TANPA membatalkan ingatan: keadaan lama masih terpakai.
    // Ini yang membuat ingatannya berguna -- dan juga kenapa pembatalan
    // tegas di controller itu wajib, bukan pilihan.
    await p.query('UPDATE users SET is_active = FALSE WHERE id = $1', [d.pegawaiB]);
    const b = palsu(token);
    await authenticate(b.req, b.res, b.next);
    assert.equal(b.lanjutKah(), true, 'masih memakai ingatan');

    // Setelah dibatalkan, penolakannya seketika.
    lupakanPengguna(d.pegawaiB);
    const c = palsu(token);
    await authenticate(c.req, c.res, c.next);
    assert.equal(c.lanjutKah(), false, 'setelah dibatalkan harus ditolak');
    assert.equal(c.res.kode, 401);

    await p.query('UPDATE users SET is_active = TRUE WHERE id = $1', [d.pegawaiB]);
    lupakanPengguna(d.pegawaiB);
  });
});
