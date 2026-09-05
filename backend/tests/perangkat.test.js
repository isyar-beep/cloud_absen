const test = require('node:test');
const assert = require('node:assert/strict');
const { adaBasisData, siapkan, bersihkan, tutup, ambilPool } = require('./bantuan/basisData');

// ============================================================
// Token push per perangkat, dan pengenalan perangkat.
//
// Dua hal yang dijaga di sini, dan keduanya pernah gagal tanpa gejala:
//
// 1. Pemberitahuan harus sampai ke SELURUH perangkat pemiliknya. Dulu
//    tokennya satu kolom per pengguna, jadi perangkat yang login terakhir
//    menimpa yang sebelumnya -- pegawai dengan dua perangkat diam-diam
//    berhenti menerima di salah satunya, dan siapa pun yang login memakai
//    akun orang lain mengalihkan seluruh pemberitahuannya ke sana.
//
// 2. Peringatan "perangkat baru" tidak boleh menyala pada login PERTAMA
//    sebuah akun. Peringatan yang muncul saat tidak ada apa-apa melatih
//    orang mengabaikannya, dan yang sungguhan ikut terlewat.
// ============================================================

test('token push per perangkat', async (t) => {
  if (!(await adaBasisData())) {
    t.skip('PostgreSQL tidak tersedia atau skemanya belum dimigrasi');
    return;
  }

  const d = await siapkan('perangkat');
  const p = ambilPool();
  const P = require('../src/utils/perangkat');
  t.after(async () => { await bersihkan(); await tutup(); });

  const bersihkanToken = () =>
    p.query('DELETE FROM push_tokens WHERE user_id = ANY($1::int[])', [[d.pegawaiA, d.pegawaiB]]);

  await t.test('satu pegawai bisa punya beberapa perangkat sekaligus', async () => {
    await bersihkanToken();
    await P.daftarkanToken({ userId: d.pegawaiA, token: 'TOK-HP', merek: 'samsung', model: 'Galaxy S21' });
    await P.daftarkanToken({ userId: d.pegawaiA, token: 'TOK-TABLET', merek: 'samsung', model: 'Tab A8' });

    const token = await P.tokenPengguna([d.pegawaiA]);
    assert.equal(token.length, 2, 'perangkat kedua tidak boleh menimpa yang pertama');
  });

  await t.test('mendaftar ulang token yang sama tidak menggandakan', async () => {
    await bersihkanToken();
    await P.daftarkanToken({ userId: d.pegawaiA, token: 'TOK-HP', merek: 'samsung' });
    await P.daftarkanToken({ userId: d.pegawaiA, token: 'TOK-HP', merek: 'samsung' });

    assert.equal((await P.tokenPengguna([d.pegawaiA])).length, 1);
  });

  await t.test('token BERPINDAH pemilik saat HP-nya dipakai akun lain', async () => {
    // Satu token Expo menunjuk satu pemasangan aplikasi pada satu HP.
    // Kalau tercatat dua kali, pemberitahuan milik dua orang berbeda
    // sama-sama terkirim ke HP yang sama -- dan masing-masing membaca
    // yang bukan haknya.
    await bersihkanToken();
    await P.daftarkanToken({ userId: d.pegawaiA, token: 'TOK-PINJAM' });
    await P.daftarkanToken({ userId: d.pegawaiB, token: 'TOK-PINJAM' });

    assert.equal((await P.tokenPengguna([d.pegawaiA])).length, 0, 'pemilik lama harus lepas');
    assert.equal((await P.tokenPengguna([d.pegawaiB])).length, 1, 'pemilik baru menerima');
  });

  await t.test('melepas satu perangkat tidak mematikan perangkat lain', async () => {
    await bersihkanToken();
    await P.daftarkanToken({ userId: d.pegawaiA, token: 'TOK-HP' });
    await P.daftarkanToken({ userId: d.pegawaiA, token: 'TOK-TABLET' });

    await P.lepaskanToken({ userId: d.pegawaiA, token: 'TOK-TABLET' });

    const sisa = await P.tokenPengguna([d.pegawaiA]);
    assert.equal(sisa.length, 1);
    assert.equal(sisa[0].token, 'TOK-HP');
  });

  await t.test('token orang lain tidak bisa dilepas walau tokennya diketahui', async () => {
    await bersihkanToken();
    await P.daftarkanToken({ userId: d.pegawaiA, token: 'TOK-HP' });

    await P.lepaskanToken({ userId: d.pegawaiB, token: 'TOK-HP' });

    assert.equal((await P.tokenPengguna([d.pegawaiA])).length, 1, 'tidak boleh terhapus');
  });

  await t.test('token yang ditolak layanan push dibuang', async () => {
    await bersihkanToken();
    await P.daftarkanToken({ userId: d.pegawaiA, token: 'TOK-MATI' });
    await P.daftarkanToken({ userId: d.pegawaiA, token: 'TOK-HIDUP' });

    assert.equal(await P.buangToken(['TOK-MATI']), 1);
    const sisa = await P.tokenPengguna([d.pegawaiA]);
    assert.deepEqual(sisa.map((r) => r.token), ['TOK-HIDUP']);
  });

  await t.test('jumlah perangkat dihitung per pegawai', async () => {
    await bersihkanToken();
    await P.daftarkanToken({ userId: d.pegawaiA, token: 'TOK-1' });
    await P.daftarkanToken({ userId: d.pegawaiA, token: 'TOK-2' });
    await P.daftarkanToken({ userId: d.pegawaiB, token: 'TOK-3' });

    const peta = await P.jumlahPerangkat();
    assert.equal(peta.get(d.pegawaiA), 2);
    assert.equal(peta.get(d.pegawaiB), 1);
  });

  await t.test('daftar kosong tidak menembak basis data', async () => {
    assert.deepEqual(await P.tokenPengguna([]), []);
    assert.deepEqual(await P.tokenPengguna(null), []);
    assert.equal(await P.buangToken([]), 0);
  });
});

test('pengenalan perangkat', async (t) => {
  if (!(await adaBasisData())) {
    t.skip('PostgreSQL tidak tersedia atau skemanya belum dimigrasi');
    return;
  }

  const d = await siapkan('kenalperangkat');
  const p = ambilPool();
  const P = require('../src/utils/perangkat');
  t.after(async () => { await bersihkan(); await tutup(); });

  const kosongkan = () =>
    p.query('DELETE FROM perangkat WHERE user_id = ANY($1::int[])', [[d.pegawaiA, d.pegawaiB]]);

  await t.test('login PERTAMA tidak dianggap perangkat baru yang perlu diperingatkan', async () => {
    // Perangkatnya memang belum dikenal, tapi memberi tahu saat itu hanya
    // melatih orang mengabaikan peringatan berikutnya.
    await kosongkan();
    const h = await P.catatPerangkat({ userId: d.pegawaiA, sidik: 'sidik-1', nama: 'Galaxy S21' });
    assert.equal(h.baru, true);
    assert.equal(h.pertamaKali, true, 'ini yang menahan peringatannya');
  });

  await t.test('perangkat yang sama tidak dianggap baru lagi', async () => {
    await kosongkan();
    await P.catatPerangkat({ userId: d.pegawaiA, sidik: 'sidik-1', nama: 'Galaxy S21' });
    const h = await P.catatPerangkat({ userId: d.pegawaiA, sidik: 'sidik-1', nama: 'Galaxy S21' });
    assert.equal(h.baru, false);
  });

  await t.test('PERANGKAT KEDUA memicu peringatan', async () => {
    // Inti fiturnya: akun sudah pernah dipakai dari suatu perangkat, lalu
    // muncul dari perangkat lain.
    await kosongkan();
    await P.catatPerangkat({ userId: d.pegawaiA, sidik: 'sidik-1', nama: 'Galaxy S21' });
    const h = await P.catatPerangkat({ userId: d.pegawaiA, sidik: 'sidik-2', nama: 'Redmi Note 12' });

    assert.equal(h.baru, true);
    assert.equal(h.pertamaKali, false);
    assert.equal(h.nama, 'Redmi Note 12', 'namanya dipakai menyusun kalimat peringatan');
  });

  await t.test('perangkat dikenal terpisah untuk tiap pengguna', async () => {
    // HP yang sama dipakai dua akun adalah dua hubungan berbeda, dan
    // masing-masing pemilik berhak diberi tahu.
    await kosongkan();
    await P.catatPerangkat({ userId: d.pegawaiA, sidik: 'sidik-bersama', nama: 'HP Pinjaman' });
    const h = await P.catatPerangkat({ userId: d.pegawaiB, sidik: 'sidik-bersama', nama: 'HP Pinjaman' });

    assert.equal(h.baru, true, 'bagi pegawai B ini perangkat yang belum dikenal');
  });

  await t.test('tanpa penanda dari klien, tidak ada yang dituduh', async () => {
    // Aplikasi versi lama belum mengirimkannya. Diam lebih baik daripada
    // menuduh setiap login sebagai perangkat baru.
    await kosongkan();
    const h = await P.catatPerangkat({ userId: d.pegawaiA, sidik: null, nama: 'apa pun' });
    assert.equal(h.baru, false);
    assert.equal(h.pertamaKali, false);
  });

  await t.test('penanda yang kepanjangan dipotong, bukan menggagalkan login', async () => {
    await kosongkan();
    const h = await P.catatPerangkat({
      userId: d.pegawaiA, sidik: 'x'.repeat(200), nama: 'y'.repeat(400),
    });
    assert.equal(h.baru, true);
  });
});
