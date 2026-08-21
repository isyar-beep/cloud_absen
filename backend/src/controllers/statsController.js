const { query } = require('../config/db');
const { todayLocal } = require('../utils/date');

// GET /api/stats/me -- statistik personal pengguna (bulan berjalan)
async function getMyStats(req, res, next) {
  try {
    const userId = req.user.id;
    const { month, year } = req.query;
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'hadir') AS total_hadir,
         COUNT(*) FILTER (WHERE status = 'terlambat') AS total_terlambat,
         COUNT(*) FILTER (WHERE status = 'izin') AS total_izin,
         COUNT(*) FILTER (WHERE status = 'alpha') AS total_alpha,
         COUNT(*) AS total_record,
         AVG(EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600)
           FILTER (WHERE check_out_time IS NOT NULL) AS avg_work_hours
       FROM attendance
       WHERE user_id = $1
         AND EXTRACT(MONTH FROM date) = $2
         AND EXTRACT(YEAR FROM date) = $3`,
      [userId, targetMonth, targetYear]
    );

    const row = result.rows[0];
    const totalHadirGabungan = Number(row.total_hadir) + Number(row.total_terlambat);
    const totalRecord = Number(row.total_record) || 1;

    res.json({
      total_hadir: totalHadirGabungan,
      total_terlambat: Number(row.total_terlambat),
      total_izin: Number(row.total_izin),
      total_alpha: Number(row.total_alpha),
      avg_work_hours: row.avg_work_hours ? Number(row.avg_work_hours).toFixed(1) : 0,
      attendance_rate: ((totalHadirGabungan / totalRecord) * 100).toFixed(1),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/stats/me/trend -- data trend 30 hari terakhir untuk chart
async function getMyTrend(req, res, next) {
  try {
    const result = await query(
      `SELECT date, status,
              EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600 AS work_hours
       FROM attendance
       WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY date ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/stats/overview -- KPI perusahaan untuk admin
async function getOverview(req, res, next) {
  try {
    const today = todayLocal();

    const totalPegawai = await query(
      `SELECT COUNT(*) FROM users WHERE role != 'admin' AND is_active = TRUE`
    );

    const todayStats = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('hadir','terlambat')) AS hadir,
         COUNT(*) FILTER (WHERE status = 'terlambat') AS terlambat,
         COUNT(*) FILTER (WHERE status = 'alpha') AS alpha,
         COUNT(*) FILTER (WHERE status = 'izin') AS izin
       FROM attendance WHERE date = $1`,
      [today]
    );

    res.json({
      total_pegawai: Number(totalPegawai.rows[0].count),
      hadir_hari_ini: Number(todayStats.rows[0].hadir) || 0,
      terlambat_hari_ini: Number(todayStats.rows[0].terlambat) || 0,
      alpha_hari_ini: Number(todayStats.rows[0].alpha) || 0,
      izin_hari_ini: Number(todayStats.rows[0].izin) || 0,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/stats/department -- attendance rate per departemen
async function getDepartmentStats(req, res, next) {
  try {
    const { month, year } = req.query;
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    const result = await query(
      `SELECT d.name AS department,
              COUNT(a.*) FILTER (WHERE a.status IN ('hadir','terlambat')) AS hadir,
              COUNT(a.*) AS total_record
       FROM departments d
       LEFT JOIN users u ON u.department_id = d.id AND u.role != 'admin'
       LEFT JOIN attendance a ON a.user_id = u.id
         AND EXTRACT(MONTH FROM a.date) = $1
         AND EXTRACT(YEAR FROM a.date) = $2
       GROUP BY d.name
       ORDER BY d.name`,
      [targetMonth, targetYear]
    );

    const stats = result.rows.map((row) => ({
      department: row.department,
      attendance_rate: row.total_record > 0
        ? ((row.hadir / row.total_record) * 100).toFixed(1)
        : '0.0',
    }));

    res.json(stats);
  } catch (err) {
    next(err);
  }
}

// GET /api/stats/ranking -- top performer & pegawai at-risk
async function getRanking(req, res, next) {
  try {
    const { month, year } = req.query;
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    const result = await query(
      `SELECT u.id, u.name,
              COUNT(a.*) FILTER (WHERE a.status IN ('hadir','terlambat')) AS hadir,
              COUNT(a.*) AS total_record
       FROM users u
       LEFT JOIN attendance a ON a.user_id = u.id
         AND EXTRACT(MONTH FROM a.date) = $1
         AND EXTRACT(YEAR FROM a.date) = $2
       WHERE u.role != 'admin' AND u.is_active = TRUE
       GROUP BY u.id, u.name
       HAVING COUNT(a.*) > 0
       ORDER BY (COUNT(a.*) FILTER (WHERE a.status IN ('hadir','terlambat'))::float / COUNT(a.*)) DESC`,
      [targetMonth, targetYear]
    );

    const ranked = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      attendance_rate: ((row.hadir / row.total_record) * 100).toFixed(1),
    }));

    res.json({
      top_performers: ranked.slice(0, 5),
      at_risk: ranked.filter((r) => Number(r.attendance_rate) < 80).slice(0, 5),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/stats/breakdown -- ringkasan hadir/telat/izin/alpha untuk dashboard grafik admin.
// Query: ?user_id= (kosongkan = gabungan semua pegawai), ?month=&year= (kosongkan
// keduanya = riwayat keseluruhan, bukan cuma satu bulan).
async function getBreakdown(req, res, next) {
  try {
    const { user_id, month, year } = req.query;
    const conditions = [`u.role != 'admin'`];
    const params = [];

    if (user_id) {
      params.push(user_id);
      conditions.push(`u.id = $${params.length}`);
    }
    if (month && year) {
      params.push(month);
      conditions.push(`EXTRACT(MONTH FROM a.date) = $${params.length}`);
      params.push(year);
      conditions.push(`EXTRACT(YEAR FROM a.date) = $${params.length}`);
    }

    const result = await query(
      `SELECT
         COUNT(a.*) FILTER (WHERE a.status = 'hadir') AS hadir,
         COUNT(a.*) FILTER (WHERE a.status = 'terlambat') AS terlambat,
         COUNT(a.*) FILTER (WHERE a.status = 'izin') AS izin,
         COUNT(a.*) FILTER (WHERE a.status = 'alpha') AS alpha,
         COUNT(a.*) AS total_record
       FROM users u
       JOIN attendance a ON a.user_id = u.id
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    const row = result.rows[0];
    const hadirGabungan = Number(row.hadir) + Number(row.terlambat);
    const totalRecord = Number(row.total_record) || 0;

    res.json({
      hadir: Number(row.hadir),
      terlambat: Number(row.terlambat),
      izin: Number(row.izin),
      alpha: Number(row.alpha),
      total_record: totalRecord,
      attendance_rate: totalRecord > 0 ? ((hadirGabungan / totalRecord) * 100).toFixed(1) : '0.0',
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/stats/monthly-series -- breakdown per bulan, untuk bar/line chart.
// Query: ?user_id= (kosongkan = gabungan semua pegawai)
async function getMonthlySeries(req, res, next) {
  try {
    const { user_id } = req.query;
    const conditions = [`u.role != 'admin'`];
    const params = [];

    if (user_id) {
      params.push(user_id);
      conditions.push(`u.id = $${params.length}`);
    }

    const result = await query(
      `SELECT
         EXTRACT(YEAR FROM a.date) AS year,
         EXTRACT(MONTH FROM a.date) AS month,
         COUNT(a.*) FILTER (WHERE a.status = 'hadir') AS hadir,
         COUNT(a.*) FILTER (WHERE a.status = 'terlambat') AS terlambat,
         COUNT(a.*) FILTER (WHERE a.status = 'izin') AS izin,
         COUNT(a.*) FILTER (WHERE a.status = 'alpha') AS alpha
       FROM users u
       JOIN attendance a ON a.user_id = u.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY 1, 2
       ORDER BY 1, 2`,
      params
    );

    res.json(result.rows.map((r) => ({
      year: Number(r.year),
      month: Number(r.month),
      hadir: Number(r.hadir),
      terlambat: Number(r.terlambat),
      izin: Number(r.izin),
      alpha: Number(r.alpha),
    })));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyStats,
  getMyTrend,
  getOverview,
  getDepartmentStats,
  getRanking,
  getBreakdown,
  getMonthlySeries,
};
