const { query } = require('../config/db');
const { transporter, fromAddress } = require('../config/mailer');

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
      `SELECT u.id, u.name, u.email,
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

module.exports = { sendLowAttendanceWarning };
