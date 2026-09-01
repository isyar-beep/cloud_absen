// ============================================================
// Penetapan WFA (Work From Anywhere).
//
// WFA ditetapkan admin, bukan diajukan pegawai. Admin menandai rentang
// tanggal seorang pegawai bekerja dari luar kantor; pegawainya tetap absen
// berfoto seperti biasa.
//
// Yang berubah hanyalah penandaan: catatan absensi pada rentang itu diberi
// work_mode = 'wfa' supaya terbaca di riwayat, galeri, dan laporan.
// Sistem ini belum memvalidasi lokasi absen sama sekali -- koordinat hanya
// direkam -- jadi tidak ada aturan yang "dilonggarkan" untuk WFA hari ini.
// ============================================================
const { query } = require('../config/db');

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

// Cari penetapan WFA yang mencakup satu tanggal. Dipakai saat absen masuk
// untuk menentukan work_mode, jadi harus murah: satu baris, pakai indeks.
async function wfaBerlaku(userId, tanggal) {
  const hasil = await query(
    `SELECT id, note FROM wfa_assignments
     WHERE user_id = $1 AND $2::date BETWEEN start_date AND end_date
     LIMIT 1`,
    [userId, tanggal]
  );
  return hasil.rows[0] || null;
}

// GET /api/wfa -- daftar penetapan WFA (admin).
// ?user_id= menyaring satu pegawai, ?aktif=true hanya yang sedang berjalan.
async function getSemuaWfa(req, res, next) {
  try {
    const { user_id, aktif } = req.query;
    const kondisi = [];
    const params = [];

    if (user_id) {
      params.push(Number(user_id));
      kondisi.push(`w.user_id = $${params.length}`);
    }
    if (aktif === 'true') {
      kondisi.push('CURRENT_DATE BETWEEN w.start_date AND w.end_date');
    }

    const hasil = await query(
      `SELECT w.id, w.user_id,
              to_char(w.start_date, 'YYYY-MM-DD') AS start_date,
              to_char(w.end_date, 'YYYY-MM-DD') AS end_date,
              w.note, w.created_at,
              u.name, u.avatar_url, d.name AS department,
              pembuat.name AS created_by_name,
              (CURRENT_DATE BETWEEN w.start_date AND w.end_date) AS sedang_berjalan,
              (w.end_date < CURRENT_DATE) AS sudah_lewat
       FROM wfa_assignments w
       JOIN users u ON w.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN users pembuat ON w.created_by = pembuat.id
       ${kondisi.length ? `WHERE ${kondisi.join(' AND ')}` : ''}
       ORDER BY w.start_date DESC
       LIMIT 200`,
      params
    );
    res.json(hasil.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/wfa/me -- penetapan WFA milik sendiri (pegawai)
async function getWfaSaya(req, res, next) {
  try {
    const hasil = await query(
      `SELECT id, to_char(start_date, 'YYYY-MM-DD') AS start_date,
              to_char(end_date, 'YYYY-MM-DD') AS end_date, note,
              (CURRENT_DATE BETWEEN start_date AND end_date) AS sedang_berjalan
       FROM wfa_assignments
       WHERE user_id = $1 AND end_date >= CURRENT_DATE - INTERVAL '90 days'
       ORDER BY start_date DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(hasil.rows);
  } catch (err) {
    next(err);
  }
}

// POST /api/wfa -- admin tetapkan WFA untuk seorang pegawai
async function buatWfa(req, res, next) {
  try {
    const { user_id, start_date, end_date, note } = req.body;

    if (!user_id || !POLA_TANGGAL.test(start_date || '') || !POLA_TANGGAL.test(end_date || '')) {
      return res.status(400).json({ message: 'Pegawai, tanggal mulai, dan tanggal selesai wajib diisi.' });
    }
    if (end_date < start_date) {
      return res.status(400).json({ message: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' });
    }

    const pegawai = await query(
      `SELECT id, name FROM users WHERE id = $1 AND role = 'staff' AND is_active = TRUE`,
      [Number(user_id)]
    );
    if (pegawai.rows.length === 0) {
      return res.status(404).json({ message: 'Pegawai tidak ditemukan atau sudah tidak aktif.' });
    }

    // Diperiksa di sini supaya pesannya jelas; database tetap punya
    // exclusion constraint sebagai penjaga terakhir kalau dua admin
    // menyimpan bersamaan.
    const bentrok = await query(
      `SELECT to_char(start_date, 'YYYY-MM-DD') AS s, to_char(end_date, 'YYYY-MM-DD') AS e
       FROM wfa_assignments
       WHERE user_id = $1 AND daterange(start_date, end_date, '[]') && daterange($2::date, $3::date, '[]')
       LIMIT 1`,
      [Number(user_id), start_date, end_date]
    );
    if (bentrok.rows.length > 0) {
      const b = bentrok.rows[0];
      return res.status(409).json({
        message: `${pegawai.rows[0].name} sudah punya penetapan WFA ${b.s} s/d ${b.e} yang bertabrakan dengan rentang ini.`,
      });
    }

    const hasil = await query(
      `INSERT INTO wfa_assignments (user_id, start_date, end_date, note, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, to_char(start_date, 'YYYY-MM-DD') AS start_date,
                 to_char(end_date, 'YYYY-MM-DD') AS end_date, note`,
      [Number(user_id), start_date, end_date, note?.trim() || null, req.user.id]
    );

    // Absensi yang sudah tercatat di rentang itu ikut ditandai. Admin sering
    // menetapkan WFA setelah harinya lewat (mis. menyusul surat tugas), dan
    // catatan yang sudah ada tidak boleh tertinggal sebagai WFO.
    const susulan = await query(
      `UPDATE attendance SET work_mode = 'wfa'
       WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND work_mode <> 'wfa'`,
      [Number(user_id), start_date, end_date]
    );

    res.status(201).json({
      message: `WFA ${pegawai.rows[0].name} ditetapkan.`
        + (susulan.rowCount > 0 ? ` ${susulan.rowCount} catatan absensi yang sudah ada ikut ditandai WFA.` : ''),
      wfa: hasil.rows[0],
    });
  } catch (err) {
    // Exclusion constraint di database menolak rentang bertabrakan.
    if (err.code === '23P01') {
      return res.status(409).json({ message: 'Rentang WFA bertabrakan dengan penetapan lain untuk pegawai ini.' });
    }
    next(err);
  }
}

// DELETE /api/wfa/:id -- admin batalkan penetapan WFA
async function hapusWfa(req, res, next) {
  try {
    const lama = await query(
      `SELECT w.user_id, to_char(w.start_date, 'YYYY-MM-DD') AS s,
              to_char(w.end_date, 'YYYY-MM-DD') AS e, u.name
       FROM wfa_assignments w JOIN users u ON w.user_id = u.id
       WHERE w.id = $1`,
      [req.params.id]
    );
    if (lama.rows.length === 0) {
      return res.status(404).json({ message: 'Penetapan WFA tidak ditemukan.' });
    }
    const w = lama.rows[0];

    await query('DELETE FROM wfa_assignments WHERE id = $1', [req.params.id]);

    // Kembalikan penandaan absensi ke WFO, kecuali tanggalnya masih tercakup
    // penetapan WFA lain yang belum dihapus.
    const pulih = await query(
      `UPDATE attendance a SET work_mode = 'wfo'
       WHERE a.user_id = $1 AND a.date BETWEEN $2 AND $3 AND a.work_mode = 'wfa'
         AND NOT EXISTS (
           SELECT 1 FROM wfa_assignments x
           WHERE x.user_id = a.user_id AND a.date BETWEEN x.start_date AND x.end_date
         )`,
      [w.user_id, w.s, w.e]
    );

    res.json({
      message: `Penetapan WFA ${w.name} (${w.s} s/d ${w.e}) dibatalkan.`
        + (pulih.rowCount > 0 ? ` ${pulih.rowCount} catatan absensi kembali ditandai WFO.` : ''),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { wfaBerlaku, getSemuaWfa, getWfaSaya, buatWfa, hapusWfa };
