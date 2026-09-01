const { query } = require('../config/db');
const { todayLocal } = require('../utils/date');
const { proyekKonsultan, bolehAksesProyek } = require('../utils/lingkupProyek');

// Ringkasan keadaan hari ini per proyek, dipakai kartu di halaman Proyek.
// Dihitung dalam satu kueri supaya jumlah proyek berapa pun tetap sekali
// jalan ke basis data.
const SQL_KARTU = `
  SELECT p.id, p.name, p.location, p.status, p.start_date, p.end_date,
         p.consultant_id, k.name AS consultant_name,
         COUNT(u.id) FILTER (WHERE u.is_active) AS jumlah_pegawai,
         COUNT(a.id) FILTER (WHERE a.status IN ('hadir', 'terlambat')) AS hadir_hari_ini,
         COUNT(a.id) FILTER (WHERE a.status = 'izin') AS izin_hari_ini,
         COUNT(a.id) FILTER (WHERE a.status = 'alpha') AS alpha_hari_ini
  FROM projects p
  LEFT JOIN users k ON p.consultant_id = k.id
  LEFT JOIN users u ON u.project_id = p.id AND u.role = 'staff'
  LEFT JOIN attendance a ON a.user_id = u.id AND a.date = $1::date
  WHERE {LINGKUP}
  GROUP BY p.id, k.name
  ORDER BY p.status ASC, p.name ASC`;

// GET /api/projects
// Admin melihat semua; konsultan hanya proyek yang dipegangnya.
async function listProjects(req, res, next) {
  try {
    const params = [todayLocal()];
    let lingkup = 'TRUE';

    if (req.user.role === 'konsultan') {
      const daftar = await proyekKonsultan(req.user.id);
      // Konsultan tanpa proyek: balas kosong, jangan biarkan syaratnya
      // hilang -- tanpa penyaring, seluruh proyek akan terbaca.
      if (daftar.length === 0) return res.json([]);
      params.push(daftar);
      lingkup = `p.id = ANY($${params.length}::int[])`;
    }

    const hasil = await query(SQL_KARTU.replace('{LINGKUP}', lingkup), params);
    res.json(hasil.rows.map((r) => ({
      ...r,
      jumlah_pegawai: Number(r.jumlah_pegawai),
      hadir_hari_ini: Number(r.hadir_hari_ini),
      izin_hari_ini: Number(r.izin_hari_ini),
      alpha_hari_ini: Number(r.alpha_hari_ini),
      // Belum absen = pegawai aktif dikurangi yang sudah punya catatan hari
      // ini. Dihitung di sini, bukan di SQL, supaya rumusnya terbaca.
      belum_absen: Math.max(
        0,
        Number(r.jumlah_pegawai)
          - Number(r.hadir_hari_ini) - Number(r.izin_hari_ini) - Number(r.alpha_hari_ini)
      ),
    })));
  } catch (err) {
    next(err);
  }
}

// GET /api/projects/:id -- rincian berikut daftar pegawainya
async function getProject(req, res, next) {
  try {
    if (!(await bolehAksesProyek(req.user, req.params.id))) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses ke proyek ini.' });
    }

    const proyek = await query(
      `SELECT p.*, k.name AS consultant_name, k.email AS consultant_email
       FROM projects p LEFT JOIN users k ON p.consultant_id = k.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (proyek.rows.length === 0) {
      return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
    }

    const pegawai = await query(
      `SELECT u.id, u.name, u.email, u.avatar_url, u.is_active, s.name AS shift_name
       FROM users u LEFT JOIN shifts s ON u.shift_id = s.id
       WHERE u.project_id = $1 AND u.role = 'staff'
       ORDER BY u.is_active DESC, u.name ASC`,
      [req.params.id]
    );

    res.json({ ...proyek.rows[0], pegawai: pegawai.rows });
  } catch (err) {
    next(err);
  }
}

// Konsultan yang boleh ditunjuk harus benar-benar berperan konsultan.
// Tanpa pemeriksaan ini, seorang pegawai bisa dipasang sebagai penanggung
// jawab dan diam-diam memperoleh kewenangan yang bukan haknya.
async function konsultanSah(consultantId) {
  if (consultantId === null || consultantId === undefined || consultantId === '') return true;
  const hasil = await query(
    "SELECT 1 FROM users WHERE id = $1 AND role = 'konsultan' AND is_active = TRUE",
    [consultantId]
  );
  return hasil.rows.length > 0;
}

// POST /api/projects -- admin saja
async function createProject(req, res, next) {
  try {
    const { name, location, consultant_id, start_date, end_date } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Nama proyek wajib diisi.' });
    }
    if (!(await konsultanSah(consultant_id))) {
      return res.status(400).json({ message: 'Penanggung jawab harus akun berperan konsultan yang aktif.' });
    }

    const hasil = await query(
      `INSERT INTO projects (name, location, consultant_id, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        String(name).trim(),
        location ? String(location).trim() : null,
        consultant_id || null,
        start_date || null,
        end_date || null,
      ]
    );
    res.status(201).json({ message: 'Proyek dibuat.', data: hasil.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/:id -- admin saja
async function updateProject(req, res, next) {
  try {
    const { name, location, consultant_id, start_date, end_date, status } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Nama proyek wajib diisi.' });
    }
    if (status && !['berjalan', 'selesai'].includes(status)) {
      return res.status(400).json({ message: 'Status proyek tidak dikenal.' });
    }
    if (!(await konsultanSah(consultant_id))) {
      return res.status(400).json({ message: 'Penanggung jawab harus akun berperan konsultan yang aktif.' });
    }

    const hasil = await query(
      `UPDATE projects
       SET name = $1, location = $2, consultant_id = $3,
           start_date = $4, end_date = $5, status = COALESCE($6, status),
           updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [
        String(name).trim(),
        location ? String(location).trim() : null,
        consultant_id || null,
        start_date || null,
        end_date || null,
        status || null,
        req.params.id,
      ]
    );
    if (hasil.rows.length === 0) {
      return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
    }
    res.json({ message: 'Proyek diperbarui.', data: hasil.rows[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/projects/:id -- admin saja
//
// Proyek yang sudah punya catatan absensi TIDAK dihapus, melainkan ditandai
// selesai. Menghapusnya akan memutus proyek dari seluruh riwayat di
// bawahnya, dan laporan lama kehilangan keterangan tempatnya.
async function deleteProject(req, res, next) {
  try {
    const dipakai = await query(
      'SELECT 1 FROM attendance WHERE project_id = $1 LIMIT 1',
      [req.params.id]
    );
    if (dipakai.rows.length > 0) {
      const hasil = await query(
        "UPDATE projects SET status = 'selesai', updated_at = NOW() WHERE id = $1 RETURNING id",
        [req.params.id]
      );
      if (hasil.rows.length === 0) {
        return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
      }
      return res.json({
        message: 'Proyek sudah memiliki riwayat absensi, jadi ditandai selesai — bukan dihapus.',
      });
    }

    const hasil = await query('DELETE FROM projects WHERE id = $1 RETURNING id', [req.params.id]);
    if (hasil.rows.length === 0) {
      return res.status(404).json({ message: 'Proyek tidak ditemukan.' });
    }
    res.json({ message: 'Proyek dihapus.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listProjects, getProject, createProject, updateProject, deleteProject };
