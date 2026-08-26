const { query } = require('../config/db');
const { lintasTengahMalam, durasiMenit } = require('../utils/shiftWindow');
const { ringkasHariKerja, hariKerjaShift } = require('../utils/workday');

// Kolom jendela waktu absen (menit relatif terhadap jam mulai/selesai shift).
const KOLOM_JENDELA = [
  'checkin_open_minutes',
  'checkin_close_minutes',
  'checkout_open_minutes',
  'checkout_close_minutes',
];

// Batas wajar, harus sama dengan CHECK constraint di migration 005.
const BATAS = {
  checkin_open_minutes: 720,
  checkin_close_minutes: 1440,
  checkout_open_minutes: 720,
  checkout_close_minutes: 1440,
};

// Baca daftar hari kerja dari body. Dikembalikan null kalau tidak dikirim,
// supaya COALESCE di SQL mempertahankan nilai lama.
//
// Dirapikan jadi urut & unik di sini: CHECK constraint di database tidak
// bisa menolak nilai kembar (Postgres melarang subquery di dalam CHECK),
// jadi pembersihannya harus terjadi sebelum tersimpan.
function bacaHariKerja(body) {
  const mentah = body.work_days;
  if (mentah === undefined || mentah === null) return { nilai: null };

  if (!Array.isArray(mentah)) {
    return { galat: 'Hari kerja harus berupa daftar angka 0-6 (0=Minggu).' };
  }
  const angka = mentah.map(Number);
  if (angka.some((h) => !Number.isInteger(h) || h < 0 || h > 6)) {
    return { galat: 'Hari kerja harus berupa daftar angka 0-6 (0=Minggu).' };
  }
  const rapi = [...new Set(angka)].sort((a, b) => a - b);
  if (rapi.length === 0) {
    return { galat: 'Pilih minimal satu hari kerja, kalau tidak pegawai shift ini tidak akan pernah bisa absen.' };
  }
  return { nilai: rapi };
}

// Ambil nilai jendela dari body. Yang tidak dikirim dibiarkan null supaya
// COALESCE di SQL mempertahankan nilai lama.
function bacaJendela(body) {
  const nilai = {};
  for (const kolom of KOLOM_JENDELA) {
    if (body[kolom] === undefined || body[kolom] === null || body[kolom] === '') {
      nilai[kolom] = null;
      continue;
    }
    const angka = Number(body[kolom]);
    if (!Number.isInteger(angka) || angka < 0 || angka > BATAS[kolom]) {
      return { galat: `Nilai ${kolom} harus bilangan bulat antara 0 dan ${BATAS[kolom]} menit.` };
    }
    nilai[kolom] = angka;
  }
  return { nilai };
}

// Tambahkan keterangan turunan supaya frontend tidak perlu menghitung ulang.
function lengkapi(shift) {
  return {
    ...shift,
    start_time: formatJam(shift.start_time),
    end_time: formatJam(shift.end_time),
    lintas_hari: lintasTengahMalam(shift),
    durasi_menit: durasiMenit(shift),
    work_days: hariKerjaShift(shift),
    hari_kerja_teks: ringkasHariKerja(shift),
  };
}

// Format HH:MM:SS -> HH:MM biar rapi di response (kolom TIME dari Postgres ikut detik)
function formatJam(t) {
  return t ? t.slice(0, 5) : t;
}

// GET /api/shifts -- daftar semua shift (dipakai dropdown assign pegawai & halaman kelola shift)
async function getAllShifts(req, res, next) {
  try {
    const result = await query(
      `SELECT s.id, s.name, s.start_time, s.end_time, s.work_days,
              s.checkin_open_minutes, s.checkin_close_minutes,
              s.checkout_open_minutes, s.checkout_close_minutes,
              COUNT(u.id) AS jumlah_pegawai
       FROM shifts s
       LEFT JOIN users u ON u.shift_id = s.id AND u.is_active = TRUE
       GROUP BY s.id
       ORDER BY s.start_time ASC`
    );
    res.json(result.rows.map((r) => ({
      ...lengkapi(r),
      jumlah_pegawai: Number(r.jumlah_pegawai),
    })));
  } catch (err) {
    next(err);
  }
}

// POST /api/shifts -- admin buat shift baru
async function createShift(req, res, next) {
  try {
    const { name, start_time, end_time } = req.body;
    if (!name || !name.trim() || !start_time || !end_time) {
      return res.status(400).json({ message: 'Nama shift, jam masuk, dan jam pulang wajib diisi.' });
    }

    const { nilai, galat } = bacaJendela(req.body);
    if (galat) return res.status(400).json({ message: galat });

    const hari = bacaHariKerja(req.body);
    if (hari.galat) return res.status(400).json({ message: hari.galat });

    const result = await query(
      `INSERT INTO shifts (name, start_time, end_time,
                           checkin_open_minutes, checkin_close_minutes,
                           checkout_open_minutes, checkout_close_minutes,
                           work_days)
       VALUES ($1, $2, $3,
               COALESCE($4, 30), COALESCE($5, 240),
               COALESCE($6, 15), COALESCE($7, 360),
               COALESCE($8::SMALLINT[], '{1,2,3,4,5}'::SMALLINT[]))
       RETURNING *`,
      [name.trim(), start_time, end_time,
       nilai.checkin_open_minutes, nilai.checkin_close_minutes,
       nilai.checkout_open_minutes, nilai.checkout_close_minutes,
       hari.nilai]
    );
    res.status(201).json({ message: 'Shift berhasil dibuat.', shift: lengkapi(result.rows[0]) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/shifts/:id -- admin edit shift
async function updateShift(req, res, next) {
  try {
    const { name, start_time, end_time } = req.body;
    const { nilai, galat } = bacaJendela(req.body);
    if (galat) return res.status(400).json({ message: galat });

    const hari = bacaHariKerja(req.body);
    if (hari.galat) return res.status(400).json({ message: hari.galat });

    const result = await query(
      `UPDATE shifts
       SET name = COALESCE($1, name),
           start_time = COALESCE($2, start_time),
           end_time = COALESCE($3, end_time),
           checkin_open_minutes = COALESCE($4, checkin_open_minutes),
           checkin_close_minutes = COALESCE($5, checkin_close_minutes),
           checkout_open_minutes = COALESCE($6, checkout_open_minutes),
           checkout_close_minutes = COALESCE($7, checkout_close_minutes),
           work_days = COALESCE($8::SMALLINT[], work_days)
       WHERE id = $9
       RETURNING *`,
      [name?.trim() || null, start_time || null, end_time || null,
       nilai.checkin_open_minutes, nilai.checkin_close_minutes,
       nilai.checkout_open_minutes, nilai.checkout_close_minutes,
       hari.nilai, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Shift tidak ditemukan.' });
    }
    res.json({ message: 'Shift berhasil diperbarui.', shift: lengkapi(result.rows[0]) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/shifts/:id -- admin hapus shift (pegawai yang pakai otomatis jadi tanpa shift)
async function deleteShift(req, res, next) {
  try {
    await query('DELETE FROM shifts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Shift berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllShifts, createShift, updateShift, deleteShift };
