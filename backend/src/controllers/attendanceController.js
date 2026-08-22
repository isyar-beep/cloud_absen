const { query } = require('../config/db');
const { uploadFotoAbsensi } = require('../utils/uploadPhoto');
const { todayLocal } = require('../utils/date');

const JAM_MASUK_BATAS_DEFAULT = '08:00:00'; // dipakai kalau pegawai belum di-assign ke shift manapun

// POST /api/attendance/check-in -- pengguna absen masuk dengan foto
async function checkIn(req, res, next) {
  try {
    const userId = req.user.id;
    const today = todayLocal();
    const { latitude, longitude } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Foto wajib diambil untuk absen.' });
    }

    // Cek apakah sudah absen hari ini
    const existing = await query(
      'SELECT id FROM attendance WHERE user_id = $1 AND date = $2',
      [userId, today]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Anda sudah melakukan absen masuk hari ini.' });
    }

    const photoUrl = await uploadFotoAbsensi(req.file.buffer, {
      userId,
      userName: req.user.name,
      jenis: 'masuk',
    });

    // Batas telat mengikuti jam masuk shift pegawai (kalau belum di-assign shift, pakai default 08:00)
    const shiftResult = await query(
      `SELECT s.start_time FROM users u LEFT JOIN shifts s ON u.shift_id = s.id WHERE u.id = $1`,
      [userId]
    );
    const jamMasukBatas = shiftResult.rows[0]?.start_time || JAM_MASUK_BATAS_DEFAULT;

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8);
    const status = currentTime > jamMasukBatas ? 'terlambat' : 'hadir';

    const result = await query(
      `INSERT INTO attendance (user_id, date, check_in_time, status, photo_in_url, latitude, longitude)
       VALUES ($1, $2, NOW(), $3, $4, $5, $6)
       RETURNING id, date, check_in_time, status, photo_in_url`,
      [userId, today, status, photoUrl, latitude || null, longitude || null]
    );

    res.status(201).json({ message: 'Absen masuk berhasil.', attendance: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/check-out -- pengguna absen pulang dengan foto
async function checkOut(req, res, next) {
  try {
    const userId = req.user.id;
    const today = todayLocal();

    if (!req.file) {
      return res.status(400).json({ message: 'Foto wajib diambil untuk absen pulang.' });
    }

    const existing = await query(
      'SELECT id, check_out_time FROM attendance WHERE user_id = $1 AND date = $2',
      [userId, today]
    );

    if (existing.rows.length === 0) {
      return res.status(400).json({ message: 'Anda belum melakukan absen masuk hari ini.' });
    }
    if (existing.rows[0].check_out_time) {
      return res.status(409).json({ message: 'Anda sudah melakukan absen pulang hari ini.' });
    }

    const photoUrl = await uploadFotoAbsensi(req.file.buffer, {
      userId,
      userName: req.user.name,
      jenis: 'pulang',
    });

    const result = await query(
      `UPDATE attendance
       SET check_out_time = NOW(), photo_out_url = $1
       WHERE user_id = $2 AND date = $3
       RETURNING id, date, check_in_time, check_out_time, status, photo_out_url`,
      [photoUrl, userId, today]
    );

    res.json({ message: 'Absen pulang berhasil.', attendance: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/today -- status absensi hari ini (untuk user)
async function getTodayStatus(req, res, next) {
  try {
    const today = todayLocal();
    const result = await query(
      'SELECT * FROM attendance WHERE user_id = $1 AND date = $2',
      [req.user.id, today]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    next(err);
  }
}

// Susun klausa WHERE dinamis untuk filter riwayat (tanggal & status).
// baseParams diisi dulu (misal user_id), filter menyusul di belakangnya.
function buildHistoryFilter(queryParams, conditions, params) {
  const { start_date, end_date, status } = queryParams;
  const validStatus = ['hadir', 'terlambat', 'izin', 'alpha'];

  if (start_date) {
    params.push(start_date);
    conditions.push(`a.date >= $${params.length}`);
  }
  if (end_date) {
    params.push(end_date);
    conditions.push(`a.date <= $${params.length}`);
  }
  if (status && validStatus.includes(status)) {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }
}

// GET /api/attendance/history -- riwayat absensi milik user sendiri
// Mendukung filter ?start_date=&end_date=&status= dan paginasi limit/offset
async function getMyHistory(req, res, next) {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const conditions = ['a.user_id = $1'];
    const params = [req.user.id];
    buildHistoryFilter(req.query, conditions, params);

    params.push(limit, offset);
    const result = await query(
      `SELECT a.id, a.date, a.check_in_time, a.check_out_time, a.status, a.reason,
              a.photo_in_url, a.photo_out_url
       FROM attendance a
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/today-all -- admin lihat semua absensi hari ini (real-time board)
async function getTodayAll(req, res, next) {
  try {
    const today = todayLocal();
    const result = await query(
      `SELECT a.id, a.check_in_time, a.check_out_time, a.status,
              u.id AS user_id, u.name, u.avatar_url,
              d.name AS department
       FROM users u
       LEFT JOIN attendance a ON a.user_id = u.id AND a.date = $1
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.is_active = TRUE AND u.role != 'admin'
       ORDER BY a.check_in_time ASC NULLS LAST`,
      [today]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/user/:userId -- admin lihat riwayat absensi pengguna tertentu
async function getUserHistory(req, res, next) {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const conditions = ['a.user_id = $1'];
    const params = [req.params.userId];
    buildHistoryFilter(req.query, conditions, params);

    params.push(limit, offset);
    const result = await query(
      `SELECT a.id, a.date, a.check_in_time, a.check_out_time, a.status, a.reason,
              a.photo_in_url, a.photo_out_url
       FROM attendance a
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/all -- admin lihat riwayat seluruh pegawai
// Filter: ?start_date=&end_date=&status=&department_id= + paginasi limit/offset
async function getAllHistory(req, res, next) {
  try {
    const { limit = 50, offset = 0, department_id, user_id, sort, with_photo } = req.query;
    const conditions = ["u.role != 'admin'"];
    const params = [];
    buildHistoryFilter(req.query, conditions, params);

    if (department_id) {
      params.push(department_id);
      conditions.push(`u.department_id = $${params.length}`);
    }
    if (user_id) {
      params.push(user_id);
      conditions.push(`u.id = $${params.length}`);
    }
    // Dipakai halaman galeri: hanya hari yang benar-benar punya foto
    if (with_photo === 'true') {
      conditions.push('(a.photo_in_url IS NOT NULL OR a.photo_out_url IS NOT NULL)');
    }

    // Hanya dua nilai yang diterima, tidak pernah disisipkan dari input mentah
    const urutan = sort === 'asc' ? 'ASC' : 'DESC';

    params.push(limit, offset);
    const result = await query(
      `SELECT a.id, a.date, a.check_in_time, a.check_out_time, a.status, a.reason,
              a.photo_in_url, a.photo_out_url,
              u.id AS user_id, u.name, u.avatar_url, d.name AS department
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.date ${urutan}, u.name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// PUT /api/attendance/:id/status -- admin ubah status manual (misal set izin/alpha)
async function updateStatus(req, res, next) {
  try {
    const { status, reason } = req.body;
    const validStatus = ['hadir', 'terlambat', 'izin', 'alpha'];

    if (!validStatus.includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid.' });
    }

    const result = await query(
      `UPDATE attendance SET status = $1, reason = $2 WHERE id = $3 RETURNING *`,
      [status, reason || null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Data absensi tidak ditemukan.' });
    }

    res.json({ message: 'Status absensi berhasil diperbarui.', attendance: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/mark-alpha -- tandai pegawai yang tidak absen & tidak izin
// sebagai "alpha" untuk satu tanggal (default: kemarin). Melewati weekend & hari
// libur otomatis. Dipanggil admin manual, atau terjadwal dari cron VPS tiap malam:
//   curl -X POST -H "Authorization: Bearer <token-admin>" .../api/attendance/mark-alpha
async function markAlpha(req, res, next) {
  try {
    // Default ke kemarin -- menandai "hari ini" alpha sebelum harinya berakhir
    // akan salah kalau pegawai baru absen di sore/malam hari.
    const kemarin = new Date();
    kemarin.setDate(kemarin.getDate() - 1);
    const y = kemarin.getFullYear();
    const m = String(kemarin.getMonth() + 1).padStart(2, '0');
    const d = String(kemarin.getDate()).padStart(2, '0');
    const targetDate = req.body?.date || `${y}-${m}-${d}`;

    const result = await query(
      `INSERT INTO attendance (user_id, date, status)
       SELECT u.id, $1::date, 'alpha'
       FROM users u
       WHERE u.role != 'admin' AND u.is_active = TRUE
         AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.user_id = u.id AND a.date = $1::date)
         AND EXTRACT(DOW FROM $1::date) NOT IN (0, 6)
         AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.date = $1::date)
       RETURNING user_id`,
      [targetDate]
    );

    res.json({
      message: `${result.rows.length} pegawai ditandai alpha untuk tanggal ${targetDate}.`,
      data: { tanggal: targetDate, jumlah: result.rows.length },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  checkIn,
  checkOut,
  getTodayStatus,
  getMyHistory,
  getTodayAll,
  getUserHistory,
  getAllHistory,
  updateStatus,
  markAlpha,
};
