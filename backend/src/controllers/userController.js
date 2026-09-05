const bcrypt = require('bcryptjs');
const { lupakanPengguna } = require('../middleware/auth');
const { query } = require('../config/db');
const { batasiPerPegawai, bolehAksesPegawai } = require('../utils/lingkupProyek');
const { periksaKataSandi } = require('../utils/kataSandi');
const gembok = require('../utils/gemboklogin');

// GET /api/users -- daftar semua pengguna (admin only)
async function getAllUsers(req, res, next) {
  try {
    // Konsultan hanya melihat pegawai di proyeknya. Balas kosong kalau dia
    // belum dipasangkan ke proyek mana pun -- syarat yang tidak jadi
    // ditambahkan berarti seluruh daftar pegawai terbuka.
    const conditions = ['TRUE'];
    const params = [];
    if (!(await batasiPerPegawai(req.user, conditions, params))) return res.json([]);

    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.avatar_url,
              s.id AS shift_id, s.name AS shift_name, s.start_time AS shift_start, s.end_time AS shift_end,
              u.project_id, p.name AS project_name
       FROM users u
       LEFT JOIN shifts s ON u.shift_id = s.id
       LEFT JOIN projects p ON u.project_id = p.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.name ASC`,
      params
    );
    res.json(result.rows.map((u) => ({
      ...u,
      shift_start: u.shift_start?.slice(0, 5) || null,
      shift_end: u.shift_end?.slice(0, 5) || null,
    })));
  } catch (err) {
    next(err);
  }
}

// GET /api/users/:id
async function getUserById(req, res, next) {
  try {
    // Menyaring daftar saja tidak cukup: alamat ini menerima nomor dari luar.
    if (!(await bolehAksesPegawai(req.user, req.params.id))) {
      return res.status(403).json({ message: 'Pegawai ini bukan bagian dari proyek Anda.' });
    }
    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active,
              s.id AS shift_id, s.name AS shift_name
       FROM users u
       LEFT JOIN shifts s ON u.shift_id = s.id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// POST /api/users -- admin membuat akun pengguna baru
async function createUser(req, res, next) {
  try {
    const { name, email, password, role, department_id, shift_id, project_id } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nama, email, dan password wajib diisi.' });
    }
    const keluhan = periksaKataSandi(password, { nama: name, email });
    if (keluhan) {
      return res.status(400).json({ message: keluhan });
    }
    if (role && !['admin', 'konsultan', 'staff'].includes(role)) {
      return res.status(400).json({ message: "Role harus 'admin', 'konsultan', atau 'staff'." });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Email sudah terdaftar.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      // harus_ganti_sandi TRUE: sandi ini diketik admin dan disampaikan
      // ke pegawainya lewat telepon atau pesan. Selama belum diganti,
      // yang tahu sandinya bukan cuma pemiliknya.
      `INSERT INTO users (name, email, password_hash, role, department_id, shift_id, project_id,
                          harus_ganti_sandi)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING id, name, email, role, department_id, shift_id, project_id`,
      [name, email, passwordHash, role || 'staff', department_id || null, shift_id || null,
       // Penugasan proyek hanya bermakna untuk pegawai. Admin dan konsultan
       // tidak absen, jadi dibiarkan kosong daripada menyimpan nilai yang
       // tidak pernah dibaca lalu membingungkan waktu ditelusuri.
       (role || 'staff') === 'staff' ? (project_id || null) : null]
    );

    res.status(201).json({ message: 'Pengguna berhasil dibuat.', user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// Alasan penolakan kalau perubahan ini akan menghilangkan akses admin,
// atau null kalau aman. Dipakai bersama oleh PUT dan DELETE: dua jalur
// berbeda menuju keadaan yang sama-sama tidak bisa dipulihkan, jadi
// aturannya tidak boleh hidup di salah satunya saja.
async function alasanTolakPerubahanAdmin({ targetId, pelakuId, menurunkan, menonaktifkan }) {
  if (!menurunkan && !menonaktifkan) return null;

  // Admin tidak boleh mengunci dirinya sendiri di luar aplikasi. Sekali
  // akunnya nonaktif atau turun jadi staff, ia kehilangan akses ke menu
  // yang bisa mengembalikannya -- satu-satunya jalan keluar adalah
  // mengubah database secara langsung.
  if (targetId === pelakuId) {
    return menonaktifkan
      ? 'Anda tidak bisa menonaktifkan akun sendiri. Minta admin lain melakukannya.'
      : 'Anda tidak bisa menurunkan role akun sendiri. Minta admin lain melakukannya.';
  }

  // Admin aktif terakhir juga tidak boleh hilang, walau yang melakukannya
  // orang lain. Tanpa satu pun admin aktif, tidak ada yang bisa membuat
  // pegawai baru, meninjau izin, atau mengembalikan keadaan.
  const target = await query('SELECT role, is_active FROM users WHERE id = $1', [targetId]);
  const adalahAdminAktif = target.rows[0]?.role === 'admin' && target.rows[0]?.is_active;
  if (!adalahAdminAktif) return null;

  const sisa = await query(
    `SELECT COUNT(*) AS n FROM users
     WHERE role = 'admin' AND is_active = TRUE AND id != $1`,
    [targetId]
  );
  if (Number(sisa.rows[0].n) === 0) {
    return 'Ini satu-satunya admin aktif. Buat atau aktifkan admin lain dulu sebelum mengubahnya.';
  }
  return null;
}

// PUT /api/users/:id -- admin edit data pengguna
async function updateUser(req, res, next) {
  try {
    const { name, email, role, department_id, is_active, shift_id, project_id } = req.body;

    if (role && !['admin', 'konsultan', 'staff'].includes(role)) {
      return res.status(400).json({ message: "Role harus 'admin', 'konsultan', atau 'staff'." });
    }

    const tolak = await alasanTolakPerubahanAdmin({
      targetId: Number(req.params.id),
      pelakuId: req.user.id,
      // Bukan cuma 'staff': turun ke 'konsultan' sama-sama menghilangkan
      // akses admin, dan tanpa ini admin bisa mengunci dirinya sendiri
      // lewat peran yang baru ditambahkan.
      menurunkan: !!role && role !== 'admin',
      menonaktifkan: is_active === false,
    });
    if (tolak) return res.status(400).json({ message: tolak });

    // shift_id boleh sengaja di-null-kan (lepas shift), jadi tidak pakai COALESCE --
    // hanya diubah kalau key-nya memang dikirim di body.
    const ubahShift = 'shift_id' in req.body;
    // Sama seperti shift: proyek boleh sengaja dikosongkan (dilepas dari
    // penugasan), jadi hanya diubah kalau key-nya memang dikirim.
    const ubahProyek = 'project_id' in req.body;

    const result = await query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           role = COALESCE($3, role),
           department_id = COALESCE($4, department_id),
           is_active = COALESCE($5, is_active),
           shift_id = CASE WHEN $6 THEN $7 ELSE shift_id END,
           project_id = CASE WHEN $8 THEN $9 ELSE project_id END,
           updated_at = NOW()
       WHERE id = $10
       RETURNING id, name, email, role, department_id, is_active, shift_id, project_id`,
      [name, email, role, department_id, is_active, ubahShift, shift_id,
       ubahProyek, project_id || null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    }

    // Peran dan status aktif ikut berubah di sini, dan keduanya dipakai
    // menjaga setiap permintaan. Tanpa pembatalan ini, keadaan lamanya
    // masih terpakai sampai ingatan di middleware kedaluwarsa.
    lupakanPengguna(req.params.id);

    res.json({ message: 'Pengguna berhasil diperbarui.', user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/:id/reset-password -- admin reset password pengguna
async function resetPassword(req, res, next) {
  try {
    const { newPassword } = req.body;

    // Nama dan email pemiliknya diambil dulu supaya sandi yang ditetapkan
    // admin ikut diperiksa terhadap keduanya. Justru di sinilah godaannya
    // paling besar: admin yang mereset puluhan akun cenderung memakai
    // nama orangnya sebagai sandi sementara.
    const sasaran = await query('SELECT name, email FROM users WHERE id = $1', [req.params.id]);
    if (sasaran.rows.length === 0) {
      return res.status(404).json({ message: 'Pengguna tidak ditemukan.' });
    }

    const keluhan = periksaKataSandi(newPassword, {
      nama: sasaran.rows[0].name,
      email: sasaran.rows[0].email,
    });
    if (keluhan) {
      return res.status(400).json({ message: keluhan });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query(
      // Dua hal sekaligus, dan keduanya menutup lubang yang berbeda:
      //
      // harus_ganti_sandi  -- sandi ini dibacakan admin lewat telepon atau
      //   dikirim lewat pesan. Siapa pun yang ikut mendengar atau membaca
      //   memegang akses permanen selama sandinya tidak pernah diganti.
      //   Sekarang pemiliknya wajib menggantinya di login berikutnya.
      //
      // sesi_sejak_epoch   -- alasan admin mereset sandi seringkali justru
      //   karena akunnya diduga dipakai orang lain. Mereset sandi tanpa
      //   memutus sesi membiarkan orang itu tetap masuk memakai token
      //   lamanya, tanpa perlu tahu sandi barunya sama sekali.
      `UPDATE users
       SET password_hash = $1,
           harus_ganti_sandi = TRUE,
           sesi_sejak_epoch = FLOOR(EXTRACT(EPOCH FROM NOW()))::bigint,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, req.params.id]
    );

    // Tanpa ini, keadaan lama masih dipakai middleware sampai ingatannya
    // kedaluwarsa -- dan selama itu sesi yang mestinya sudah putus masih
    // diterima.
    lupakanPengguna(req.params.id);

    // Reset oleh admin membuka gembok akunnya. Alasan orang menghubungi
    // admin biasanya justru karena terkunci; kalau gemboknya dibiarkan,
    // sandi barunya pun tetap ditolak dan admin akan mengira resetnya
    // gagal.
    gembok.lupakan(sasaran.rows[0].email);

    res.json({ message: 'Password pengguna berhasil direset.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/:id -- nonaktifkan akun (soft delete, bukan hapus permanen)
async function deactivateUser(req, res, next) {
  try {
    const tolak = await alasanTolakPerubahanAdmin({
      targetId: Number(req.params.id),
      pelakuId: req.user.id,
      menurunkan: false,
      menonaktifkan: true,
    });
    if (tolak) return res.status(400).json({ message: tolak });

    await query('UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1', [
      req.params.id,
    ]);

    // Yang paling penting dari seluruh pemanggilan lupakanPengguna:
    // penonaktifan harus berlaku SEKETIKA. Jeda sekecil apa pun berarti
    // orang yang baru dipecat masih sempat mengubah data.
    lupakanPengguna(req.params.id);

    res.json({ message: 'Akun pengguna telah dinonaktifkan.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  resetPassword,
  deactivateUser,
};
