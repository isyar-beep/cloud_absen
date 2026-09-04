const test = require('node:test');
const assert = require('node:assert/strict');
const { buatPenanda, penandaPermintaan } = require('../src/middleware/penanda');

// ============================================================
// Pencatatan dan penanda permintaan.
//
// Yang dijaga di sini bukan "apakah barisnya tercetak" -- itu mudah dan
// tidak pernah rusak. Yang dijaga adalah tiga hal yang diam-diam bisa
// hilang lagi dan tidak akan terlihat sampai ada yang menelepon:
//
// 1. Penandanya benar-benar sampai ke pengguna.
// 2. Barisnya sah sebagai JSON -- kalau tidak, tak ada satu pun perkakas
//    yang bisa menyaringnya, dan pencatatan terstruktur kehilangan
//    seluruh gunanya.
// 3. Isi badan permintaan TIDAK pernah ikut tercatat.
// ============================================================

function palsuReq(tambahan = {}) {
  const res = {
    header: {},
    setHeader(k, v) { this.header[k] = v; },
  };
  return { req: { method: 'POST', originalUrl: '/api/attendance', ...tambahan }, res };
}

// Menangkap apa yang ditulis ke stdout selama fungsi berjalan.
function tangkap(fn) {
  const asli = process.stdout.write;
  const baris = [];
  process.stdout.write = (s) => { baris.push(s); return true; };
  try { fn(); } finally { process.stdout.write = asli; }
  return baris.join('');
}

// Pencatat membaca NODE_ENV saat dimuat, jadi modulnya dimuat ulang
// dengan nilai yang dikehendaki.
function muatPencatat(env) {
  const asli = process.env.NODE_ENV;
  process.env.NODE_ENV = env;
  delete require.cache[require.resolve('../src/utils/catatan')];
  const m = require('../src/utils/catatan');
  process.env.NODE_ENV = asli;
  return m;
}

test('penanda permintaan', async (t) => {
  await t.test('penandanya pendek dan tanpa huruf yang mudah tertukar', () => {
    // Penanda ini dibacakan lewat telepon. 0/O dan 1/l/I akan salah
    // dengar, dan satu huruf salah berarti grep-nya tidak ketemu --
    // sama saja dengan tidak punya penanda sama sekali.
    for (let i = 0; i < 200; i += 1) {
      const p = buatPenanda();
      assert.equal(p.length, 6);
      assert.match(p, /^[abcdefghjkmnpqrstuvwxyz23456789]+$/);
    }
  });

  await t.test('penandanya tidak berulang dalam satu kumpulan besar', () => {
    const kumpulan = new Set();
    for (let i = 0; i < 5000; i += 1) kumpulan.add(buatPenanda());
    // Tabrakan sesekali tidak apa-apa secara matematis, tapi banyak
    // tabrakan berarti sumber acaknya rusak.
    assert.ok(kumpulan.size > 4990, `terlalu banyak yang kembar: ${kumpulan.size}`);
  });

  await t.test('penanda dipasang di req dan dikirim sebagai header', () => {
    const { req, res } = palsuReq();
    let lanjut = false;
    penandaPermintaan(req, res, () => { lanjut = true; });
    assert.equal(lanjut, true);
    assert.equal(typeof req.kode, 'string');
    assert.equal(res.header['X-Kode-Permintaan'], req.kode);
    assert.equal(typeof req.mulai, 'number');
  });
});

test('bentuk catatan', async (t) => {
  await t.test('di produksi satu kejadian = satu baris JSON yang sah', () => {
    const { catatan } = muatPencatat('production');
    const keluar = tangkap(() => catatan.galat('Permintaan gagal', {
      kode: 'a3fk9c', metode: 'POST', jalur: '/api/attendance', status: 500,
    }));

    const baris = keluar.trim().split('\n');
    assert.equal(baris.length, 1, 'satu kejadian tidak boleh pecah jadi beberapa baris');

    // Kalau ini gagal, tak satu pun perkakas bisa menyaring catatannya.
    const d = JSON.parse(baris[0]);
    assert.equal(d.taraf, 'galat');
    assert.equal(d.kode, 'a3fk9c');
    assert.equal(d.status, 500);
    assert.equal(d.jalur, '/api/attendance');
  });

  await t.test('tumpukan galat berbaris banyak tetap muat dalam satu baris', () => {
    // Tumpukan galat memuat baris baru. Kalau tidak lolos JSON.stringify
    // dengan benar, satu galat pecah jadi 20 baris dan seluruh
    // penyaringan berantakan justru pada kejadian yang paling penting.
    const { catatan, dariGalat } = muatPencatat('production');
    const err = new Error('kolom tidak ditemukan');
    const keluar = tangkap(() => catatan.galat('Permintaan gagal', dariGalat(err)));
    assert.equal(keluar.trim().split('\n').length, 1);
    assert.ok(JSON.parse(keluar).tumpukan.includes('kolom tidak ditemukan'));
  });

  await t.test('waktunya waktu setempat, bukan UTC', () => {
    // Yang membaca catatan ini menyamakannya dengan jam dinding kantor
    // dan jam absensi pegawai. Catatan ber-UTC memaksa setiap pembacaan
    // dihitung mundur delapan jam, dan cepat atau lambat ada yang lupa.
    const { waktuSetempat } = muatPencatat('production');
    const w = waktuSetempat(new Date('2026-09-04T22:56:52Z'));
    assert.equal(w, '2026-09-05T06:56:52', 'UTC 22:56 = WITA 06:56 keesokan harinya');
  });

  await t.test('bidang kosong dibuang', () => {
    const { catatan } = muatPencatat('production');
    const keluar = tangkap(() => catatan.info('uji', { kode: 'abc123', pengguna: undefined, peran: null }));
    const d = JSON.parse(keluar);
    assert.ok(!('pengguna' in d));
    assert.ok(!('peran' in d));
  });

  await t.test('kode galat PostgreSQL ikut tercatat', () => {
    // Justru bidang inilah yang paling cepat menunjuk penyebabnya --
    // 23505 duplikat, 23503 kunci asing.
    const { catatan, dariGalat } = muatPencatat('production');
    const err = Object.assign(new Error('duplicate key'), {
      code: '23505', table: 'users', constraint: 'users_email_key',
    });
    const d = JSON.parse(tangkap(() => catatan.galat('gagal', dariGalat(err, { tumpukan: false }))));
    assert.equal(d.kode_pg, '23505');
    assert.equal(d.tabel, 'users');
    assert.equal(d.batasan, 'users_email_key');
    assert.ok(!('tumpukan' in d));
  });

  await t.test('saat mengembangkan bentuknya terbaca, bukan JSON', () => {
    const { catatan } = muatPencatat('development');
    const keluar = tangkap(() => catatan.galat('Permintaan gagal', { kode: 'a3fk9c' }));
    assert.ok(keluar.includes('[galat]'));
    assert.ok(keluar.includes('Permintaan gagal'));
  });
});
