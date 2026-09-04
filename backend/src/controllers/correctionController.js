// ============================================================
// Koreksi absensi.
//
// Dua jalur yang bermuara ke tempat yang sama:
//   - admin mengubah langsung sebuah catatan absensi (adminEditAbsensi)
//   - pegawai mengajukan koreksi, admin menyetujui (reviewKoreksi)
//
// Keduanya menulis jejak audit lewat catatPerubahan(). Admin memang
// berwenang penuh atas data absensi, tapi kewenangan tanpa jejak
// berbahaya: saat ada sengketa kehadiran, harus bisa ditunjukkan siapa
// mengubah apa, kapan, dan atas dasar apa.
// ============================================================
const { query, pool } = require('../config/db');
const { jendelaAbsen, shiftPegawai } = require('../utils/shiftWindow');
const { batasiPerPegawai, bolehAksesPegawai } = require('../utils/lingkupProyek');
const { kirimNotifikasi, penyeliaPegawai } = require('../utils/notifikasi');

const STATUS_VALID = ['hadir', 'terlambat', 'izin', 'alpha'];

// Bandingkan nilai lama & baru, tulis satu baris audit untuk tiap kolom
// yang benar-benar berubah. Dipanggil di dalam transaksi.
async function catatPerubahan(klien, { attendanceId, adminId, sebelum, sesudah, note }) {
  const kolom = ['check_in_time', 'check_out_time', 'status', 'reason'];
  let jumlah = 0;

  for (const k of kolom) {
    const lama = sebelum[k] === null || sebelum[k] === undefined ? null : String(sebelum[k]);
    const baru = sesudah[k] === null || sesudah[k] === undefined ? null : String(sesudah[k]);
    if (lama === baru) continue;

    await klien.query(
      `INSERT INTO attendance_edits (attendance_id, edited_by, field, old_value, new_value, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [attendanceId, adminId, k, lama, baru, note || null]
    );
    jumlah++;
  }
  return jumlah;
}

// "08:15" atau "08:15:00" digabung dengan tanggal absensi jadi timestamp.
// Mengembalikan null untuk nilai kosong, dan undefined kalau bentuknya salah.
function keStempel(tanggal, jam) {
  if (jam === null || jam === '') return null;
  if (jam === undefined) return undefined;
  const cocok = String(jam).match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!cocok) return undefined;
  return `${tanggal} ${cocok[1]}:${cocok[2]}:${cocok[3] || '00'}`;
}

// ------------------------------------------------------------
// Admin: ubah langsung satu catatan absensi
// ------------------------------------------------------------

// PUT /api/attendance/:id/edit
async function adminEditAbsensi(req, res, next) {
  const klien = await pool.connect();
  try {
    const { check_in_time, check_out_time, status, reason, note } = req.body;

    if (status !== undefined && !STATUS_VALID.includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid.' });
    }
    if (!note || !String(note).trim()) {
      return res.status(400).json({ message: 'Alasan perubahan wajib diisi untuk jejak audit.' });
    }

    await klien.query('BEGIN');

    const lama = await klien.query(
      `SELECT a.*, u.name FROM attendance a JOIN users u ON a.user_id = u.id
       WHERE a.id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (lama.rows.length === 0) {
      await klien.query('ROLLBACK');
      return res.status(404).json({ message: 'Data absensi tidak ditemukan.' });
    }
    const sebelum = lama.rows[0];
    const tanggal = sebelum.date;

    const masuk = keStempel(tanggal, check_in_time);
    const pulang = keStempel(tanggal, check_out_time);
    if (masuk === undefined && check_in_time !== undefined) {
      await klien.query('ROLLBACK');
      return res.status(400).json({ message: 'Format jam masuk harus HH:MM.' });
    }
    if (pulang === undefined && check_out_time !== undefined) {
      await klien.query('ROLLBACK');
      return res.status(400).json({ message: 'Format jam pulang harus HH:MM.' });
    }

    // Jam pulang lebih awal dari jam masuk hanya masuk akal untuk shift
    // yang menyeberang tengah malam. Di luar itu hampir pasti salah ketik.
    const masukFinal = check_in_time === undefined ? sebelum.check_in_time : masuk;
    const pulangFinal = check_out_time === undefined ? sebelum.check_out_time : pulang;
    if (masukFinal && pulangFinal && new Date(pulangFinal) <= new Date(masukFinal)) {
      const shift = jendelaAbsen(await shiftPegawai(query, sebelum.user_id)).shift;
      if (!shift.lintas_hari) {
        await klien.query('ROLLBACK');
        return res.status(400).json({
          message: 'Jam pulang harus setelah jam masuk. Untuk shift yang menyeberang tengah malam, ubah shift pegawai dulu.',
        });
      }
    }

    const hasil = await klien.query(
      `UPDATE attendance
       SET check_in_time  = COALESCE($1::timestamp, CASE WHEN $2 THEN NULL ELSE check_in_time END),
           check_out_time = COALESCE($3::timestamp, CASE WHEN $4 THEN NULL ELSE check_out_time END),
           status         = COALESCE($5, status),
           reason         = CASE WHEN $6 THEN $7 ELSE reason END
       WHERE id = $8
       RETURNING *`,
      [
        masuk ?? null, check_in_time !== undefined,
        pulang ?? null, check_out_time !== undefined,
        status ?? null,
        reason !== undefined, reason ?? null,
        req.params.id,
      ]
    );
    const sesudah = hasil.rows[0];

    const jumlah = await catatPerubahan(klien, {
      attendanceId: sebelum.id,
      adminId: req.user.id,
      sebelum,
      sesudah,
      note: String(note).trim(),
    });

    await klien.query('COMMIT');
    res.json({
      message: jumlah === 0
        ? 'Tidak ada perubahan yang perlu disimpan.'
        : `Absensi ${sebelum.name} berhasil diperbarui (${jumlah} perubahan dicatat).`,
      attendance: sesudah,
      perubahan: jumlah,
    });
  } catch (err) {
    await klien.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    klien.release();
  }
}

// GET /api/attendance/:id/edits -- riwayat perubahan satu catatan absensi
async function getRiwayatEdit(req, res, next) {
  try {
    const hasil = await query(
      `SELECT e.id, e.field, e.old_value, e.new_value, e.note, e.created_at,
              u.name AS edited_by_name
       FROM attendance_edits e
       LEFT JOIN users u ON e.edited_by = u.id
       WHERE e.attendance_id = $1
       ORDER BY e.created_at DESC, e.id DESC`,
      [req.params.id]
    );
    res.json(hasil.rows);
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// Pegawai: ajukan koreksi
// ------------------------------------------------------------

// POST /api/corrections
async function ajukanKoreksi(req, res, next) {
  try {
    const { date, requested_check_in, requested_check_out, reason } = req.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'Tanggal wajib diisi (format YYYY-MM-DD).' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: 'Alasan koreksi wajib diisi.' });
    }
    if (!requested_check_in && !requested_check_out) {
      return res.status(400).json({ message: 'Isi minimal satu usulan jam (masuk atau pulang).' });
    }
    for (const jam of [requested_check_in, requested_check_out]) {
      if (jam && !/^\d{2}:\d{2}(:\d{2})?$/.test(jam)) {
        return res.status(400).json({ message: 'Format jam harus HH:MM.' });
      }
    }

    // Tanggal masa depan tidak bisa dikoreksi -- absennya belum terjadi.
    const hariIni = new Date();
    const batas = `${hariIni.getFullYear()}-${String(hariIni.getMonth() + 1).padStart(2, '0')}-${String(hariIni.getDate()).padStart(2, '0')}`;
    if (date > batas) {
      return res.status(400).json({ message: 'Tidak bisa mengajukan koreksi untuk tanggal yang belum lewat.' });
    }

    const adaPending = await query(
      `SELECT id FROM correction_requests
       WHERE user_id = $1 AND date = $2 AND status = 'pending'`,
      [req.user.id, date]
    );
    if (adaPending.rows.length > 0) {
      return res.status(409).json({
        message: 'Sudah ada pengajuan koreksi untuk tanggal ini yang masih menunggu keputusan admin.',
      });
    }

    const hasil = await query(
      `INSERT INTO correction_requests (user_id, date, requested_check_in, requested_check_out, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, to_char(date, 'YYYY-MM-DD') AS date, requested_check_in,
                 requested_check_out, reason, status, created_at`,
      [req.user.id, date, requested_check_in || null, requested_check_out || null, String(reason).trim()]
    );

    try {
      const pengaju = await query('SELECT name FROM users WHERE id = $1', [req.user.id]);
      await kirimNotifikasi({
        userIds: await penyeliaPegawai(req.user.id),
        jenis: 'koreksi_baru',
        judul: 'Pengajuan koreksi absensi',
        pesan: `${pengaju.rows[0]?.name || 'Seorang pegawai'} mengajukan koreksi untuk ${date}.`,
        tautan: '/admin/leaves?tab=koreksi',
      });
    } catch (e) {
      console.error('Gagal membuat pemberitahuan koreksi baru:', e.message);
    }

    res.status(201).json({ message: 'Pengajuan koreksi terkirim.', correction: hasil.rows[0] });
  } catch (err) {
    next(err);
  }
}

// GET /api/corrections/me
async function getKoreksiSaya(req, res, next) {
  try {
    const hasil = await query(
      `SELECT c.id, to_char(c.date, 'YYYY-MM-DD') AS date,
              c.requested_check_in, c.requested_check_out, c.reason,
              c.status, c.admin_note, c.reviewed_at, u.name AS reviewed_by_name
       FROM correction_requests c
       LEFT JOIN users u ON c.reviewed_by = u.id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(hasil.rows);
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// Admin: tinjau pengajuan koreksi
// ------------------------------------------------------------

// GET /api/corrections?status=pending
async function getSemuaKoreksi(req, res, next) {
  try {
    const { status } = req.query;
    const kondisi = [];
    const params = [];
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      params.push(status);
      kondisi.push(`c.status = $${params.length}`);
    }

    // Konsultan hanya meninjau pengajuan pegawai di proyeknya. Balas kosong
    // kalau dia belum dipasangkan ke proyek mana pun -- syarat yang tidak
    // jadi ditambahkan berarti seluruh pengajuan terbuka.
    if (!(await batasiPerPegawai(req.user, kondisi, params))) return res.json([]);

    const hasil = await query(
      `SELECT c.id, to_char(c.date, 'YYYY-MM-DD') AS date,
              c.requested_check_in, c.requested_check_out, c.reason,
              c.status, c.admin_note, c.reviewed_at, c.created_at,
              u.id AS user_id, u.name, u.avatar_url, pj.name AS project_name,
              a.check_in_time, a.check_out_time, a.status AS status_absensi
       FROM correction_requests c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN projects pj ON u.project_id = pj.id
       LEFT JOIN attendance a ON a.user_id = c.user_id AND a.date = c.date
       ${kondisi.length ? `WHERE ${kondisi.join(' AND ')}` : ''}
       ORDER BY c.status = 'pending' DESC, c.created_at DESC
       LIMIT 200`,
      params
    );
    res.json(hasil.rows);
  } catch (err) {
    next(err);
  }
}

// PUT /api/corrections/:id/review -- setujui atau tolak
async function reviewKoreksi(req, res, next) {
  const klien = await pool.connect();
  try {
    const { status, admin_note } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Keputusan harus approved atau rejected.' });
    }

    // Konsultan hanya boleh memutuskan pengajuan pegawai di proyeknya.
    // Alamat ini menerima nomor dari luar dan tidak melewati penyaring
    // daftar mana pun, jadi kepemilikannya harus diperiksa di sini.
    const pemilik = await query('SELECT user_id FROM correction_requests WHERE id = $1', [req.params.id]);
    if (pemilik.rows.length === 0) {
      return res.status(404).json({ message: 'Pengajuan tidak ditemukan.' });
    }
    if (!(await bolehAksesPegawai(req.user, pemilik.rows[0].user_id))) {
      return res.status(403).json({ message: 'Pengajuan ini bukan dari pegawai di proyek Anda.' });
    }

    await klien.query('BEGIN');

    const ajuan = await klien.query(
      `SELECT c.*, to_char(c.date, 'YYYY-MM-DD') AS tanggal, u.name
       FROM correction_requests c JOIN users u ON c.user_id = u.id
       WHERE c.id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (ajuan.rows.length === 0) {
      await klien.query('ROLLBACK');
      return res.status(404).json({ message: 'Pengajuan koreksi tidak ditemukan.' });
    }
    const k = ajuan.rows[0];
    if (k.status !== 'pending') {
      await klien.query('ROLLBACK');
      return res.status(409).json({ message: 'Pengajuan ini sudah pernah diputuskan.' });
    }

    await klien.query(
      `UPDATE correction_requests
       SET status = $1, admin_note = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4`,
      [status, admin_note || null, req.user.id, k.id]
    );

    let absensi = null;
    if (status === 'approved') {
      const masuk = keStempel(k.tanggal, k.requested_check_in ? String(k.requested_check_in).slice(0, 8) : undefined);
      const pulang = keStempel(k.tanggal, k.requested_check_out ? String(k.requested_check_out).slice(0, 8) : undefined);

      const lama = await klien.query(
        'SELECT * FROM attendance WHERE user_id = $1 AND date = $2 FOR UPDATE',
        [k.user_id, k.tanggal]
      );
      const sebelum = lama.rows[0] || {};

      // Hari yang catatannya belum ada (lupa absen masuk sama sekali)
      // dibuatkan barisnya. Statusnya "hadir": koreksi yang disetujui
      // admin berarti pegawainya memang masuk kerja.
      const hasil = sebelum.id
        ? await klien.query(
            `UPDATE attendance
             SET check_in_time  = COALESCE($1::timestamp, check_in_time),
                 check_out_time = COALESCE($2::timestamp, check_out_time),
                 status = CASE WHEN status = 'alpha' THEN 'hadir' ELSE status END
             WHERE id = $3 RETURNING *`,
            [masuk ?? null, pulang ?? null, sebelum.id]
          )
        : await klien.query(
            `INSERT INTO attendance (user_id, date, check_in_time, check_out_time, status)
             VALUES ($1, $2, $3::timestamp, $4::timestamp, 'hadir')
             RETURNING *`,
            [k.user_id, k.tanggal, masuk ?? null, pulang ?? null]
          );
      absensi = hasil.rows[0];

      // Koreksi yang disetujui ikut masuk jejak audit yang sama dengan
      // perubahan langsung oleh admin -- satu tempat untuk semua riwayat.
      await catatPerubahan(klien, {
        attendanceId: absensi.id,
        adminId: req.user.id,
        sebelum,
        sesudah: absensi,
        note: `Koreksi #${k.id} disetujui: ${k.reason}`,
      });
    }

    await klien.query('COMMIT');

    try {
      await kirimNotifikasi({
        userIds: [k.user_id],
        jenis: 'koreksi_diputus',
        judul: status === 'approved' ? 'Koreksi absensi disetujui' : 'Koreksi absensi ditolak',
        pesan: `Koreksi untuk ${k.tanggal} `
          + `${status === 'approved' ? 'disetujui' : 'ditolak'}.`
          + (admin_note ? ` Catatan: ${admin_note}` : ''),
        tautan: '/history',
      });
    } catch (e) {
      console.error('Gagal membuat pemberitahuan hasil koreksi:', e.message);
    }

    res.json({
      message: status === 'approved'
        ? `Koreksi ${k.name} untuk ${k.tanggal} disetujui.`
        : `Koreksi ${k.name} untuk ${k.tanggal} ditolak.`,
      attendance: absensi,
    });
  } catch (err) {
    await klien.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    klien.release();
  }
}

module.exports = {
  adminEditAbsensi,
  getRiwayatEdit,
  ajukanKoreksi,
  getKoreksiSaya,
  getSemuaKoreksi,
  reviewKoreksi,
};
