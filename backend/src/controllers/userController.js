const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

// GET /api/departments -- daftar departemen (untuk dropdown filter/form)
async function getDepartments(req, res, next) {
  try {
    const result = await query('SELECT id, name FROM departments ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/users -- daftar semua pengguna (admin only)
async function getAllUsers(req, res, next) {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.avatar_url,
              d.id AS department_id, d.name AS department
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       ORDER BY u.name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/users/:id
async function getUserById(req, res, next) {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active,
              d.id AS department_id, d.name AS department
       FROM users u LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// POST /api/users -- admin membuat akun pengguna baru
async function createUser(req, res, next) {
  try {
    const { name, email, password, role, department_id } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nama, email, dan password wajib diisi.' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Email sudah terdaftar.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, department_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, department_id`,
      [name, email, passwordHash, role || 'staff', department_id || null]
    );

    res.status(201).json({ message: 'Pengguna berhasil dibuat.', user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/:id -- admin edit data pengguna
async function updateUser(req, res, next) {
  try {
    const { name, email, role, department_id, is_active } = req.body;

    const result = await query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           role = COALESCE($3, role),
           department_id = COALESCE($4, department_id),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, name, email, role, department_id, is_active`,
      [name, email, role, department_id, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    }

    res.json({ message: 'Pengguna berhasil diperbarui.', user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/:id/reset-password -- admin reset password pengguna
async function resetPassword(req, res, next) {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password baru minimal 6 karakter.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      passwordHash,
      req.params.id,
    ]);

    res.json({ message: 'Password pengguna berhasil direset.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/:id -- nonaktifkan akun (soft delete, bukan hapus permanen)
async function deactivateUser(req, res, next) {
  try {
    await query('UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1', [
      req.params.id,
    ]);
    res.json({ message: 'Akun pengguna telah dinonaktifkan.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDepartments,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  resetPassword,
  deactivateUser,
};
