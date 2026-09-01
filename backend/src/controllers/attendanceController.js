const { query } = require('../config/db');
const { uploadFotoAbsensi } = require('../utils/uploadPhoto');
const { tanamCap } = require('../utils/capFoto');
const { todayLocal, sekarangLokalSql } = require('../utils/date');
const { jendelaAbsen, jendelaSemuaPegawai, shiftPegawai } = require('../utils/shiftWindow');
const { cekHariKerja } = require('../utils/workday');
const { wfaBerlaku } = require('./wfaController');
const { hitungRate } = require('../utils/attendanceRate');
const { KOLOM_SHIFT_SQL, tandaiKelengkapan } = require('../utils/kelengkapan');
const { batasiPerAbsensi, proyekKonsultan, bolehAksesPegawai } = require('../utils/lingkupProyek');

// POST /api/attendance/check-in -- pengguna absen masuk dengan foto
async function checkIn(req, res, next) {
  try {
    const userId = req.user.id;
    const { latitude, longitude } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Foto wajib diambil untuk absen.' });
    }

    // Satu jam dipakai untuk semuanya: jendela absen, status terlambat,
    // nama berkas foto, cap di gambar, dan kolom check_in_time.
    const sekarang = new Date();

    const shift = await shiftPegawai(query, userId);
    const jendela = jendelaAbsen(shift, sekarang);
    if (!jendela.masuk.boleh) {
      return res.status(403).json({ message: jendela.masuk.alasan, jendela });
    }

    // Tanggal shift, bukan tanggal kalender. Untuk shift malam yang mulai
    // pukul 22:00, absen masuk pukul 00:30 tetap tercatat di tanggal shift
    // kemarin -- satu shift = satu baris absensi.
    const tanggal = jendela.tanggal_shift_masuk;

    // Akhir pekan & hari libur: kantor tutup, absen ditolak. Diperiksa
    // pada tanggal shift, jadi shift malam Jumat->Sabtu tetap boleh.
    const hariKerja = await cekHariKerja(query, tanggal, shift);
    if (!hariKerja.kerja) {
      return res.status(403).json({ message: hariKerja.alasan, hari_kerja: hariKerja });
    }

    const existing = await query(
      'SELECT id, status, check_in_time FROM attendance WHERE user_id = $1 AND date = $2',
      [userId, tanggal]
    );
    const lama = existing.rows[0];

    if (lama?.check_in_time) {
      return res.status(409).json({ message: 'Anda sudah melakukan absen masuk untuk shift ini.' });
    }
    if (lama && lama.status === 'izin') {
      return res.status(409).json({
        message: 'Tanggal ini tercatat izin. Hubungi admin bila Anda tetap masuk kerja.',
      });
    }

    // Cap koordinat & jam ditanam sebelum foto disimpan, jadi berkas yang
    // ada di disk sudah bercap -- termasuk kalau nanti diunduh admin atau
    // diteruskan lewat WhatsApp.
    const foto = await tanamCap(req.file.buffer, { latitude, longitude, waktu: sekarang });

    const photoUrl = await uploadFotoAbsensi(foto, {
      userId,
      userName: req.user.name,
      jenis: 'masuk',
      waktu: sekarang,
    });

    const status = jendela.terlambat ? 'terlambat' : 'hadir';

    // Mode kerja mengikuti penetapan WFA yang berlaku pada TANGGAL SHIFT.
    // Pegawai WFA tetap absen berfoto seperti biasa; penandaan ini yang
    // membedakannya di riwayat, galeri, dan laporan.
    const wfa = await wfaBerlaku(userId, tanggal);
    const modeKerja = wfa ? 'wfa' : 'wfo';

    // Proyek DICAP di baris absensi, bukan dibaca belakangan dari penugasan
    // pegawai. Kalau pegawai ini dipindahkan ke proyek lain bulan depan,
    // kehadirannya hari ini harus tetap tercatat di proyek tempat ia
    // sebenarnya bekerja hari ini -- kalau tidak, laporan yang sudah
    // diserahkan ke dinas berubah sendiri tanpa ada yang mengubahnya.
    const penugasan = await query('SELECT project_id FROM users WHERE id = $1', [userId]);
    const proyekId = penugasan.rows[0]?.project_id || null;

    const waktuMasuk = sekarangLokalSql(sekarang);

    // Baris "alpha" bisa sudah dibuat penanda otomatis tengah malam padahal
    // pegawai shift malam baru absen setelahnya. Baris seperti itu ditimpa,
    // bukan ditolak -- alpha hanya penanda sementara selama belum ada absen.
    const result = lama
      ? await query(
          `UPDATE attendance
           SET check_in_time = $1, status = $2, photo_in_url = $3,
               latitude = $4, longitude = $5, reason = NULL, work_mode = $6,
               project_id = $7
           WHERE id = $8
           RETURNING id, date, check_in_time, status, photo_in_url, work_mode, project_id`,
          [waktuMasuk, status, photoUrl, latitude || null, longitude || null, modeKerja, proyekId, lama.id]
        )
      : await query(
          `INSERT INTO attendance (user_id, date, check_in_time, status, photo_in_url, latitude, longitude, work_mode, project_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, date, check_in_time, status, photo_in_url, work_mode, project_id`,
          [userId, tanggal, waktuMasuk, status, photoUrl, latitude || null, longitude || null, modeKerja, proyekId]
        );

    res.status(201).json({ message: 'Absen masuk berhasil.', attendance: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/attendance/check-out -- pengguna absen pulang dengan foto
async function checkOut(req, res, next) {
  try {
    const userId = req.user.id;
    // Koordinat absen pulang dipakai untuk cap di foto. Tabel absensi hanya
    // punya satu pasang kolom lat/long (diisi saat absen masuk), jadi
    // lokasi pulang hidup di dalam gambarnya -- bukan di basis data.
    const { latitude, longitude } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Foto wajib diambil untuk absen pulang.' });
    }

    const sekarang = new Date();

    const shift = await shiftPegawai(query, userId);
    const jendela = jendelaAbsen(shift, sekarang);
    if (!jendela.pulang.boleh) {
      return res.status(403).json({ message: jendela.pulang.alasan, jendela });
    }

    // Tanggal shift yang sedang berjalan. Inilah kunci perbaikan shift
    // malam: pukul 06:10 tanggal 22, absen pulang dicari di tanggal shift
    // 21 -- tempat absen masuk pukul 22:00 tadi malam disimpan.
    const tanggal = jendela.tanggal_shift_pulang;

    const hariKerja = await cekHariKerja(query, tanggal, shift);
    if (!hariKerja.kerja) {
      return res.status(403).json({ message: hariKerja.alasan, hari_kerja: hariKerja });
    }

    const existing = await query(
      'SELECT id, check_in_time, check_out_time FROM attendance WHERE user_id = $1 AND date = $2',
      [userId, tanggal]
    );

    if (existing.rows.length === 0 || !existing.rows[0].check_in_time) {
      return res.status(400).json({ message: 'Anda belum melakukan absen masuk untuk shift ini.' });
    }
    if (existing.rows[0].check_out_time) {
      return res.status(409).json({ message: 'Anda sudah melakukan absen pulang untuk shift ini.' });
    }

    const foto = await tanamCap(req.file.buffer, { latitude, longitude, waktu: sekarang });

    const photoUrl = await uploadFotoAbsensi(foto, {
      userId,
      userName: req.user.name,
      jenis: 'pulang',
      waktu: sekarang,
    });

    const result = await query(
      `UPDATE attendance
       SET check_out_time = $1, photo_out_url = $2
       WHERE id = $3
       RETURNING id, date, check_in_time, check_out_time, status, photo_out_url`,
      [sekarangLokalSql(sekarang), photoUrl, existing.rows[0].id]
    );

    res.json({ message: 'Absen pulang berhasil.', attendance: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/today -- status shift yang sedang berjalan (untuk user).
// Selain catatan absensinya, dikirim juga info shift dan jendela waktunya
// supaya layar pegawai bisa menampilkan "sudah boleh absen atau belum"
// tanpa menebak-nebak aturan yang ada di server.
async function getTodayStatus(req, res, next) {
  try {
    const shift = await shiftPegawai(query, req.user.id);
    const jendela = jendelaAbsen(shift);

    // Nama proyek ikut dikirim supaya pegawai tahu kehadirannya tercatat
    // untuk pekerjaan yang mana -- satu-satunya hal yang berubah di layar
    // mereka, karena satu pegawai hanya aktif di satu proyek.
    const proyek = await query(
      'SELECT p.name, p.location FROM users u JOIN projects p ON u.project_id = p.id WHERE u.id = $1',
      [req.user.id]
    );

    // Untuk shift malam, kedua tanggal ini bisa berbeda saat pergantian
    // hari. Yang ditampilkan adalah shift yang absen masuknya sudah ada
    // tapi belum absen pulang; kalau tidak ada, pakai tanggal shift masuk.
    const tanggalDicoba = [...new Set([jendela.tanggal_shift_pulang, jendela.tanggal_shift_masuk])];
    const hasil = await query(
      'SELECT * FROM attendance WHERE user_id = $1 AND date = ANY($2::date[]) ORDER BY date DESC',
      [req.user.id, tanggalDicoba]
    );

    const berjalan = hasil.rows.find((r) => r.check_in_time && !r.check_out_time);
    const absensi = berjalan
      || hasil.rows.find((r) => r.date === jendela.tanggal_shift_masuk)
      || hasil.rows[0]
      || null;

    const tanggalShift = absensi?.date || jendela.tanggal_shift_masuk;
    const hariKerja = await cekHariKerja(query, tanggalShift, shift);
    // Pegawai perlu tahu hari ini dia terdaftar WFA -- absennya tetap sama,
    // tapi tanpa keterangan ini penandaan WFA di riwayat akan terasa
    // muncul entah dari mana.
    const wfa = await wfaBerlaku(req.user.id, tanggalShift);

    // Kalau kantor tutup, jendela apa pun tidak berlaku -- alasannya
    // diganti supaya pegawai tahu sebabnya bukan soal jam.
    const tutup = (bagian) => (hariKerja.kerja
      ? bagian
      : { ...bagian, boleh: false, alasan: hariKerja.alasan });

    res.json({
      absensi,
      tanggal_shift: tanggalShift,
      hari_ini: todayLocal(),
      proyek: proyek.rows[0] || null,
      hari_kerja: hariKerja,
      wfa: wfa ? { aktif: true, catatan: wfa.note } : { aktif: false, catatan: null },
      ...jendela,
      masuk: tutup(jendela.masuk),
      pulang: tutup(jendela.pulang),
    });
  } catch (err) {
    next(err);
  }
}

// Susun klausa WHERE dinamis untuk filter riwayat (tanggal & status).
// baseParams diisi dulu (misal user_id), filter menyusul di belakangnya.
function buildHistoryFilter(queryParams, conditions, params) {
  const { start_date, end_date, status } = queryParams;
  const validStatus = ['hadir', 'terlambat', 'izin', 'alpha'];

  if (start_date) {
    params.push(start_date);
    conditions.push(`a.date >= $${params.length}`);
  }
  if (end_date) {
    params.push(end_date);
    conditions.push(`a.date <= $${params.length}`);
  }
  if (status && validStatus.includes(status)) {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }
}

// GET /api/attendance/history -- riwayat absensi milik user sendiri
// Mendukung filter ?start_date=&end_date=&status= dan paginasi limit/offset
async function getMyHistory(req, res, next) {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const conditions = ['a.user_id = $1'];
    const params = [req.user.id];
    buildHistoryFilter(req.query, conditions, params);

    params.push(limit, offset);
    const result = await query(
      `SELECT a.id, a.date, a.check_in_time, a.check_out_time, a.status, a.reason,
              a.photo_in_url, a.photo_out_url, a.work_mode,
              ${KOLOM_SHIFT_SQL}
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN shifts s ON u.shift_id = s.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(tandaiKelengkapan(result.rows));
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/history/summary -- rekap milik user sendiri untuk
// filter yang sedang aktif. Dipisah dari daftar riwayat karena daftarnya
// dipaginasi: menghitung dari 30 baris pertama akan salah begitu pegawai
// punya lebih banyak catatan.
async function getMyHistorySummary(req, res, next) {
  try {
    const conditions = ['a.user_id = $1'];
    const params = [req.user.id];
    // Status sengaja diabaikan di sini -- rekapnya justru yang memberi tahu
    // ada berapa banyak tiap status dalam rentang tanggal yang dipilih.
    buildHistoryFilter({ start_date: req.query.start_date, end_date: req.query.end_date }, conditions, params);

    const hasil = await query(
      `SELECT
         COUNT(*) FILTER (WHERE a.status = 'hadir')     AS hadir,
         COUNT(*) FILTER (WHERE a.status = 'terlambat') AS terlambat,
         COUNT(*) FILTER (WHERE a.status = 'izin')      AS izin,
         COUNT(*) FILTER (WHERE a.status = 'alpha')     AS alpha,
         COUNT(*)                                       AS total
       FROM attendance a
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    const r = hasil.rows[0];
    const rekap = {
      hadir: Number(r.hadir),
      terlambat: Number(r.terlambat),
      izin: Number(r.izin),
      alpha: Number(r.alpha),
      total: Number(r.total),
    };
    // Hari efektif & rate memakai rumus yang sama dengan statistik admin,
    // supaya angka di layar pegawai tidak pernah berbeda dari laporan.
    rekap.hari_efektif = rekap.hadir + rekap.terlambat + rekap.alpha;
    rekap.rate = hitungRate(rekap);

    res.json(rekap);
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/today-all -- admin lihat semua absensi hari ini (real-time board)
async function getTodayAll(req, res, next) {
  try {
    // Tiap pegawai dicari di TANGGAL SHIFT-nya masing-masing, bukan di
    // tanggal kalender hari ini. Untuk pegawai shift pagi keduanya sama;
    // untuk shift malam yang mulai pukul 22:00 tadi malam, catatannya ada
    // di tanggal kemarin dan tanpa ini ia tampil "belum absen" padahal
    // sedang bekerja.
    let daftar = await jendelaSemuaPegawai(query);

    // Konsultan hanya melihat pegawai di proyek yang dipegangnya. Disaring
    // di sini, bukan di kueri, karena jendelaSemuaPegawai dipakai bersama
    // papan pantau dan pengingat -- keduanya perlu daftar lengkap.
    if (req.user.role === 'konsultan') {
      const milik = await proyekKonsultan(req.user.id);
      daftar = daftar.filter((d) => milik.includes(d.pegawai.project_id));
    }
    if (daftar.length === 0) return res.json([]);

    const ids = daftar.map((d) => d.pegawai.id);
    const tanggal = daftar.map((d) => d.jendela.tanggal_shift_pulang);

    const result = await query(
      `SELECT a.id, a.check_in_time, a.check_out_time, a.status, a.work_mode,
              to_char(p.tanggal, 'YYYY-MM-DD') AS tanggal_shift,
              u.id AS user_id, u.name, u.avatar_url,
              d.name AS department
       FROM unnest($1::int[], $2::date[]) AS p(uid, tanggal)
       JOIN users u ON u.id = p.uid
       LEFT JOIN attendance a ON a.user_id = u.id AND a.date = p.tanggal
       LEFT JOIN departments d ON u.department_id = d.id
       ORDER BY a.check_in_time ASC NULLS LAST, u.name ASC`,
      [ids, tanggal]
    );

    // Info shift disertakan supaya papan pantau bisa menerangkan kenapa
    // seseorang belum absen: jam kerjanya memang belum dimulai.
    const infoShift = new Map(daftar.map((d) => [d.pegawai.id, d.jendela]));
    res.json(result.rows.map((r) => {
      const j = infoShift.get(r.user_id);
      return {
        ...r,
        shift_nama: j?.shift?.nama || null,
        shift_mulai: j?.shift?.mulai || null,
        shift_selesai: j?.shift?.selesai || null,
        masuk_dibuka: j?.masuk?.boleh ?? false,
      };
    }));
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/user/:userId -- admin lihat riwayat absensi pengguna tertentu
async function getUserHistory(req, res, next) {
  try {
    if (!(await bolehAksesPegawai(req.user, req.params.userId))) {
      return res.status(403).json({ message: 'Pegawai ini bukan bagian dari proyek Anda.' });
    }
    const { limit = 30, offset = 0 } = req.query;
    const conditions = ['a.user_id = $1'];
    const params = [req.params.userId];
    buildHistoryFilter(req.query, conditions, params);

    params.push(limit, offset);
    const result = await query(
      `SELECT a.id, a.date, a.check_in_time, a.check_out_time, a.status, a.reason,
              a.photo_in_url, a.photo_out_url, a.work_mode,
              ${KOLOM_SHIFT_SQL}
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN shifts s ON u.shift_id = s.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.date DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(tandaiKelengkapan(result.rows));
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance/all -- admin lihat riwayat seluruh pegawai
// Filter: ?start_date=&end_date=&status=&department_id= + paginasi limit/offset
async function getAllHistory(req, res, next) {
  try {
    const { limit = 50, offset = 0, department_id, user_id, project_id, sort, with_photo } = req.query;
    const conditions = ["u.role = 'staff'"];
    const params = [];
    buildHistoryFilter(req.query, conditions, params);

    // Konsultan hanya melihat absensi yang tercap pada proyeknya. Balas
    // kosong kalau dia belum dipasangkan ke proyek mana pun -- membiarkan
    // syaratnya hilang berarti membuka seluruh data.
    if (!(await batasiPerAbsensi(req.user, conditions, params))) return res.json([]);

    // Penyaring proyek untuk admin. Memakai proyek yang TERCAP di baris
    // absensi, bukan penugasan pegawai saat ini, supaya riwayat lama tetap
    // terbaca di proyek tempat kehadiran itu sebenarnya terjadi.
    if (project_id) {
      params.push(project_id);
      conditions.push(`a.project_id = $${params.length}`);
    }
    if (department_id) {
      params.push(department_id);
      conditions.push(`u.department_id = $${params.length}`);
    }
    if (user_id) {
      params.push(user_id);
      conditions.push(`u.id = $${params.length}`);
    }
    // Dipakai halaman galeri: hanya hari yang benar-benar punya foto
    if (with_photo === 'true') {
      conditions.push('(a.photo_in_url IS NOT NULL OR a.photo_out_url IS NOT NULL)');
    }

    // Hanya dua nilai yang diterima, tidak pernah disisipkan dari input mentah
    const urutan = sort === 'asc' ? 'ASC' : 'DESC';

    params.push(limit, offset);
    const result = await query(
      // Koordinat ikut dikirim: sejak awal direkam setiap absen masuk, tapi
      // tidak pernah ditampilkan di layar mana pun. Ini absen lapangan --
      // tidak ada pembatasan area, jadi gunanya murni sebagai keterangan
      // tempat, bukan alat menolak absen.
      `SELECT a.id, a.date, a.check_in_time, a.check_out_time, a.status, a.reason,
              a.photo_in_url, a.photo_out_url, a.work_mode,
              a.latitude, a.longitude,
              u.id AS user_id, u.name, u.avatar_url, d.name AS department,
              a.project_id, pr.name AS project_name,
              ${KOLOM_SHIFT_SQL}
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN shifts s ON u.shift_id = s.id
       LEFT JOIN projects pr ON a.project_id = pr.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.date ${urutan}, u.name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(tandaiKelengkapan(result.rows));
  } catch (err) {
    next(err);
  }
}

// Catatan: endpoint lama PUT /:id/status sudah dihapus.
//
// Endpoint itu mengubah status absensi TANPA menulis jejak audit, sementara
// PUT /:id/edit -- yang menggantikannya sejak tahap 5 -- mewajibkan alasan
// dan mencatat tiap perubahan. Membiarkan keduanya hidup berarti ada satu
// pintu yang bisa mengubah data kehadiran tanpa meninggalkan bekas, dan itu
// meruntuhkan gunanya jejak audit. Tidak ada frontend yang memakainya.
//
// POST /api/attendance/mark-alpha -- tandai pegawai yang tidak absen & tidak izin
// sebagai "alpha" untuk satu tanggal (default: kemarin). Melewati weekend & hari
// libur otomatis. Dipanggil admin manual, atau terjadwal dari cron VPS tiap malam:
//   curl -X POST -H "Authorization: Bearer <token-admin>" .../api/attendance/mark-alpha
async function markAlpha(req, res, next) {
  try {
    // Default ke kemarin -- menandai "hari ini" alpha sebelum harinya berakhir
    // akan salah kalau pegawai baru absen di sore/malam hari.
    const kemarin = new Date();
    kemarin.setDate(kemarin.getDate() - 1);
    const y = kemarin.getFullYear();
    const m = String(kemarin.getMonth() + 1).padStart(2, '0');
    const d = String(kemarin.getDate()).padStart(2, '0');
    const targetDate = req.body?.date || `${y}-${m}-${d}`;

    // Tanggal dari body dipakai apa adanya sebelumnya -- tanpa pemeriksaan
    // bentuk maupun batas. Salah ketik di cron cukup untuk menandai seluruh
    // pegawai alpha di tanggal yang belum terjadi, dan bentuk yang bukan
    // tanggal membuat cast di SQL melempar galat 500.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return res.status(400).json({ message: 'Format tanggal harus YYYY-MM-DD.' });
    }
    if (targetDate > todayLocal()) {
      return res.status(400).json({
        message: 'Tidak bisa menandai alpha untuk tanggal yang belum terjadi.',
      });
    }

    // Hari kerja diambil dari shift masing-masing pegawai, bukan dipaku
    // Senin-Jumat seperti sebelumnya. Tanpa ini, pegawai shift akhir pekan
    // tidak pernah tertandai alpha di hari kerjanya sendiri -- bolos di hari
    // Sabtu tidak pernah tercatat, dan statistiknya ikut menipu.
    //
    // COALESCE menjaga pegawai yang belum punya shift tetap Senin-Jumat.
    const result = await query(
      // project_id ikut dicatat: tanpa itu baris alpha tidak bermilik proyek,
      // dan konsultan hanya akan melihat pegawai yang hadir -- justru yang
      // TIDAK hadir yang paling perlu dia ketahui.
      `INSERT INTO attendance (user_id, date, status, project_id)
       SELECT u.id, $1::date, 'alpha', u.project_id
       FROM users u
       LEFT JOIN shifts s ON u.shift_id = s.id
       WHERE u.role = 'staff' AND u.is_active = TRUE
         AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.user_id = u.id AND a.date = $1::date)
         AND EXTRACT(DOW FROM $1::date)::SMALLINT = ANY(COALESCE(s.work_days, '{1,2,3,4,5}'::SMALLINT[]))
         AND NOT EXISTS (SELECT 1 FROM holidays h WHERE h.date = $1::date)
       RETURNING user_id`,
      [targetDate]
    );

    res.json({
      message: `${result.rows.length} pegawai ditandai alpha untuk tanggal ${targetDate}.`,
      data: { tanggal: targetDate, jumlah: result.rows.length },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  checkIn,
  checkOut,
  getTodayStatus,
  getMyHistory,
  getMyHistorySummary,
  getTodayAll,
  getUserHistory,
  getAllHistory,
  markAlpha,
};
