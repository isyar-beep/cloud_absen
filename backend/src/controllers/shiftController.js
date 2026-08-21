const { query } = require('../config/db');

// Format HH:MM:SS -> HH:MM biar rapi di response (kolom TIME dari Postgres ikut detik)
function formatJam(t) {
  return t ? t.slice(0, 5) : t;
}

// GET /api/shifts -- daftar semua shift (dipakai dropdown assign pegawai & halaman kelola shift)
async function getAllShifts(req, res, next) {
  try {
    const result = await query(
      `SELECT s.id, s.name, s.start_time, s.end_time,
              COUNT(u.id) AS jumlah_pegawai
       FROM shifts s
       LEFT JOIN users u ON u.shift_id = s.id AND u.is_active = TRUE
       GROUP BY s.id
       ORDER BY s.start_time ASC`
    );
    res.json(result.rows.map((r) => ({
      ...r,
      start_time: formatJam(r.start_time),
      end_time: formatJam(r.end_time),
      jumlah_pegawai: Number(r.jumlah_pegawai),
    })));
  } catch (err) {
    next(err);
  }
}

// POST /api/shifts -- admin buat shift baru
async function createShift(req, res, next) {
  try {
    const { name, start_time, end_time } = req.body;
    if (!name || !name.trim() || !start_time || !end_time) {
      return res.status(400).json({ message: 'Nama shift, jam masuk, dan jam pulang wajib diisi.' });
    }

    const result = await query(
      `INSERT INTO shifts (name, start_time, end_time) VALUES ($1, $2, $3)
       RETURNING id, name, start_time, end_time`,
      [name.trim(), start_time, end_time]
    );
    const shift = result.rows[0];
    res.status(201).json({
      message: 'Shift berhasil dibuat.',
      shift: { ...shift, start_time: formatJam(shift.start_time), end_time: formatJam(shift.end_time) },
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/shifts/:id -- admin edit shift
async function updateShift(req, res, next) {
  try {
    const { name, start_time, end_time } = req.body;
    const result = await query(
      `UPDATE shifts
       SET name = COALESCE($1, name),
           start_time = COALESCE($2, start_time),
           end_time = COALESCE($3, end_time)
       WHERE id = $4
       RETURNING id, name, start_time, end_time`,
      [name?.trim() || null, start_time || null, end_time || null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Shift tidak ditemukan.' });
    }
    const shift = result.rows[0];
    res.json({
      message: 'Shift berhasil diperbarui.',
      shift: { ...shift, start_time: formatJam(shift.start_time), end_time: formatJam(shift.end_time) },
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/shifts/:id -- admin hapus shift (pegawai yang pakai otomatis jadi tanpa shift)
async function deleteShift(req, res, next) {
  try {
    await query('DELETE FROM shifts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Shift berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllShifts, createShift, updateShift, deleteShift };
