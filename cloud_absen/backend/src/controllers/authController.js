const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { generateToken } = require('../utils/jwt');

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
      `SELECT u.id, u.name, u.email, u.role, u.avatar_url, d.name AS department
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    }

    res.json(result.rows[0]);
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

module.exports = { login, getProfile, changePassword };
