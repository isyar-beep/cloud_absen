const { pool, query } = require('../config/db');

// POST /api/leaves -- pegawai mengajukan izin
async function createLeave(req, res, next) {
  try {
    const userId = req.user.id;
    const { start_date, end_date, reason } = req.body;

    if (!start_date || !end_date || !reason || !reason.trim()) {
      return res.status(400).json({ message: 'Tanggal mulai, tanggal selesai, dan alasan wajib diisi.' });
    }
    // Validasi format supaya string tanggal rusak tidak lolos sampai ke query database
    const formatTanggalValid = /^\d{4}-\d{2}-\d{2}$/;
    if (!formatTanggalValid.test(start_date) || !formatTanggalValid.test(end_date)) {
      return res.status(400).json({ message: 'Format tanggal harus YYYY-MM-DD.' });
    }
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ message: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' });
    }

    // Cegah pengajuan yang tumpang tindih dengan pengajuan pending/approved lain
    const overlap = await query(
      `SELECT id FROM leave_requests
       WHERE user_id = $1 AND status IN ('pending', 'approved')
         AND start_date <= $3 AND end_date >= $2`,
      [userId, start_date, end_date]
    );
    if (overlap.rows.length > 0) {
      return res.status(409).json({ message: 'Anda sudah punya pengajuan izin di rentang tanggal tersebut.' });
    }

    const result = await query(
      `INSERT INTO leave_requests (user_id, start_date, end_date, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id, start_date, end_date, reason, status, created_at`,
      [userId, start_date, end_date, reason.trim()]
    );

    res.status(201).json({ message: 'Pengajuan izin berhasil dikirim. Menunggu persetujuan admin.', leave: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// GET /api/leaves/me -- riwayat pengajuan izin milik pegawai sendiri
async function getMyLeaves(req, res, next) {
  try {
    const result = await query(
      `SELECT l.id, l.start_date, l.end_date, l.reason, l.status, l.admin_note, l.created_at, l.reviewed_at,
              r.name AS reviewed_by_name
       FROM leave_requests l
       LEFT JOIN users r ON l.reviewed_by = r.id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/leaves?status= -- admin lihat semua pengajuan (default: pending dulu)
async function getAllLeaves(req, res, next) {
  try {
    const { status } = req.query;
    const validStatus = ['pending', 'approved', 'rejected'];
    const filterStatus = validStatus.includes(status) ? status : null;

    const result = await query(
      `SELECT l.id, l.start_date, l.end_date, l.reason, l.status, l.admin_note, l.created_at, l.reviewed_at,
              u.id AS user_id, u.name, d.name AS department,
              r.name AS reviewed_by_name
       FROM leave_requests l
       JOIN users u ON l.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN users r ON l.reviewed_by = r.id
       ${filterStatus ? 'WHERE l.status = $1' : ''}
       ORDER BY (l.status = 'pending') DESC, l.created_at DESC`,
      filterStatus ? [filterStatus] : []
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// PUT /api/leaves/:id/review -- admin menyetujui / menolak pengajuan.
// Jika disetujui, setiap tanggal dalam rentang otomatis dicatat sebagai 'izin'
// di tabel attendance (dibuat baru atau menimpa status record yang sudah ada).
async function reviewLeave(req, res, next) {
  const client = await pool.connect();
  try {
    const { status, admin_note } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Status review harus 'approved' atau 'rejected'." });
    }

    await client.query('BEGIN');

    const leaveResult = await client.query(
      `UPDATE leave_requests
       SET status = $1, admin_note = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4 AND status = 'pending'
       RETURNING id, user_id, start_date, end_date, reason, status`,
      [status, admin_note || null, req.user.id, req.params.id]
    );

    if (leaveResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Pengajuan tidak ditemukan atau sudah direview.' });
    }

    const leave = leaveResult.rows[0];

    if (status === 'approved') {
      // generate_series membuat satu baris attendance per tanggal izin
      await client.query(
        `INSERT INTO attendance (user_id, date, status, reason)
         SELECT $1, d::date, 'izin', $2
         FROM generate_series($3::date, $4::date, '1 day') AS d
         ON CONFLICT (user_id, date)
         DO UPDATE SET status = 'izin', reason = EXCLUDED.reason`,
        [leave.user_id, leave.reason, leave.start_date, leave.end_date]
      );
    }

    // Catat aksi admin untuk audit
    await client.query(
      `INSERT INTO admin_logs (admin_id, action, detail)
       VALUES ($1, $2, $3)`,
      [
        req.user.id,
        status === 'approved' ? 'approve_leave' : 'reject_leave',
        `Pengajuan izin #${leave.id} (user ${leave.user_id}, ${leave.start_date} s/d ${leave.end_date})`,
      ]
    );

    await client.query('COMMIT');

    res.json({
      message: status === 'approved' ? 'Pengajuan izin disetujui.' : 'Pengajuan izin ditolak.',
      leave,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { createLeave, getMyLeaves, getAllLeaves, reviewLeave };
