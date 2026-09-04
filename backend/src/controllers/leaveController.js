const { pool, query } = require('../config/db');
const { kirimNotifikasi, penyeliaPegawai } = require('../utils/notifikasi');
const { uploadDokumenIzin } = require('../utils/uploadPhoto');
const { batasiPerPegawai, bolehAksesPegawai } = require('../utils/lingkupProyek');

// Jenis pengajuan. Ketiganya berujung pada status absensi 'izin' -- yang
// dibedakan hanya keterangannya untuk HRD. Mengubah daftar status absensi
// akan merusak seluruh rumus attendance rate dan laporan yang sudah ada,
// sementara untuk perhitungan kehadiran ketiganya memang sama saja.
const JENIS_VALID = ['izin', 'sakit', 'cuti'];

const LABEL_JENIS = { izin: 'Izin', sakit: 'Sakit', cuti: 'Cuti' };

// POST /api/leaves -- pegawai mengajukan izin/sakit/cuti
async function createLeave(req, res, next) {
  try {
    const userId = req.user.id;
    const { start_date, end_date, reason } = req.body;
    const type = req.body.type || 'izin';

    if (!start_date || !end_date || !reason || !reason.trim()) {
      return res.status(400).json({ message: 'Tanggal mulai, tanggal selesai, dan alasan wajib diisi.' });
    }
    if (!JENIS_VALID.includes(type)) {
      return res.status(400).json({ message: 'Jenis pengajuan harus izin, sakit, atau cuti.' });
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

    // Tanggal yang sudah punya catatan absensi (sudah absen, izin, atau alpha)
    // dianggap "tidak aktif" untuk diajukan izin -- tolak total, bukan sekadar peringatan.
    // to_char di SQL supaya tanggal dikirim sebagai teks apa adanya, bukan
    // objek Date JS -- menghindari pergeseran tanggal akibat konversi timezone.
    const sudahAbsen = await query(
      `SELECT to_char(date, 'YYYY-MM-DD') AS date FROM attendance
       WHERE user_id = $1 AND date BETWEEN $2 AND $3
       ORDER BY date LIMIT 1`,
      [userId, start_date, end_date]
    );
    if (sudahAbsen.rows.length > 0) {
      return res.status(409).json({
        message: `Tanggal ${sudahAbsen.rows[0].date} sudah punya catatan absensi, tidak bisa diajukan izin.`,
      });
    }

    // Lampiran opsional. Sengaja diunggah SETELAH semua validasi lolos --
    // menulis berkas ke disk untuk pengajuan yang ujungnya ditolak hanya
    // meninggalkan sampah di server.
    let dokumenUrl = null;
    let dokumenNama = null;
    if (req.file) {
      dokumenUrl = await uploadDokumenIzin(req.file.buffer, {
        userId,
        userName: req.user.name,
        jenis: type,
        mimetype: req.file.mimetype,
      });
      dokumenNama = req.file.originalname?.slice(0, 255) || null;
    }

    const result = await query(
      `INSERT INTO leave_requests (user_id, type, start_date, end_date, reason, document_url, document_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, type, to_char(start_date, 'YYYY-MM-DD') AS start_date,
                 to_char(end_date, 'YYYY-MM-DD') AS end_date, reason, status,
                 document_url, document_name, created_at`,
      [userId, type, start_date, end_date, reason.trim(), dokumenUrl, dokumenNama]
    );

    // Nama pengaju dan konsultan penanggung jawab proyeknya. Dipakai dua
    // kali di bawah: untuk isi pemberitahuan, dan untuk memberi tahu
    // pegawainya siapa yang sekarang ditunggu.
    const pengaju = await query(
      `SELECT u.name, k.name AS konsultan
       FROM users u
       LEFT JOIN projects p ON u.project_id = p.id
       LEFT JOIN users k ON k.id = p.consultant_id AND k.is_active = TRUE
       WHERE u.id = $1`,
      [userId]
    );
    const nama = pengaju.rows[0]?.name || 'Seorang pegawai';
    const konsultan = pengaju.rows[0]?.konsultan || null;

    // Beri tahu yang berwenang memutuskan. Tanpa ini pengajuan masuk tanpa
    // ada yang tahu, sampai seseorang kebetulan membuka menu Pengajuan.
    // Kegagalannya tidak boleh menggagalkan pengajuannya -- pegawai sudah
    // mengirim, dan itu yang penting.
    try {
      await kirimNotifikasi({
        userIds: await penyeliaPegawai(userId),
        jenis: 'pengajuan_baru',
        judul: `Pengajuan ${LABEL_JENIS[type].toLowerCase()} baru`,
        pesan: `${nama} mengajukan ${LABEL_JENIS[type].toLowerCase()} `
          + `${start_date}${end_date !== start_date ? ` s/d ${end_date}` : ''}.`,
        tautan: '/admin/leaves',
      });
    } catch (e) {
      console.error('Gagal membuat pemberitahuan pengajuan baru:', e.message);
    }

    // Yang memutuskan bukan lagi "admin" saja. Konsultan penanggung jawab
    // proyeknyalah yang biasanya memutuskan, dan dinas tetap bisa
    // bertindak bila ia berhalangan -- jadi keduanya disebut, dengan
    // konsultannya dinamai supaya pegawai tahu ke siapa harus menanyakan.
    // Pegawai yang belum ditempatkan di proyek mana pun hanya menunggu
    // dinas; menyebut konsultan di situ hanya membingungkan.
    res.status(201).json({
      message: `Pengajuan ${LABEL_JENIS[type].toLowerCase()} berhasil dikirim. `
        + (konsultan
          ? `Menunggu persetujuan ${konsultan} atau dinas.`
          : 'Menunggu persetujuan dinas.'),
      leave: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/leaves/me -- riwayat pengajuan izin milik pegawai sendiri
async function getMyLeaves(req, res, next) {
  try {
    const result = await query(
      `SELECT l.id, l.type,
              to_char(l.start_date, 'YYYY-MM-DD') AS start_date,
              to_char(l.end_date, 'YYYY-MM-DD') AS end_date,
              l.reason, l.status, l.admin_note, l.created_at, l.reviewed_at,
              l.document_url, l.document_name,
              r.name AS reviewed_by_name, r.role AS reviewed_by_role
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
    const { status, type } = req.query;
    const validStatus = ['pending', 'approved', 'rejected'];
    const filterStatus = validStatus.includes(status) ? status : null;
    const filterJenis = JENIS_VALID.includes(type) ? type : null;

    const kondisi = [];
    const params = [];
    if (filterStatus) { params.push(filterStatus); kondisi.push(`l.status = $${params.length}`); }
    if (filterJenis) { params.push(filterJenis); kondisi.push(`l.type = $${params.length}`); }

    // Konsultan hanya meninjau pengajuan pegawai di proyeknya. Balas kosong
    // kalau dia belum dipasangkan ke proyek mana pun -- syarat yang tidak
    // jadi ditambahkan berarti seluruh pengajuan terbuka.
    if (!(await batasiPerPegawai(req.user, kondisi, params))) return res.json([]);

    const result = await query(
      `SELECT l.id, l.type,
              to_char(l.start_date, 'YYYY-MM-DD') AS start_date,
              to_char(l.end_date, 'YYYY-MM-DD') AS end_date,
              l.reason, l.status, l.admin_note, l.created_at, l.reviewed_at,
              l.document_url, l.document_name,
              u.id AS user_id, u.name, u.avatar_url, pj.name AS project_name,
              r.name AS reviewed_by_name, r.role AS reviewed_by_role,
              -- Penanggung jawab proyeknya. Dinas perlu tahu siapa yang
              -- semestinya memutuskan sebelum ia memutuskan sendiri:
              -- konsultanlah yang tahu apakah pekerjaan lapangan bisa
              -- ditinggal hari itu, dinas tidak.
              k.id AS consultant_id, k.name AS consultant_name
       FROM leave_requests l
       JOIN users u ON l.user_id = u.id
       LEFT JOIN projects pj ON u.project_id = pj.id
       LEFT JOIN users k ON pj.consultant_id = k.id
       LEFT JOIN users r ON l.reviewed_by = r.id
       ${kondisi.length ? `WHERE ${kondisi.join(' AND ')}` : ''}
       ORDER BY (l.status = 'pending') DESC, l.created_at DESC`,
      params
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

    // Konsultan hanya boleh memutuskan pengajuan pegawai di proyeknya.
    // Alamat ini menerima nomor dari luar dan tidak melewati penyaring
    // daftar mana pun, jadi kepemilikannya harus diperiksa di sini.
    const pemilik = await query('SELECT user_id FROM leave_requests WHERE id = $1', [req.params.id]);
    if (pemilik.rows.length === 0) {
      return res.status(404).json({ message: 'Pengajuan tidak ditemukan.' });
    }
    if (!(await bolehAksesPegawai(req.user, pemilik.rows[0].user_id))) {
      return res.status(403).json({ message: 'Pengajuan ini bukan dari pegawai di proyek Anda.' });
    }

    await client.query('BEGIN');

    const leaveResult = await client.query(
      `UPDATE leave_requests
       SET status = $1, admin_note = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4 AND status = 'pending'
       RETURNING id, user_id, type,
                 to_char(start_date, 'YYYY-MM-DD') AS start_date,
                 to_char(end_date, 'YYYY-MM-DD') AS end_date,
                 reason, status`,
      [status, admin_note || null, req.user.id, req.params.id]
    );

    if (leaveResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Pengajuan tidak ditemukan atau sudah direview.' });
    }

    const leave = leaveResult.rows[0];

    if (status === 'approved') {
      // generate_series membuat satu baris attendance per tanggal izin.
      // WHERE di DO UPDATE mencegah izin menimpa hari yang sudah punya absensi
      // asli (sudah check-in) -- kalau tumpang tindih, absensi asli yang menang.
      await client.query(
        `INSERT INTO attendance (user_id, date, status, reason)
         SELECT $1, d::date, 'izin', $2
         FROM generate_series($3::date, $4::date, '1 day') AS d
         ON CONFLICT (user_id, date)
         DO UPDATE SET status = 'izin', reason = EXCLUDED.reason
         WHERE attendance.check_in_time IS NULL`,
        // Jenisnya ikut ditulis di keterangan absensi supaya laporan bulanan
        // bisa membedakan sakit dari cuti tanpa perlu menggabung tabel lain.
        [leave.user_id, `${LABEL_JENIS[leave.type]}: ${leave.reason}`, leave.start_date, leave.end_date]
      );
    }

    // Catat aksi admin untuk audit
    await client.query(
      `INSERT INTO admin_logs (admin_id, action, detail)
       VALUES ($1, $2, $3)`,
      [
        req.user.id,
        status === 'approved' ? 'approve_leave' : 'reject_leave',
        `Pengajuan ${leave.type} #${leave.id} (user ${leave.user_id}, ${leave.start_date} s/d ${leave.end_date})`,
      ]
    );

    await client.query('COMMIT');

    // Satu pintu: membuat baris pemberitahuan SEKALIGUS mengirim push.
    // Sebelumnya di sini hanya ada push, sehingga pegawai yang tidak memakai
    // aplikasi HP -- atau yang aplikasinya tertutup saat push dikirim --
    // tidak pernah tahu pengajuannya sudah diputus.
    try {
      await kirimNotifikasi({
        userIds: [leave.user_id],
        jenis: 'pengajuan_diputus',
        judul: status === 'approved'
          ? `Pengajuan ${LABEL_JENIS[leave.type]} disetujui`
          : `Pengajuan ${LABEL_JENIS[leave.type]} ditolak`,
        pesan: `${LABEL_JENIS[leave.type]} ${leave.start_date}`
          + `${leave.end_date !== leave.start_date ? ` s/d ${leave.end_date}` : ''} `
          + `${status === 'approved' ? 'disetujui' : 'ditolak'}.`
          + (admin_note ? ` Catatan: ${admin_note}` : ''),
        tautan: '/leaves',
      });
    } catch (e) {
      console.error('Gagal membuat pemberitahuan hasil pengajuan:', e.message);
    }

    res.json({
      message: status === 'approved'
        ? `Pengajuan ${LABEL_JENIS[leave.type].toLowerCase()} disetujui.`
        : `Pengajuan ${LABEL_JENIS[leave.type].toLowerCase()} ditolak.`,
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
