const test = require('node:test');
const assert = require('node:assert/strict');
const gembok = require('../src/utils/gemboklogin');

// ============================================================
// Gembok login per akun.
//
// Yang dijaga: satu akun yang emailnya diketahui umum -- admin dinas --
// ditebak pelan-pelan dari banyak alamat IP. Pembatasan per IP tidak
// akan pernah menyala pada serangan seperti itu, karena setiap IP tetap
// di bawah ambangnya.
//
// Sama pentingnya sisi sebaliknya: pegawai yang salah ketik beberapa
// kali di pagi hari tidak boleh kehilangan aksesnya ke pekerjaannya.
// ============================================================

const { BATAS_GAGAL } = gembok;

test('gembok login per akun', async (t) => {
  t.beforeEach(() => gembok.lupakanSemua());

  await t.test('akun yang belum pernah gagal tidak terkunci', () => {
    assert.equal(gembok.periksa('budi@dinas.go.id').terkunci, false);
  });

  await t.test('salah ketik beberapa kali masih dibiarkan masuk', () => {
    // Ambangnya harus jauh di atas kekeliruan yang wajar. Terkunci karena
    // tiga kali salah ketik akan membuat orang berhenti memakai sistemnya.
    for (let i = 0; i < BATAS_GAGAL - 1; i += 1) gembok.catatGagal('budi@dinas.go.id');
    assert.equal(gembok.periksa('budi@dinas.go.id').terkunci, false);
  });

  await t.test('terkunci setelah ambangnya terlampaui', () => {
    for (let i = 0; i < BATAS_GAGAL; i += 1) gembok.catatGagal('budi@dinas.go.id');
    const k = gembok.periksa('budi@dinas.go.id');
    assert.equal(k.terkunci, true);
    assert.ok(k.sisaDetik > 0);
  });

  await t.test('gembok menempel pada AKUN, bukan pada alamat IP', () => {
    // Inti persoalannya: fungsi ini tidak pernah melihat IP sama sekali.
    // Kegagalan dari mana pun asalnya menumpuk pada akun yang sama.
    for (let i = 0; i < BATAS_GAGAL; i += 1) gembok.catatGagal('admin@dinas.go.id');
    assert.equal(gembok.periksa('admin@dinas.go.id').terkunci, true);
  });

  await t.test('akun lain tidak ikut terkunci', () => {
    for (let i = 0; i < BATAS_GAGAL; i += 1) gembok.catatGagal('admin@dinas.go.id');
    assert.equal(gembok.periksa('budi@dinas.go.id').terkunci, false);
  });

  await t.test('email dicocokkan tanpa peduli huruf besar dan spasi', () => {
    // Kalau tidak, penebak cukup mengubah satu huruf jadi kapital untuk
    // mendapatkan hitungan yang bersih setiap kali.
    for (let i = 0; i < BATAS_GAGAL; i += 1) gembok.catatGagal('Admin@Dinas.go.id');
    assert.equal(gembok.periksa('  admin@dinas.go.id ').terkunci, true);
  });

  await t.test('login berhasil menghapus hitungannya', () => {
    for (let i = 0; i < BATAS_GAGAL - 1; i += 1) gembok.catatGagal('budi@dinas.go.id');
    gembok.catatBerhasil('budi@dinas.go.id');
    // Kalau hitungannya tidak dihapus, satu salah ketik esok hari sudah
    // cukup mengunci orang yang sebetulnya tahu sandinya.
    gembok.catatGagal('budi@dinas.go.id');
    assert.equal(gembok.periksa('budi@dinas.go.id').terkunci, false);
  });

  await t.test('reset oleh admin membuka gembok', () => {
    for (let i = 0; i < BATAS_GAGAL; i += 1) gembok.catatGagal('budi@dinas.go.id');
    assert.equal(gembok.periksa('budi@dinas.go.id').terkunci, true);
    gembok.lupakan('budi@dinas.go.id');
    assert.equal(gembok.periksa('budi@dinas.go.id').terkunci, false);
  });

  await t.test('kegagalan lama tidak dihitung lagi', () => {
    // Tanpa selang penghitungan, orang yang salah ketik sekali sebulan
    // akan terkunci setelah delapan bulan.
    const asli = Date.now;
    try {
      let waktu = 1_000_000;
      Date.now = () => waktu;

      for (let i = 0; i < BATAS_GAGAL - 1; i += 1) gembok.catatGagal('budi@dinas.go.id');
      waktu += gembok.SELANG_HITUNG + 1000;
      gembok.catatGagal('budi@dinas.go.id');

      assert.equal(gembok.periksa('budi@dinas.go.id').terkunci, false,
        'hitungannya harus mulai dari nol lagi');
    } finally {
      Date.now = asli;
    }
  });

  await t.test('gembok terbuka sendiri setelah waktunya habis', () => {
    // Mengunci selamanya berarti siapa pun yang tahu email seorang
    // pegawai bisa mengunci orang itu dari pekerjaannya kapan saja.
    const asli = Date.now;
    try {
      let waktu = 1_000_000;
      Date.now = () => waktu;

      for (let i = 0; i < BATAS_GAGAL; i += 1) gembok.catatGagal('budi@dinas.go.id');
      assert.equal(gembok.periksa('budi@dinas.go.id').terkunci, true);

      waktu += gembok.LAMA_GEMBOK + 1000;
      assert.equal(gembok.periksa('budi@dinas.go.id').terkunci, false);
    } finally {
      Date.now = asli;
    }
  });

  await t.test('sesudah gembok terbuka, kesempatannya penuh lagi', () => {
    const asli = Date.now;
    try {
      let waktu = 1_000_000;
      Date.now = () => waktu;

      for (let i = 0; i < BATAS_GAGAL; i += 1) gembok.catatGagal('budi@dinas.go.id');
      waktu += gembok.LAMA_GEMBOK + 1000;

      // Satu salah ketik sesudahnya tidak boleh langsung mengunci lagi.
      gembok.catatGagal('budi@dinas.go.id');
      assert.equal(gembok.periksa('budi@dinas.go.id').terkunci, false);
    } finally {
      Date.now = asli;
    }
  });

  await t.test('catatan yang sudah tidak berguna dibuang sendiri', () => {
    // Penebak bisa menembakkan ribuan email acak sekali masing-masing.
    // Tanpa pembersihan, tiap alamat itu menetap di memori selamanya --
    // pembatasan yang justru menjadi jalan menghabiskan memori server.
    const asli = Date.now;
    try {
      let waktu = 1_000_000;
      Date.now = () => waktu;

      for (let i = 0; i < 500; i += 1) gembok.catatGagal(`acak${i}@contoh.local`);
      assert.equal(gembok.jumlahCatatan(), 500);

      waktu += gembok.SELANG_HITUNG + gembok.LAMA_GEMBOK + 1000;

      // Satu kegagalan baru memicu penyapuan.
      gembok.catatGagal('pemicu@dinas.go.id');
      assert.equal(gembok.jumlahCatatan(), 1, 'hanya catatan yang baru yang tersisa');
    } finally {
      Date.now = asli;
    }
  });
});
