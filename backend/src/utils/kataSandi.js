// ============================================================
// Pemeriksaan kekuatan kata sandi.
//
// Sebelumnya syaratnya hanya "minimal 6 karakter", dan itu meloloskan
// justru kata sandi yang paling sering ditebak lebih dulu: "123456",
// "abcdef", nama orangnya sendiri. Untuk sistem yang menentukan
// pembayaran orang, panjang saja bukan ukuran.
//
// Aturannya sengaja dibuat sedikit dan bisa dijelaskan. Syarat yang
// rumit -- wajib simbol, wajib huruf besar, ganti tiap 30 hari --
// terbukti mendorong orang menulis sandinya di kertas yang ditempel di
// meja, dan itu justru memperburuk keadaan. NIST sendiri sudah
// meninggalkan aturan komposisi seperti itu. Yang ditahan di sini hanya
// yang benar-benar berbahaya: terlalu pendek, terlalu umum, atau bisa
// ditebak dari data orangnya yang memang terpampang di layar.
//
// Pemeriksaan yang sama dipakai di tiga tempat -- admin membuat akun,
// admin mereset, dan pengguna mengganti sendiri. Ditaruh di satu berkas
// supaya ketiganya tidak bisa berbeda diam-diam.
// ============================================================

const PANJANG_MINIMAL = 8;

// Daftar pendek yang memang muncul di lapangan, bukan kamus jutaan kata.
// Kamus besar butuh berkas tambahan dan pemuatan ke memori, sementara
// yang benar-benar dicoba orang pertama kali hanya segelintir ini.
// Dibandingkan dalam huruf kecil, jadi "Password1" pun ikut tertahan.
const SANDI_UMUM = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000',
  'password', 'password1', 'password123', 'passw0rd', 'p@ssword',
  'qwerty123', 'qwertyui', 'asdfghjk', 'abcd1234', 'abcdefgh', '1qaz2wsx',
  'iloveyou', 'sunshine', 'princess', 'football', 'baseball', 'welcome1',
  // Yang khas dipakai di sini.
  'admin123', 'adminadmin', 'administrator', 'rahasia123', 'kataSandi',
  'absensi123', 'pegawai123', 'konsultan', 'indonesia', 'bismillah',
  'qwerty12345', 'sayangkamu', 'tidaktahu',
]);

// Deret naik/turun: "12345678", "abcdefgh", "87654321". Ditangkap dengan
// pola, bukan didaftar satu per satu, supaya varian sepanjang apa pun
// ikut tertahan. Yang ditolak hanya sandi yang SELURUHNYA deret --
// menolak potongan deret di dalamnya akan ikut membuang kalimat sandi
// panjang yang sebetulnya kuat.
function deretBerurutan(s) {
  let naik = 1;
  let turun = 1;
  for (let i = 1; i < s.length; i += 1) {
    const beda = s.charCodeAt(i) - s.charCodeAt(i - 1);
    naik = beda === 1 ? naik + 1 : 1;
    turun = beda === -1 ? turun + 1 : 1;
    if (naik >= s.length || turun >= s.length) return true;
  }
  return false;
}

function satuKarakterSaja(s) {
  return new Set(s).size === 1;
}

// Membuang yang bukan huruf/angka lalu menyamakan huruf besar-kecil,
// supaya "Budi.Santoso" dan "budisantoso" dianggap sama saat dicocokkan
// dengan nama pemiliknya.
function sederhanakan(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Memeriksa kata sandi baru.
 *
 * @param {string} sandi
 * @param {{nama?: string, email?: string}} [pemilik] data yang tampak di
 *   layar dan karena itu paling mudah ditebak orang lain.
 * @returns {string|null} pesan penolakan, atau null bila lolos.
 */
function periksaKataSandi(sandi, pemilik = {}) {
  if (typeof sandi !== 'string' || sandi.length === 0) {
    return 'Password wajib diisi.';
  }

  // Spasi di ujung hampir selalu tak disengaja -- hasil salin-tempel --
  // dan pemiliknya tidak akan pernah bisa mengetiknya lagi dengan tepat.
  if (sandi !== sandi.trim()) {
    return 'Password tidak boleh diawali atau diakhiri spasi.';
  }

  if (sandi.length < PANJANG_MINIMAL) {
    return `Password minimal ${PANJANG_MINIMAL} karakter.`;
  }

  // Batas atas bcrypt: byte ke-73 dan seterusnya diabaikan diam-diam.
  // Lebih baik ditolak terang-terangan daripada pengguna mengira sandi
  // panjangnya terpakai seluruhnya padahal tidak.
  if (Buffer.byteLength(sandi, 'utf8') > 72) {
    return 'Password terlalu panjang (maksimal 72 karakter).';
  }

  const kecil = sandi.toLowerCase();

  if (SANDI_UMUM.has(kecil)) {
    return 'Password ini terlalu umum dan mudah ditebak. Pakai yang lain.';
  }

  if (satuKarakterSaja(kecil)) {
    return 'Password tidak boleh satu karakter yang diulang-ulang.';
  }

  if (deretBerurutan(kecil)) {
    return 'Password tidak boleh deret berurutan seperti 12345678 atau abcdefgh.';
  }

  // Semua angka: ini yang paling sering dipilih -- tanggal lahir, NIP,
  // nomor HP -- dan semuanya ada di berkas kepegawaian.
  if (/^\d+$/.test(sandi)) {
    return 'Password tidak boleh hanya angka. Campur dengan huruf.';
  }

  const s = sederhanakan(sandi);
  const nama = sederhanakan(pemilik.nama);
  const emailLokal = sederhanakan(String(pemilik.email || '').split('@')[0]);

  // Nama dan email tertulis di layar Kelola Pengguna. Kalau sandinya
  // memuat salah satunya, orang yang bisa melihat daftar itu sudah
  // memegang separuh tebakannya.
  //
  // Pesannya menyebut "pemilik akun", bukan "Anda": pemeriksaan yang sama
  // dipakai saat admin membuatkan akun untuk ORANG LAIN, dan "nama Anda"
  // di layar itu akan membingungkan.
  if (nama.length >= 4 && (s.includes(nama) || nama.includes(s))) {
    return 'Password tidak boleh memuat nama pemilik akun.';
  }
  if (emailLokal.length >= 4 && (s.includes(emailLokal) || emailLokal.includes(s))) {
    return 'Password tidak boleh memuat alamat email pemilik akun.';
  }

  return null;
}

module.exports = { periksaKataSandi, PANJANG_MINIMAL };
