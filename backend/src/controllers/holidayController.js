const { query } = require('../config/db');

// GET /api/holidays -- daftar hari libur (opsional filter ?year=)
async function getAllHolidays(req, res, next) {
  try {
    const { year } = req.query;
    const result = await query(
      year
        ? `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, name FROM holidays
           WHERE EXTRACT(YEAR FROM date) = $1 ORDER BY date ASC`
        : `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, name FROM holidays ORDER BY date ASC`,
      year ? [year] : []
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// Batas atas rentang. Libur terpanjang yang masuk akal -- puasa penuh
// sebulan -- masih jauh di bawah ini. Batasnya ada untuk menahan salah
// ketik tahun (2026 jadi 2036) yang kalau lolos akan menanam ribuan baris.
const MAKS_HARI_RENTANG = 60;

// Semua tanggal dari `mulai` sampai `selesai`, inklusif.
// Dihitung dengan UTC supaya penambahan hari tidak pernah meleset karena
// pergeseran waktu musim panas di zona mana pun.
function bentangTanggal(mulai, selesai) {
  const keluar = [];
  const d = new Date(`${mulai}T00:00:00Z`);
  const akhir = new Date(`${selesai}T00:00:00Z`);
  while (d <= akhir) {
    keluar.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return keluar;
}

// POST /api/holidays -- admin tambah hari libur, satu tanggal atau serentang
//
// Rentang SENGAJA dimekarkan jadi satu baris per tanggal, bukan disimpan
// sebagai kolom mulai/selesai. Seluruh pemeriksaan hari libur yang sudah ada
// -- penandaan alpha, hitungan hari kerja, laporan -- bertanya "apakah
// tanggal ini libur", dan bentuk itu tetap bekerja apa adanya. Menyimpan
// rentang berarti mengubah setiap kueri itu, dan satu saja yang terlewat
// akan menandai orang alpha di hari libur tanpa ada yang menyadari.
async function createHoliday(req, res, next) {
  try {
    const { date, end_date, name } = req.body;
    if (!date || !name || !name.trim()) {
      return res.status(400).json({ message: 'Tanggal dan nama hari libur wajib diisi.' });
    }
    const formatValid = /^\d{4}-\d{2}-\d{2}$/;
    if (!formatValid.test(date) || (end_date && !formatValid.test(end_date))) {
      return res.status(400).json({ message: 'Format tanggal harus YYYY-MM-DD.' });
    }

    const akhir = end_date || date;
    if (akhir < date) {
      return res.status(400).json({ message: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' });
    }

    const tanggal = bentangTanggal(date, akhir);
    if (tanggal.length > MAKS_HARI_RENTANG) {
      return res.status(400).json({
        message: `Rentang terlalu panjang (${tanggal.length} hari). Batasnya ${MAKS_HARI_RENTANG} hari.`,
      });
    }

    // Tanggal yang sudah terdaftar DILEWATI, bukan menggagalkan seluruh
    // rentang. Menambah cuti bersama yang menyerempet satu tanggal merah
    // yang sudah ada adalah hal biasa; menolak seluruhnya karena satu
    // tumpang tindih hanya memaksa admin memecah rentangnya sendiri.
    const sudahAda = await query(
      'SELECT to_char(date, \'YYYY-MM-DD\') AS date FROM holidays WHERE date = ANY($1::date[])',
      [tanggal]
    );
    const bentrok = new Set(sudahAda.rows.map((r) => r.date));
    const baru = tanggal.filter((t) => !bentrok.has(t));

    if (baru.length === 0) {
      return res.status(409).json({
        message: tanggal.length === 1
          ? 'Tanggal ini sudah terdaftar sebagai hari libur.'
          : 'Semua tanggal pada rentang ini sudah terdaftar.',
      });
    }

    const hasil = await query(
      `INSERT INTO holidays (date, name)
       SELECT unnest($1::date[]), $2
       RETURNING id, to_char(date, 'YYYY-MM-DD') AS date, name`,
      [baru, name.trim()]
    );

    const dilewati = tanggal.length - baru.length;
    res.status(201).json({
      message: baru.length === 1
        ? 'Hari libur berhasil ditambahkan.'
        : `${baru.length} hari libur ditambahkan`
          + (dilewati > 0 ? ` — ${dilewati} tanggal dilewati karena sudah terdaftar.` : '.'),
      holidays: hasil.rows,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/holidays/:id -- admin hapus hari libur
//
// :id boleh berisi beberapa nomor dipisah koma. Rentang disimpan sebagai
// baris per tanggal, jadi menghapus "libur puasa" berarti menghapus 30
// baris sekaligus; tanpa ini layar harus menembak 30 permintaan berturut-
// turut, dan kegagalan di tengah menyisakan rentang yang terpotong separuh.
async function deleteHoliday(req, res, next) {
  try {
    const ids = String(req.params.id)
      .split(',')
      .map((n) => Number(n.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);

    if (ids.length === 0) {
      return res.status(400).json({ message: 'Nomor hari libur tidak sah.' });
    }

    const hasil = await query('DELETE FROM holidays WHERE id = ANY($1::int[])', [ids]);
    res.json({
      message: hasil.rowCount > 1
        ? `${hasil.rowCount} hari libur berhasil dihapus.`
        : 'Hari libur berhasil dihapus.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllHolidays, createHoliday, deleteHoliday };
