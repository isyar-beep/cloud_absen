const { query } = require('../config/db');
const { todayLocal } = require('../utils/date');
const { hitungRate } = require('../utils/attendanceRate');
const { jendelaSemuaPegawai } = require('../utils/shiftWindow');
const { KOLOM_SHIFT_SQL, kekuranganAbsen } = require('../utils/kelengkapan');
const { batasiPerPegawai, proyekKonsultan } = require('../utils/lingkupProyek');

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

    // Catatan yang sudah absen masuk tapi tidak pernah absen pulang. Dihitung
    // di JavaScript, bukan SQL, karena batas "sudah lewat jam pulang" itu
    // aturan shift -- dan aturan itu tinggal di utils/shiftWindow.js. Menyalin
    // hitungannya ke SQL berarti punya dua sumber yang bisa berselisih.
    // Jumlah barisnya paling banyak sebulan, jadi murah.
    const calon = await query(
      `SELECT a.date, a.check_in_time, a.check_out_time, a.status,
              ${KOLOM_SHIFT_SQL}
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN shifts s ON u.shift_id = s.id
       WHERE a.user_id = $1
         AND EXTRACT(MONTH FROM a.date) = $2
         AND EXTRACT(YEAR FROM a.date) = $3
         AND a.check_in_time IS NOT NULL
         AND a.check_out_time IS NULL`,
      [userId, targetMonth, targetYear]
    );
    const sekarang = new Date();
    const totalTidakLengkap = calon.rows
      .filter((r) => kekuranganAbsen(r, sekarang) === 'pulang').length;

    res.json({
      total_hadir: Number(row.total_hadir) + Number(row.total_terlambat),
      total_terlambat: Number(row.total_terlambat),
      total_izin: Number(row.total_izin),
      total_alpha: Number(row.total_alpha),
      // Tidak ikut menurunkan attendance_rate: orangnya terbukti datang,
      // yang kurang cuma catatannya. Angkanya berdiri sendiri supaya bisa
      // ditindaklanjuti lewat koreksi tanpa mencemari angka kehadiran.
      total_tidak_lengkap: totalTidakLengkap,
      avg_work_hours: row.avg_work_hours ? Number(row.avg_work_hours).toFixed(1) : 0,
      attendance_rate: hitungRate({
        hadir: row.total_hadir,
        terlambat: row.total_terlambat,
        alpha: row.total_alpha,
      }),
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
       WHERE user_id = $1
         AND date >= CURRENT_DATE - INTERVAL '30 days'
         -- Batas depan WAJIB ada. Izin yang disetujui menulis baris absensi
         -- di tanggal yang belum terjadi (memang harus, supaya penanda alpha
         -- tidak mencap pegawainya bolos). Tanpa batas ini, grafik berjudul
         -- "30 hari terakhir" ikut menggambar titik di tanggal depan.
         AND date <= CURRENT_DATE
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

    // Konsultan hanya melihat angka proyeknya sendiri. Tanpa penyaring ini
    // ia melihat KPI seluruh dinas -- bocor dalam bentuk angka gabungan,
    // yang justru sulit disadari karena tidak ada nama yang tampil.
    const kondisiPegawai = [`role = 'staff'`, 'is_active = TRUE'];
    const paramPegawai = [];
    if (req.user.role === 'konsultan') {
      const milik = await proyekKonsultan(req.user.id);
      if (milik.length === 0) {
        return res.json({
          total_pegawai: 0, hadir_hari_ini: 0, terlambat_hari_ini: 0,
          alpha_hari_ini: 0, izin_hari_ini: 0,
        });
      }
      paramPegawai.push(milik);
      kondisiPegawai.push(`project_id = ANY($${paramPegawai.length}::int[])`);
    }

    const totalPegawai = await query(
      `SELECT COUNT(*) FROM users WHERE ${kondisiPegawai.join(' AND ')}`,
      paramPegawai
    );

    // Dihitung per TANGGAL SHIFT tiap pegawai, bukan tanggal kalender.
    // Pegawai shift malam yang masuk pukul 22:00 tadi malam tercatat di
    // tanggal kemarin; dengan `date = hari ini` ia hilang dari hitungan
    // "Hadir Hari Ini" padahal sedang bekerja.
    //
    // Baris absensi juga harus disaring lewat daftar pegawai aktif. Query
    // lama menghitung langsung dari tabel attendance tanpa menoleh ke tabel
    // users, sehingga catatan milik pegawai yang sudah dinonaktifkan tetap
    // ikut menambah angka KPI.
    let daftar = await jendelaSemuaPegawai(query);
    if (req.user.role === 'konsultan') {
      const milik = await proyekKonsultan(req.user.id);
      daftar = daftar.filter((d) => milik.includes(d.pegawai.project_id));
    }
    const ids = daftar.map((d) => d.pegawai.id);
    const tanggalShift = daftar.map((d) => d.jendela.tanggal_shift_pulang);

    const todayStats = ids.length === 0
      ? { rows: [{ hadir: 0, terlambat: 0, alpha: 0, izin: 0 }] }
      : await query(
          `SELECT
             COUNT(a.*) FILTER (WHERE a.status IN ('hadir','terlambat')) AS hadir,
             COUNT(a.*) FILTER (WHERE a.status = 'terlambat') AS terlambat,
             COUNT(a.*) FILTER (WHERE a.status = 'alpha') AS alpha,
             COUNT(a.*) FILTER (WHERE a.status = 'izin') AS izin
           FROM unnest($1::int[], $2::date[]) AS p(uid, tanggal)
           JOIN attendance a ON a.user_id = p.uid AND a.date = p.tanggal`,
          [ids, tanggalShift]
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

    // Konsultan melihat rekap departemen hanya untuk pegawai di proyeknya.
    const paramsDept = [targetMonth, targetYear];
    let filterProyek = '';
    if (req.user.role === 'konsultan') {
      const milik = await proyekKonsultan(req.user.id);
      if (milik.length === 0) return res.json([]);
      paramsDept.push(milik);
      filterProyek = `AND u.project_id = ANY($${paramsDept.length}::int[])`;
    }

    const result = await query(
      `SELECT d.name AS department,
              COUNT(a.*) FILTER (WHERE a.status = 'hadir') AS hadir,
              COUNT(a.*) FILTER (WHERE a.status = 'terlambat') AS terlambat,
              COUNT(a.*) FILTER (WHERE a.status = 'alpha') AS alpha
       FROM departments d
       LEFT JOIN users u ON u.department_id = d.id AND u.role = 'staff' AND u.is_active = TRUE
         ${filterProyek}
       LEFT JOIN attendance a ON a.user_id = u.id
         AND EXTRACT(MONTH FROM a.date) = $1
         AND EXTRACT(YEAR FROM a.date) = $2
       GROUP BY d.name
       ORDER BY d.name`,
      paramsDept
    );

    const stats = result.rows.map((row) => ({
      department: row.department,
      attendance_rate: hitungRate(row),
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

    const kondisi = [`u.role = 'staff'`, 'u.is_active = TRUE'];
    const paramLingkup = [targetMonth, targetYear];
    if (!(await batasiPerPegawai(req.user, kondisi, paramLingkup))) {
      return res.json({ top_performers: [], at_risk: [] });
    }

    const result = await query(
      // HAVING memakai hari efektif, bukan seluruh catatan: pegawai yang
      // sebulan penuh izin resmi tidak boleh muncul sebagai 0% dan masuk
      // daftar berisiko. Urutannya juga memakai rumus yang sama dengan
      // angka yang ditampilkan, supaya peringkat tidak bertentangan.
      `SELECT u.id, u.name,
              COUNT(a.*) FILTER (WHERE a.status = 'hadir') AS hadir,
              COUNT(a.*) FILTER (WHERE a.status = 'terlambat') AS terlambat,
              COUNT(a.*) FILTER (WHERE a.status = 'alpha') AS alpha
       FROM users u
       LEFT JOIN attendance a ON a.user_id = u.id
         AND EXTRACT(MONTH FROM a.date) = $1
         AND EXTRACT(YEAR FROM a.date) = $2
       WHERE ${kondisi.join(' AND ')}
       GROUP BY u.id, u.name
       HAVING COUNT(a.*) FILTER (WHERE a.status IN ('hadir','terlambat','alpha')) > 0
       ORDER BY (
         COUNT(a.*) FILTER (WHERE a.status IN ('hadir','terlambat'))::float
         / COUNT(a.*) FILTER (WHERE a.status IN ('hadir','terlambat','alpha'))
       ) DESC`,
      paramLingkup
    );

    const ranked = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      attendance_rate: hitungRate(row),
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
    const conditions = [`u.role = 'staff'`];
    const params = [];

    if (user_id) {
      // Admin memilih satu orang secara sadar -- termasuk kalau orang itu
      // sudah dinonaktifkan. Jangan disaring, nanti layarnya kosong tanpa
      // penjelasan.
      params.push(user_id);
      conditions.push(`u.id = $${params.length}`);
    } else {
      // Tanpa pilihan orang, angkanya harus sama cakupannya dengan ranking,
      // KPI, dan laporan bulanan: pegawai aktif saja.
      conditions.push('u.is_active = TRUE');
    }
    if (!(await batasiPerPegawai(req.user, conditions, params))) {
      return res.json({
        hadir: 0, terlambat: 0, izin: 0, alpha: 0,
        total_record: 0, hari_efektif: 0, attendance_rate: '0.0',
      });
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

    res.json({
      hadir: Number(row.hadir),
      terlambat: Number(row.terlambat),
      izin: Number(row.izin),
      alpha: Number(row.alpha),
      total_record: Number(row.total_record),
      // hari efektif = penyebut rate; izin tidak ikut dihitung
      hari_efektif: Number(row.hadir) + Number(row.terlambat) + Number(row.alpha),
      attendance_rate: hitungRate(row),
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
    const conditions = [`u.role = 'staff'`];
    const params = [];

    if (user_id) {
      // Admin memilih satu orang secara sadar -- termasuk kalau orang itu
      // sudah dinonaktifkan. Jangan disaring, nanti layarnya kosong tanpa
      // penjelasan.
      params.push(user_id);
      conditions.push(`u.id = $${params.length}`);
    } else {
      // Tanpa pilihan orang, angkanya harus sama cakupannya dengan ranking,
      // KPI, dan laporan bulanan: pegawai aktif saja.
      conditions.push('u.is_active = TRUE');
    }

    if (!(await batasiPerPegawai(req.user, conditions, params))) return res.json([]);

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
