const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { uploadFotoProfil, hapusFotoLama } = require('../utils/uploadPhoto');
const { periksaKataSandi } = require('../utils/kataSandi');
const gembok = require('../utils/gemboklogin');
const { catatan, dariGalat } = require('../utils/catatan');
const { lupakanPengguna } = require('../middleware/auth');

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password wajib diisi.' });
    }

    // Diperiksa sebelum menyentuh basis data. Selain lebih murah, ini
    // juga membuat lamanya balasan tidak berbeda antara akun yang ada
    // dan yang tidak -- beda waktu itu sendiri sebuah petunjuk.
    const keadaan = gembok.periksa(email);
    if (keadaan.terkunci) {
      return res.status(429).json({
        message: `Terlalu banyak percobaan login gagal untuk akun ini. Coba lagi dalam ${Math.ceil(keadaan.sisaDetik / 60)} menit.`,
      });
    }

    const result = await query(
      `SELECT id, name, email, password_hash, role, is_active, avatar_url,
              harus_ganti_sandi,
              login_terakhir_pada, login_terakhir_ip
       FROM users WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
      gembok.catatGagal(email);
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      gembok.catatGagal(email);
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    gembok.catatBerhasil(email);
    const token = generateToken(user);

    // Login SEBELUMNYA, bukan yang barusan -- inilah yang berguna bagi
    // pemiliknya. Diambil dari baris yang sudah dibaca di atas, sebelum
    // ditimpa oleh pencatatan di bawah ini.
    const loginSebelumnya = {
      pada: user.login_terakhir_pada,
      ip: user.login_terakhir_ip,
    };

    // Kegagalan mencatat jejak tidak boleh menggagalkan login. Pegawai
    // yang sudah benar sandinya tidak pantas ditolak masuk hanya karena
    // satu kolom catatan gagal ditulis.
    try {
      await query(
        'UPDATE users SET login_terakhir_pada = NOW(), login_terakhir_ip = $1 WHERE id = $2',
        [String(req.ip || '').slice(0, 45), user.id]
      );
    } catch (e) {
      catatan.ingat('Gagal mencatat jejak login', {
        pengguna: user.id, ...dariGalat(e, { tumpukan: false }),
      });
    }

    res.json({
      message: 'Login berhasil',
      token,
      login_sebelumnya: loginSebelumnya,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        // Dibaca layar login untuk langsung membuka layar ganti sandi,
        // bukan melemparkan pengguna ke dasbor yang seluruh tombolnya
        // akan menolaknya.
        harus_ganti_sandi: user.harus_ganti_sandi,
        // Ikut dikirim supaya aplikasi bisa menampilkan foto profil sejak
        // layar pertama, tanpa memanggil /auth/me lebih dulu.
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function getProfile(req, res, next) {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.avatar_url,
              u.harus_ganti_sandi, u.login_terakhir_pada, u.login_terakhir_ip,
              s.name AS shift_name, s.start_time AS shift_start, s.end_time AS shift_end,
              p.name AS project_name, p.location AS project_location
       FROM users u
       LEFT JOIN shifts s ON u.shift_id = s.id
       LEFT JOIN projects p ON u.project_id = p.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    }

    const profile = result.rows[0];
    res.json({
      ...profile,
      shift_start: profile.shift_start?.slice(0, 5) || null,
      shift_end: profile.shift_end?.slice(0, 5) || null,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/change-password
async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Password lama dan baru wajib diisi.' });
    }

    const keluhan = periksaKataSandi(newPassword, { nama: req.user.name, email: req.user.email });
    if (keluhan) {
      return res.status(400).json({ message: keluhan });
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Password lama tidak sesuai.' });
    }

    // Mengganti dengan yang sama persis membuat orang mengira sandinya
    // sudah diperbarui padahal tidak berubah sama sekali.
    if (newPassword === oldPassword) {
      return res.status(400).json({ message: 'Password baru harus berbeda dari password lama.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    // Mengganti sandi memutus seluruh sesi lain. Ini inti perbaikannya:
    // orang mengganti sandi justru karena curiga ada yang tahu, dan
    // penggantian yang membiarkan token lama tetap hidup adalah jaminan
    // palsu -- pemiliknya merasa aman sementara yang memegang token lama
    // tetap masuk tanpa perlu tahu sandi barunya.
    //
    // FLOOR, bukan sekadar ::bigint. Pemeranan ke bigint di PostgreSQL
    // MEMBULATKAN: pukul 10:00:00.7 menjadi 10:00:01. Token yang terbit
    // pada detik 00 lalu dibandingkan dengan garis waktu detik 01 akan
    // tampak lebih tua daripada pemutusan yang baru saja terjadi -- dan
    // orang yang baru mengganti sandinya langsung ditendang oleh
    // tokennya sendiri. Terjaring pengujian, bukan dugaan.
    await query(
      `UPDATE users
       SET password_hash = $1,
           harus_ganti_sandi = FALSE,
           sesi_sejak_epoch = FLOOR(EXTRACT(EPOCH FROM NOW()))::bigint,
           updated_at = NOW()
       WHERE id = $2`,
      [newHash, req.user.id]
    );

    // Keadaan akun disimpan sebentar di middleware; tanpa pembatalan
    // tegas, sandi lama masih diterima sampai ingatan itu kedaluwarsa.
    lupakanPengguna(req.user.id);

    // Perangkat yang dipakai mengganti sandi TIDAK ikut dikeluarkan.
    // Menendang orang yang baru saja mengamankan akunnya terasa seperti
    // hukuman atas tindakan yang benar -- dan di HP, layar yang tiba-tiba
    // kembali ke halaman login mudah disalahartikan sebagai kegagalan.
    const token = generateToken({ id: req.user.id, email: req.user.email, role: req.user.role });

    res.json({
      message: 'Password berhasil diubah. Perangkat lain sudah dikeluarkan.',
      token,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/keluar-semua -- akhiri sesi di seluruh perangkat lain.
//
// Yang bisa dilakukan pemilik akun sendiri, tanpa menunggu admin. Kalau
// seseorang curiga akunnya dipakai orang lain -- HP tertinggal di
// warung, sesi lupa ditutup di komputer bersama -- ia butuh cara memutus
// akses SEKARANG, bukan menelepon admin lalu menunggu.
//
// Perangkat yang menekan tombol ini tetap masuk. Menendang semua
// perangkat termasuk yang sedang dipakai membuat orang ragu menekannya,
// dan tombol keamanan yang orang ragu menekannya sama saja tidak ada.
async function keluarSemua(req, res, next) {
  try {
    await query(
      `UPDATE users SET sesi_sejak_epoch = FLOOR(EXTRACT(EPOCH FROM NOW()))::bigint WHERE id = $1`,
      [req.user.id]
    );
    lupakanPengguna(req.user.id);

    const token = generateToken({
      id: req.user.id, email: req.user.email, role: req.user.role, name: req.user.name,
    });

    catatan.info('Pengguna mengakhiri sesi di seluruh perangkat', {
      kode: req.kode, pengguna: req.user.id,
    });

    res.json({
      message: 'Perangkat lain sudah dikeluarkan. Perangkat ini tetap masuk.',
      token,
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/auth/push-token -- simpan/update Expo push token milik user yang login.
// Dipanggil dari mobile app setelah izin notifikasi diberikan.
async function registerPushToken(req, res, next) {
  try {
    const { push_token } = req.body;

    if (push_token !== null && (!push_token || typeof push_token !== 'string')) {
      return res.status(400).json({ message: 'push_token wajib diisi (atau null untuk menghapus).' });
    }

    await query('UPDATE users SET push_token = $1, updated_at = NOW() WHERE id = $2', [
      push_token,
      req.user.id,
    ]);

    res.json({ message: 'Push token tersimpan.' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/auth/avatar -- pegawai mengunggah/mengganti foto profilnya sendiri.
// Ukuran sudah diperkecil di sisi perangkat sebelum dikirim.
async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Foto profil wajib dipilih.' });
    }

    const lama = await query('SELECT avatar_url, name FROM users WHERE id = $1', [req.user.id]);
    const avatarUrl = await uploadFotoProfil(req.file.buffer, {
      userId: req.user.id,
      userName: lama.rows[0]?.name,
    });

    await query('UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [
      avatarUrl,
      req.user.id,
    ]);

    // Baru dihapus setelah yang baru tersimpan, supaya tidak kehilangan
    // keduanya kalau penyimpanan gagal di tengah jalan.
    await hapusFotoLama(lama.rows[0]?.avatar_url);

    res.json({ message: 'Foto profil diperbarui.', avatar_url: avatarUrl });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/auth/avatar -- kembali memakai inisial nama
async function deleteAvatar(req, res, next) {
  try {
    const lama = await query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
    await query('UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1', [req.user.id]);
    await hapusFotoLama(lama.rows[0]?.avatar_url);
    res.json({ message: 'Foto profil dihapus.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login, getProfile, changePassword, keluarSemua,
  registerPushToken, uploadAvatar, deleteAvatar,
};
