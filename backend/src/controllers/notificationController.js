const { query } = require('../config/db');
const { transporter, fromAddress } = require('../config/mailer');
const { sendPushNotifications } = require('../utils/pushNotification');
const { todayLocal } = require('../utils/date');

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// POST /api/notifications/low-attendance -- admin kirim email peringatan
// ke semua pegawai dengan attendance rate di bawah ambang batas bulan ini.
// Body opsional: { threshold: 80, month, year }
// Bisa juga dipanggil terjadwal dari cron VPS:
//   curl -X POST -H "Authorization: Bearer <token-admin>" .../api/notifications/low-attendance
async function sendLowAttendanceWarning(req, res, next) {
  try {
    if (!transporter) {
      return res.status(503).json({
        message: 'Notifikasi email belum dikonfigurasi. Isi kredensial SMTP di .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).',
      });
    }

    const threshold = Number(req.body?.threshold) || 80;
    const month = Number(req.body?.month) || new Date().getMonth() + 1;
    const year = Number(req.body?.year) || new Date().getFullYear();

    // Pegawai aktif dengan attendance rate di bawah ambang (minimal punya 1 record)
    const result = await query(
      `SELECT u.id, u.name, u.email, u.push_token,
              COUNT(a.*) FILTER (WHERE a.status IN ('hadir','terlambat')) AS hadir,
              COUNT(a.*) AS total_record
       FROM users u
       LEFT JOIN attendance a ON a.user_id = u.id
         AND EXTRACT(MONTH FROM a.date) = $1
         AND EXTRACT(YEAR FROM a.date) = $2
       WHERE u.role != 'admin' AND u.is_active = TRUE
       GROUP BY u.id, u.name, u.email
       HAVING COUNT(a.*) > 0
          AND (COUNT(a.*) FILTER (WHERE a.status IN ('hadir','terlambat'))::float / COUNT(a.*)) * 100 < $3`,
      [month, year, threshold]
    );

    const periode = `${NAMA_BULAN[month - 1]} ${year}`;
    const terkirim = [];
    const gagal = [];

    for (const row of result.rows) {
      const rate = ((row.hadir / row.total_record) * 100).toFixed(1);
      try {
        await transporter.sendMail({
          from: fromAddress,
          to: row.email,
          subject: `Peringatan Kehadiran — ${periode}`,
          text:
            `Halo ${row.name},\n\n` +
            `Tingkat kehadiran Anda pada periode ${periode} tercatat ${rate}%, ` +
            `di bawah batas minimum ${threshold}%.\n\n` +
            `Mohon tingkatkan kedisiplinan kehadiran. Jika ada kendala, ` +
            `silakan ajukan izin melalui aplikasi atau hubungi admin/HR.\n\n` +
            `Email ini dikirim otomatis oleh sistem Cloud Absen.`,
        });
        terkirim.push({ id: row.id, name: row.name, email: row.email, attendance_rate: rate });
      } catch (mailErr) {
        console.error(`Gagal kirim email ke ${row.email}:`, mailErr.message);
        gagal.push({ id: row.id, name: row.name, email: row.email });
      }

      // Push notification (best-effort, terpisah dari status pengiriman email)
      if (row.push_token) {
        try {
          await sendPushNotifications([
            {
              to: row.push_token,
              title: 'Peringatan Kehadiran',
              body: `Tingkat kehadiran Anda periode ${periode} tercatat ${rate}%, di bawah batas minimum ${threshold}%.`,
              data: { type: 'low_attendance', periode },
            },
          ]);
        } catch (pushErr) {
          console.error(`Gagal kirim push ke user ${row.id}:`, pushErr.message);
        }
      }
    }

    // Catat aksi untuk audit
    await query(
      `INSERT INTO admin_logs (admin_id, action, detail) VALUES ($1, 'send_low_attendance_warning', $2)`,
      [req.user.id, `Periode ${periode}, ambang ${threshold}%: ${terkirim.length} terkirim, ${gagal.length} gagal`]
    );

    res.json({
      message: `Peringatan terkirim ke ${terkirim.length} pegawai${gagal.length > 0 ? `, ${gagal.length} gagal` : ''}.`,
      data: { terkirim, gagal, threshold, periode },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/notifications/pending-checkin -- daftar pegawai yang belum absen
// masuk hari ini, berikut apakah HP-nya bisa dikirimi notifikasi. Dipakai
// admin untuk memilih siapa yang mau diingatkan, bukan menembak semuanya.
async function getBelumCheckin(req, res, next) {
  try {
    const today = todayLocal();
    const hasil = await query(
      `SELECT u.id, u.name, u.avatar_url, d.name AS department,
              (u.push_token IS NOT NULL) AS bisa_dikirimi,
              s.name AS shift_name, s.start_time AS shift_start
       FROM users u
       LEFT JOIN attendance a ON a.user_id = u.id AND a.date = $1
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN shifts s ON u.shift_id = s.id
       WHERE u.role != 'admin' AND u.is_active = TRUE
         AND (a.id IS NULL OR a.check_in_time IS NULL)
       ORDER BY u.name ASC`,
      [today]
    );
    res.json(hasil.rows);
  } catch (err) {
    next(err);
  }
}

// POST /api/notifications/checkin-reminder -- admin kirim push reminder ke
// pegawai yang belum check-in hari ini.
//
// Body semuanya opsional:
//   user_ids : kirim hanya ke pegawai tertentu. Tanpa ini, dikirim ke semua
//              yang belum absen -- bentuk inilah yang dipakai cron harian.
//   message  : ganti isi pesannya, mis. untuk pengingat yang lebih personal.
async function sendCheckinReminder(req, res, next) {
  try {
    const today = todayLocal();
    const { user_ids, message: pesanKustom } = req.body || {};

    // Daftar id harus benar-benar berupa angka sebelum masuk query.
    let idTerpilih = null;
    if (user_ids !== undefined && user_ids !== null) {
      if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ message: 'user_ids harus berupa daftar id pegawai yang tidak kosong.' });
      }
      idTerpilih = user_ids.map(Number);
      if (idTerpilih.some((n) => !Number.isInteger(n) || n <= 0)) {
        return res.status(400).json({ message: 'user_ids berisi id yang tidak valid.' });
      }
    }

    if (pesanKustom !== undefined && pesanKustom !== null && String(pesanKustom).length > 300) {
      return res.status(400).json({ message: 'Pesan pengingat maksimal 300 karakter.' });
    }

    // Sengaja TIDAK memfilter push_token di SQL: pegawai yang belum absen tapi
    // belum pernah login di mobile app tetap perlu dilaporkan ke admin, supaya
    // "tidak ada yang perlu diingatkan" tidak rancu dengan "tidak ada yang bisa dikirimi".
    //
    // Penyaringan id juga dilakukan di SQL, bukan di JavaScript: admin yang
    // mengirim id pegawai yang ternyata sudah absen tidak boleh membuat
    // pegawai itu ikut diingatkan.
    const params = [today];
    let filterId = '';
    if (idTerpilih) {
      params.push(idTerpilih);
      filterId = `AND u.id = ANY($${params.length}::int[])`;
    }

    const result = await query(
      `SELECT u.id, u.name, u.push_token
       FROM users u
       LEFT JOIN attendance a ON a.user_id = u.id AND a.date = $1
       WHERE u.role != 'admin' AND u.is_active = TRUE
         AND (a.id IS NULL OR a.check_in_time IS NULL)
         ${filterId}`,
      params
    );

    const belumAbsen = result.rows;
    if (belumAbsen.length === 0) {
      return res.json({
        message: idTerpilih
          ? 'Pegawai yang dipilih ternyata sudah absen masuk hari ini.'
          : 'Semua pegawai sudah absen masuk hari ini.',
        data: { belum_absen: 0, terkirim: 0 },
      });
    }

    const punyaToken = belumAbsen.filter((r) => r.push_token);
    const tanpaToken = belumAbsen.length - punyaToken.length;

    let sent = 0;
    let errorKirim = null;
    if (punyaToken.length > 0) {
      const hasil = await sendPushNotifications(
        punyaToken.map((row) => ({
          to: row.push_token,
          title: 'Pengingat Absensi',
          body: pesanKustom
            ? String(pesanKustom).trim()
            : `Halo ${row.name}, jangan lupa check-in hari ini.`,
          data: { type: 'checkin_reminder' },
        }))
      );
      sent = hasil.sent;
      errorKirim = hasil.error;
    }

    // Susun pesan yang membedakan tiap situasi, bukan sekadar angka 0
    let message = idTerpilih
      ? `${belumAbsen.length} pegawai terpilih belum absen. `
      : `${belumAbsen.length} pegawai belum absen. `;
    if (sent > 0) {
      message += `Pengingat terkirim ke ${sent} pegawai.`;
    } else if (punyaToken.length === 0) {
      message += 'Belum ada yang bisa dikirimi notifikasi — pegawai perlu login dulu di aplikasi mobile.';
    } else {
      message += `Pengiriman ke ${punyaToken.length} pegawai gagal: ${errorKirim}.`;
    }
    if (sent > 0 && tanpaToken > 0) {
      message += ` ${tanpaToken} pegawai lain belum memakai aplikasi mobile.`;
    }

    await query(
      `INSERT INTO admin_logs (admin_id, action, detail) VALUES ($1, 'send_checkin_reminder', $2)`,
      [
        req.user.id,
        `${belumAbsen.length} belum absen, ${sent} terkirim (${today})`
          + (idTerpilih ? ` -- dipilih manual: ${belumAbsen.map((r) => r.name).join(', ')}` : ' -- semua')
          + (pesanKustom ? ' -- pesan kustom' : ''),
      ]
    );

    res.json({
      message,
      data: { belum_absen: belumAbsen.length, terkirim: sent, tanpa_token: tanpaToken },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendLowAttendanceWarning, sendCheckinReminder, getBelumCheckin };
