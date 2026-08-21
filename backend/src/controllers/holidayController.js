const { query } = require('../config/db');

// GET /api/holidays -- daftar hari libur (opsional filter ?year=)
async function getAllHolidays(req, res, next) {
  try {
    const { year } = req.query;
    const result = await query(
      year
        ? `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, name FROM holidays
           WHERE EXTRACT(YEAR FROM date) = $1 ORDER BY date ASC`
        : `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, name FROM holidays ORDER BY date ASC`,
      year ? [year] : []
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// POST /api/holidays -- admin tambah hari libur
async function createHoliday(req, res, next) {
  try {
    const { date, name } = req.body;
    if (!date || !name || !name.trim()) {
      return res.status(400).json({ message: 'Tanggal dan nama hari libur wajib diisi.' });
    }
    const formatValid = /^\d{4}-\d{2}-\d{2}$/;
    if (!formatValid.test(date)) {
      return res.status(400).json({ message: 'Format tanggal harus YYYY-MM-DD.' });
    }

    const existing = await query('SELECT id FROM holidays WHERE date = $1', [date]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Tanggal ini sudah terdaftar sebagai hari libur.' });
    }

    const result = await query(
      `INSERT INTO holidays (date, name) VALUES ($1, $2)
       RETURNING id, to_char(date, 'YYYY-MM-DD') AS date, name`,
      [date, name.trim()]
    );
    res.status(201).json({ message: 'Hari libur berhasil ditambahkan.', holiday: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/holidays/:id -- admin hapus hari libur
async function deleteHoliday(req, res, next) {
  try {
    await query('DELETE FROM holidays WHERE id = $1', [req.params.id]);
    res.json({ message: 'Hari libur berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllHolidays, createHoliday, deleteHoliday };
