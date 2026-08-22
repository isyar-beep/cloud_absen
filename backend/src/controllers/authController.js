const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { generateToken } = require('../utils/jwt');
const { uploadPhotoToStorage, hapusFotoLama } = require('../utils/uploadPhoto');

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password wajib diisi.' });
    }

    const result = await query(
      'SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login berhasil',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
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
      `SELECT u.id, u.name, u.email, u.role, u.avatar_url, d.name AS department,
              s.name AS shift_name, s.start_time AS shift_start, s.end_time AS shift_end
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN shifts s ON u.shift_id = s.id
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
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password baru minimal 6 karakter.' });
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Password lama tidak sesuai.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      newHash,
      req.user.id,
    ]);

    res.json({ message: 'Password berhasil diubah.' });
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

    const lama = await query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
    const avatarUrl = await uploadPhotoToStorage(req.file.buffer, req.file.mimetype, 'avatar');

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

module.exports = { login, getProfile, changePassword, registerPushToken, uploadAvatar, deleteAvatar };
