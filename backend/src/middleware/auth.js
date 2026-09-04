const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { catatan, dariGalat } = require('../utils/catatan');

// ============================================================
// Penjagaan permintaan masuk.
//
// Dulu berkas ini HANYA memverifikasi tanda tangan JWT, lalu memakai isi
// tokennya apa adanya. Dua akibatnya serius, dan keduanya tidak
// menampakkan gejala apa pun:
//
// 1. AKUN YANG DINONAKTIFKAN MASIH BISA BEKERJA. Token berlaku 7 hari.
//    Pegawai yang dipecat hari ini tetap bisa absen, mengajukan izin, dan
//    membaca datanya sampai tokennya kedaluwarsa. Menekan "Nonaktifkan"
//    di menu Pengguna hanya mencegah login BARU -- yang sudah memegang
//    token tidak terpengaruh sama sekali. Untuk sistem yang menentukan
//    pembayaran orang, itu lubang sungguhan.
//
// 2. PERAN DI TOKEN IKUT BASI. Pegawai yang dinaikkan jadi konsultan
//    tetap membawa peran lama sampai ia login ulang; sebaliknya, admin
//    yang diturunkan tetap memegang kuasa admin selama tokennya hidup.
//
// Keduanya berpangkal pada hal yang sama: token adalah potret keadaan
// saat login, dan potret itu tidak ikut berubah saat keadaannya berubah.
//
// Karena itu keadaan akun sekarang diambil dari BASIS DATA, bukan dari
// token. Token tinggal menjawab "siapa ini"; basis data yang menjawab
// "apakah dia masih boleh, dan sebagai apa".
//
// Supaya itu tidak berarti satu kueri tambahan pada setiap permintaan,
// hasilnya disimpan sebentar (lihat SELANG_INGAT). Dan supaya
// penonaktifan tetap berlaku SEKETIKA -- bukan setelah ingatan itu
// kedaluwarsa -- controller yang mengubah akun memanggil lupakanPengguna().
// Jadi cepatnya dari ingatan, benarnya dari pembatalan yang tegas.
// ============================================================

// Cukup pendek supaya perubahan yang lolos tanpa pembatalan tegas tetap
// menyusul dalam hitungan detik, dan cukup panjang supaya satu layar yang
// menembak beberapa endpoint sekaligus hanya sekali menyentuh basis data.
const SELANG_INGAT = 30_000;

const ingatan = new Map();

// Dipanggil setiap kali data akun berubah: dinonaktifkan, peran diganti,
// atau password di-reset. Tanpa ini, perubahannya baru berlaku setelah
// ingatannya kedaluwarsa -- dan untuk penonaktifan, jeda sekecil apa pun
// tetap salah.
function lupakanPengguna(userId) {
  ingatan.delete(Number(userId));
}

// Dipakai pengujian supaya satu berkas uji tidak mewarisi ingatan dari
// berkas sebelumnya.
function lupakanSemua() {
  ingatan.clear();
}

async function keadaanPengguna(userId) {
  const id = Number(userId);
  const tersimpan = ingatan.get(id);
  if (tersimpan && tersimpan.kedaluwarsa > Date.now()) return tersimpan.data;

  const hasil = await query(
    'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
    [id]
  );
  const data = hasil.rows[0] || null;
  ingatan.set(id, { data, kedaluwarsa: Date.now() + SELANG_INGAT });
  return data;
}

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token tidak ditemukan. Silakan login kembali.' });
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Token tidak valid atau kedaluwarsa.' });
  }

  try {
    const akun = await keadaanPengguna(payload.id);

    // Akun dihapus setelah tokennya terbit.
    if (!akun) {
      return res.status(401).json({ message: 'Akun tidak ditemukan. Silakan login kembali.' });
    }

    // 401, bukan 403. Yang dituntut adalah masuk kembali -- dan kalau
    // memang sudah dinonaktifkan, login berikutnya yang akan menolaknya
    // dengan alasan yang jelas. Membalas 403 membuat layar mengira ini
    // soal kewenangan, lalu membiarkan orangnya mencoba terus.
    if (!akun.is_active) {
      return res.status(401).json({ message: 'Akun Anda sudah dinonaktifkan. Hubungi admin.' });
    }

    // Peran diambil dari basis data, bukan dari token. Inilah yang
    // membuat kenaikan maupun penurunan peran berlaku tanpa login ulang.
    req.user = {
      id: akun.id,
      email: akun.email,
      name: akun.name,
      role: akun.role,
    };
    return next();
  } catch (err) {
    // Basis data tidak terjangkau. Sengaja MENOLAK, bukan melanjutkan
    // dengan isi token: melanjutkan berarti setiap gangguan basis data
    // otomatis mengembalikan lubang yang justru ditutup berkas ini.
    catatan.galat('Gagal memeriksa keadaan akun', {
      kode: req.kode, jalur: req.originalUrl, ...dariGalat(err),
    });
    return res.status(503).json({ message: 'Server sedang bermasalah. Coba lagi sebentar lagi.' });
  }
}

// Membatasi akses endpoint hanya untuk peran tertentu, misal authorize('admin').
// Perannya kini selalu yang terbaru, karena authenticate mengambilnya dari
// basis data.
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses untuk aksi ini.' });
    }
    next();
  };
}

module.exports = { authenticate, authorize, lupakanPengguna, lupakanSemua, SELANG_INGAT };
