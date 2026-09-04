const { query } = require('../config/db');
const { transporter, fromAddress } = require('../config/mailer');
const { sendPushNotifications } = require('../utils/pushNotification');
const { todayLocal } = require('../utils/date');
const { jendelaSemuaPegawai } = require('../utils/shiftWindow');
const { hitungRate } = require('../utils/attendanceRate');
const { cekHariKerja } = require('../utils/workday');

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

    // Pegawai aktif dengan attendance rate di bawah ambang.
    //
    // Rumusnya HARUS sama dengan yang dipakai dashboard, statistik, dan
    // laporan: (hadir + terlambat) / (hadir + terlambat + alpha). Izin tidak
    // ikut menghitung -- izin yang disetujui bukan pelanggaran kehadiran.
    // Sebelumnya bagian ini memakai rumusnya sendiri dengan pembagi seluruh
    // catatan, sehingga pegawai yang banyak mengambil izin sah bisa ikut
    // dikirimi surat peringatan, dan angka di email berbeda dari angka yang
    // dilihat pegawai di aplikasinya.
    const result = await query(
      `SELECT u.id, u.name, u.email, u.push_token,
              COUNT(a.*) FILTER (WHERE a.status = 'hadir')     AS hadir,
              COUNT(a.*) FILTER (WHERE a.status = 'terlambat') AS terlambat,
              COUNT(a.*) FILTER (WHERE a.status = 'alpha')     AS alpha
       FROM users u
       LEFT JOIN attendance a ON a.user_id = u.id
         AND EXTRACT(MONTH FROM a.date) = $1
         AND EXTRACT(YEAR FROM a.date) = $2
       WHERE u.role = 'staff' AND u.is_active = TRUE
       GROUP BY u.id, u.name, u.email
       HAVING COUNT(a.*) FILTER (WHERE a.status IN ('hadir','terlambat','alpha')) > 0
          AND (COUNT(a.*) FILTER (WHERE a.status IN ('hadir','terlambat'))::float
               / COUNT(a.*) FILTER (WHERE a.status IN ('hadir','terlambat','alpha'))) * 100 < $3`,
      [month, year, threshold]
    );

    const periode = `${NAMA_BULAN[month - 1]} ${year}`;
    const terkirim = [];
    const gagal = [];

    for (const row of result.rows) {
      const rate = hitungRate(row);
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
    res.json(await daftarBelumCheckin());
  } catch (err) {
    next(err);
  }
}

// Siapa yang PANTAS diingatkan sekarang.
//
// Bukan sekadar "belum ada absen hari ini". Dua penyaringan penting:
//
//   1. Tanggal yang diperiksa adalah TANGGAL SHIFT pegawai itu, bukan
//      tanggal kalender. Pegawai shift malam yang masuk pukul 22:00 tadi
//      malam sudah absen -- catatannya hanya ada di tanggal kemarin.
//
//   2. Pegawai yang jendela absen masuknya BELUM dibuka tidak ikut
//      didaftar. Tanpa ini, cron pukul 08:00 akan menagih pegawai shift
//      malam yang jam kerjanya baru mulai pukul 22:00 nanti.
//
// Hari libur dan akhir pekan juga dilewati -- absennya memang ditutup,
// jadi tidak ada yang perlu diingatkan.
async function daftarBelumCheckin(idTerpilih = null) {
  const daftar = await jendelaSemuaPegawai(query);
  if (daftar.length === 0) return [];

  const relevan = daftar.filter((d) => idTerpilih === null || idTerpilih.includes(d.pegawai.id));
  if (relevan.length === 0) return [];

  const ids = relevan.map((d) => d.pegawai.id);
  const tanggal = relevan.map((d) => d.jendela.tanggal_shift_masuk);

  const absen = await query(
    `SELECT p.uid, a.check_in_time
     FROM unnest($1::int[], $2::date[]) AS p(uid, tanggal)
     LEFT JOIN attendance a ON a.user_id = p.uid AND a.date = p.tanggal`,
    [ids, tanggal]
  );
  const sudahMasuk = new Map(absen.rows.map((r) => [r.uid, !!r.check_in_time]));

  const hasil = [];
  for (const d of relevan) {
    if (sudahMasuk.get(d.pegawai.id)) continue;

    // Admin yang memilih orang tertentu tetap dihormati walau jendelanya
    // belum dibuka -- mungkin ia memang ingin mengingatkan lebih awal.
    if (!idTerpilih && !d.jendela.masuk.boleh) continue;

    // Baris pegawai dari jendelaSemuaPegawai sudah membawa work_days shiftnya,
    // jadi pegawai shift akhir pekan tetap diingatkan di hari kerjanya sendiri.
    const hariKerja = await cekHariKerja(query, d.jendela.tanggal_shift_masuk, d.pegawai);
    if (!hariKerja.kerja) continue;

    hasil.push({
      id: d.pegawai.id,
      name: d.pegawai.name,
      avatar_url: d.pegawai.avatar_url,
      project_name: d.pegawai.project_name,
      push_token: d.pegawai.push_token,
      bisa_dikirimi: !!d.pegawai.push_token,
      shift_name: d.jendela.shift.nama,
      shift_start: d.jendela.shift.mulai,
      tanggal_shift: d.jendela.tanggal_shift_masuk,
    });
  }
  return hasil;
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

    // Daftar yang sama dengan yang dilihat admin di layar, supaya tidak ada
    // selisih antara "yang tampil" dan "yang dikirimi". Pegawai tanpa
    // push_token tetap ikut didaftar: "tidak ada yang perlu diingatkan"
    // harus bisa dibedakan dari "tidak ada yang bisa dikirimi".
    const belumAbsen = await daftarBelumCheckin(idTerpilih);
    if (belumAbsen.length === 0) {
      // Daftar kosong bisa berarti dua hal berbeda, dan admin perlu tahu
      // yang mana: semua sudah absen, atau memang belum ada yang jam
      // kerjanya dimulai.
      return res.json({
        message: idTerpilih
          ? 'Pegawai yang dipilih ternyata sudah absen untuk shift-nya.'
          : 'Tidak ada yang perlu diingatkan: semua yang jam kerjanya sudah dibuka telah absen masuk.',
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



// ============================================================
// Pemberitahuan milik pemakai yang sedang masuk.
// ============================================================

// GET /api/notifications/saya?limit=
async function daftarNotifikasi(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const hasil = await query(
      `SELECT id, jenis, judul, pesan, tautan,
              dibaca_pada IS NOT NULL AS dibaca,
              created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );
    const belum = await query(
      'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND dibaca_pada IS NULL',
      [req.user.id]
    );
    res.json({ items: hasil.rows, belum_dibaca: belum.rows[0].n });
  } catch (err) {
    next(err);
  }
}

// PUT /api/notifications/:id/baca
async function tandaiDibaca(req, res, next) {
  try {
    // user_id ikut disyaratkan: tanpa itu siapa pun yang menebak nomor bisa
    // menandai pemberitahuan orang lain sudah dibaca.
    await query(
      `UPDATE notifications SET dibaca_pada = NOW()
       WHERE id = $1 AND user_id = $2 AND dibaca_pada IS NULL`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Ditandai sudah dibaca.' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/notifications/baca-semua
async function tandaiSemuaDibaca(req, res, next) {
  try {
    const hasil = await query(
      `UPDATE notifications SET dibaca_pada = NOW()
       WHERE user_id = $1 AND dibaca_pada IS NULL`,
      [req.user.id]
    );
    res.json({ message: `${hasil.rowCount} pemberitahuan ditandai sudah dibaca.` });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  daftarNotifikasi,
  tandaiDibaca,
  tandaiSemuaDibaca, sendLowAttendanceWarning, sendCheckinReminder, getBelumCheckin };
