const test = require('node:test');
const assert = require('node:assert/strict');
const { isiSesuaiJenis } = require('../src/utils/jenisBerkas');
const periksaBerkas = require('../src/middleware/periksaBerkas');

// ============================================================
// Tiga penjagaan yang dulu hanya berupa instruksi di dokumen, bukan
// sesuatu yang ditegakkan kode.
//
// Yang diuji di sini yang ketiga: jenis berkas diperiksa dari ISINYA.
// multer menyaring memakai file.mimetype, dan nilai itu ditulis KLIEN --
// siapa pun yang menyusun permintaannya sendiri bisa menuliskan
// "application/pdf" pada berkas apa saja.
//
// Untuk foto, sharp memproses ulang gambarnya sehingga yang palsu gagal
// di situ. Lampiran pengajuan TIDAK diproses ulang: ia disimpan apa
// adanya, jadi sebelum ini tidak ada yang memeriksanya sama sekali.
// ============================================================

// Beberapa bita pertama berkas yang sungguhan.
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'), Buffer.from([0x20, 0x00, 0x00, 0x00]), Buffer.from('WEBP', 'ascii'),
]);

test('jenis berkas diperiksa dari isinya', async (t) => {
  await t.test('berkas yang sungguhan diterima', () => {
    assert.equal(isiSesuaiJenis(PDF, 'application/pdf'), true);
    assert.equal(isiSesuaiJenis(JPEG, 'image/jpeg'), true);
    assert.equal(isiSesuaiJenis(PNG, 'image/png'), true);
    assert.equal(isiSesuaiJenis(WEBP, 'image/webp'), true);
  });

  await t.test('BERKAS LAIN YANG MENGAKU PDF ditolak', () => {
    // Inti persoalannya. Sebelum ini, berkas apa pun yang header
    // Content-Type-nya ditulis "application/pdf" tersimpan apa adanya.
    const bukanPdf = Buffer.from('MZ\x90\x00 ini program windows', 'binary');
    assert.equal(isiSesuaiJenis(bukanPdf, 'application/pdf'), false);

    const teksBiasa = Buffer.from('halo, ini cuma teks', 'utf8');
    assert.equal(isiSesuaiJenis(teksBiasa, 'application/pdf'), false);
  });

  await t.test('gambar yang mengaku jenis gambar LAIN ditolak', () => {
    // JPEG yang mengaku PNG tetap gambar, tapi jenis yang salah membuat
    // pemrosesan berikutnya menebak-nebak. Lebih baik ditolak terang.
    assert.equal(isiSesuaiJenis(JPEG, 'image/png'), false);
    assert.equal(isiSesuaiJenis(PNG, 'image/jpeg'), false);
  });

  await t.test('WAV dan AVI tidak lolos sebagai WebP', () => {
    // Keduanya sama-sama diawali "RIFF". Tanpa pemeriksaan kedua pada
    // bita 8-11, berkas suara dan video ikut diterima sebagai gambar.
    const wav = Buffer.concat([
      Buffer.from('RIFF', 'ascii'), Buffer.from([0x20, 0, 0, 0]), Buffer.from('WAVE', 'ascii'),
    ]);
    assert.equal(isiSesuaiJenis(wav, 'image/webp'), false);
  });

  await t.test('jenis yang tidak dikenal ditolak, bukan diloloskan', () => {
    // Bawaan yang aman: yang tidak dikenali tidak diterima. Kalau
    // sebaliknya, menambah jenis baru di multer tanpa menambahkannya di
    // sini akan diam-diam melewati seluruh pemeriksaan.
    assert.equal(isiSesuaiJenis(PDF, 'application/zip'), false);
    assert.equal(isiSesuaiJenis(PDF, 'text/html'), false);
  });

  await t.test('berkas kosong atau bukan buffer ditolak tanpa melempar galat', () => {
    assert.equal(isiSesuaiJenis(Buffer.alloc(0), 'application/pdf'), false);
    assert.equal(isiSesuaiJenis(null, 'application/pdf'), false);
    assert.equal(isiSesuaiJenis('%PDF', 'application/pdf'), false);
  });

  await t.test('berkas yang lebih pendek dari tanda tangannya ditolak', () => {
    assert.equal(isiSesuaiJenis(Buffer.from([0x25, 0x50]), 'application/pdf'), false);
  });
});

test('middleware pemeriksa berkas', async (t) => {
  function palsu(file) {
    const res = {
      status(k) { this.kode = k; return this; },
      json(b) { this.badan = b; return this; },
    };
    let lanjut = false;
    return { req: { file, kode: 'ujixx' }, res, next: () => { lanjut = true; }, lanjutKah: () => lanjut };
  }

  await t.test('permintaan tanpa unggahan diteruskan', () => {
    // Lampiran pengajuan memang opsional. Menolak yang tanpa berkas
    // akan mematikan seluruh pengajuan yang tidak melampirkan apa pun.
    const k = palsu(undefined);
    periksaBerkas(k.req, k.res, k.next);
    assert.equal(k.lanjutKah(), true);
  });

  await t.test('berkas sungguhan diteruskan', () => {
    const k = palsu({ buffer: PDF, mimetype: 'application/pdf', size: PDF.length });
    periksaBerkas(k.req, k.res, k.next);
    assert.equal(k.lanjutKah(), true);
  });

  await t.test('berkas palsu ditolak 400, tidak sampai ke controller', () => {
    const k = palsu({
      buffer: Buffer.from('bukan pdf sama sekali'), mimetype: 'application/pdf', size: 21,
    });
    periksaBerkas(k.req, k.res, k.next);

    assert.equal(k.lanjutKah(), false, 'tidak boleh diteruskan');
    assert.equal(k.res.kode, 400);
    // Pesannya tidak menuduh: yang paling sering terjadi memang berkas
    // rusak atau ekstensi yang diganti tangan, bukan serangan.
    assert.match(k.res.badan.message, /tidak sesuai/i);
  });
});
