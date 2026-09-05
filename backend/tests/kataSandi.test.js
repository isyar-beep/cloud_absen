const test = require('node:test');
const assert = require('node:assert/strict');
const { periksaKataSandi, PANJANG_MINIMAL } = require('../src/utils/kataSandi');

// ============================================================
// Kekuatan kata sandi.
//
// Dua sisi yang sama pentingnya diuji di sini. Yang jelas: sandi lemah
// harus ditolak. Yang mudah terlupakan: sandi WAJAR harus lolos. Aturan
// yang terlalu galak tidak membuat sistem lebih aman -- ia membuat orang
// menulis sandinya di kertas, dan itu keadaan yang lebih buruk daripada
// sebelum aturannya ada.
// ============================================================

const lolos = (s, pemilik) => assert.equal(periksaKataSandi(s, pemilik), null, `harusnya lolos: ${s}`);
const ditolak = (s, pemilik) => assert.ok(periksaKataSandi(s, pemilik), `harusnya ditolak: ${s}`);

test('pemeriksaan kata sandi', async (t) => {
  await t.test('minimal delapan karakter', () => {
    assert.equal(PANJANG_MINIMAL, 8);
    ditolak('Kj7#a');
    ditolak('Kj7#am2');       // tujuh, kurang satu
    lolos('Kj7#am2p');        // delapan
  });

  await t.test('kosong dan bukan teks ditolak tanpa melempar galat', () => {
    ditolak('');
    ditolak(undefined);
    ditolak(null);
    ditolak(12345678);
  });

  await t.test('sandi yang paling sering dicoba ditolak', () => {
    for (const s of ['12345678', 'password', 'password123', 'qwerty123', 'admin123', 'iloveyou']) {
      ditolak(s);
    }
  });

  await t.test('huruf besar tidak menyelamatkan sandi umum', () => {
    // "Password1" hanya menyiasati aturan komposisi, bukan menyulitkan
    // penebak -- daftar tebakan mereka sudah memuat variannya.
    ditolak('Password1');
    ditolak('PASSWORD');
    ditolak('QwErTy123');
  });

  await t.test('deret berurutan ditolak, naik maupun turun', () => {
    ditolak('abcdefgh');
    ditolak('87654321');
    ditolak('hgfedcba');
  });

  await t.test('deret di DALAM sandi tidak ikut ditolak', () => {
    // Kalau potongan deret pun ditolak, kalimat sandi yang justru kuat
    // ikut terbuang. Yang ditahan hanya sandi yang seluruhnya deret.
    lolos('kucing1234hitam');
  });

  await t.test('satu karakter berulang ditolak', () => {
    ditolak('aaaaaaaa');
    ditolak('88888888');
  });

  await t.test('semua angka ditolak', () => {
    // Tanggal lahir, NIP, nomor HP -- semuanya ada di berkas kepegawaian
    // yang justru dipegang orang yang sama.
    ditolak('19870412');
    ditolak('081234567890');
  });

  await t.test('spasi di ujung ditolak, spasi di tengah tidak', () => {
    // Spasi di ujung hampir selalu sisa salin-tempel dan tak akan pernah
    // bisa diketik ulang dengan tepat. Spasi di tengah adalah kalimat
    // sandi, dan itu justru bentuk yang kuat.
    ditolak(' rahasiaku9');
    ditolak('rahasiaku9 ');
    lolos('kopi pagi di kantor');
  });

  await t.test('lebih dari 72 bita ditolak terang-terangan', () => {
    // bcrypt diam-diam memotong di bita ke-72. Meloloskannya berarti
    // pengguna mengira sandi panjangnya terpakai seluruhnya.
    lolos('Zx9' + 'q'.repeat(69));            // tepat 72
    ditolak('Zx9' + 'q'.repeat(70));          // 73
  });

  // --- Yang bisa ditebak dari data orangnya sendiri ---

  await t.test('sandi tidak boleh memuat nama pemiliknya', () => {
    ditolak('budisantoso1', { nama: 'Budi Santoso' });
    ditolak('xxBudiSantosoxx', { nama: 'Budi Santoso' });
  });

  await t.test('pencocokan nama mengabaikan huruf besar dan tanda baca', () => {
    ditolak('Budi.Santoso99', { nama: 'budi santoso' });
  });

  await t.test('sandi tidak boleh memuat bagian lokal email', () => {
    ditolak('andi.wijaya7', { email: 'andiwijaya@dinas.go.id' });
  });

  await t.test('nama yang sangat pendek tidak dipakai mencocokkan', () => {
    // Nama tiga huruf seperti "Ari" akan muncul kebetulan di sandi acak
    // mana pun. Menolaknya berarti menolak sandi yang sebenarnya kuat.
    lolos('mariposa77', { nama: 'Ari' });
  });

  // --- Sandi yang PERSIS alamat emailnya sendiri ---
  //
  // Ini keadaan yang benar-benar terjadi: orang yang diminta mengisi dua
  // kotak bersebelahan mengisi keduanya dengan hal yang sama. Dan yang
  // dihasilkannya adalah akun yang sandinya sudah tertulis di layar
  // Kelola Pengguna, terbaca siapa pun yang membuka halaman itu.
  //
  // Ambang ">= 4" pernah membuat pemilik nama pendek justru kehilangan
  // perlindungan ini. Uji di bawah menjaga agar ambang itu tidak lagi
  // ikut mematikan pemeriksaan kesamaan persis.

  await t.test('sandi sama persis dengan email ditolak walau nama pemiliknya pendek', () => {
    ditolak('adi@dinas.go.id', { nama: 'Adi', email: 'adi@dinas.go.id' });
    ditolak('eko@pu.go.id', { nama: 'Eko', email: 'eko@pu.go.id' });
    ditolak('tri@dinas.go.id', { nama: 'Tri', email: 'tri@dinas.go.id' });
  });

  await t.test('sandi sama persis dengan email ditolak untuk nama panjang juga', () => {
    ditolak('budi@dinas.go.id', { nama: 'Budi Santoso', email: 'budi@dinas.go.id' });
  });

  await t.test('kesamaan email tidak bisa disiasati huruf besar atau tanda baca', () => {
    ditolak('Adi@Dinas.Go.Id', { nama: 'Adi', email: 'adi@dinas.go.id' });
    ditolak('a.d.i@dinas.go.id', { nama: 'Adi', email: 'adi@dinas.go.id' });
  });

  await t.test('nama pendek tetap tidak menuduh sandi yang wajar', () => {
    // Sisi kedua, dan ini yang menjaga perbaikan di atas tidak berubah
    // jadi masalah baru: yang ditolak hanya kesamaan PERSIS. Nama pendek
    // yang kebetulan muncul di dalam sandi tetap harus lolos.
    lolos('tridarma2026aman', { nama: 'Tri', email: 'tri@pu.go.id' });
    lolos('Jalan7Kemerdekaan', { nama: 'Adi', email: 'adi@dinas.go.id' });
  });

  await t.test('nama orang lain tidak menghalangi', () => {
    lolos('budisantoso1', { nama: 'Andi Wijaya' });
  });

  // --- Sisi yang mudah terlupakan ---

  await t.test('sandi wajar tetap lolos', () => {
    for (const s of ['Merpati#88', 'jalanKakiPagi', 'k0pi-Susu-2026', 'Tender!Percipkar']) {
      lolos(s, { nama: 'Budi Santoso', email: 'budi@dinas.go.id' });
    }
  });
});
