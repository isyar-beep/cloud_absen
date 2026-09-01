const { query } = require('../config/db');

// ============================================================
// Lingkup proyek: siapa boleh melihat data siapa.
//
// Sistem ini dipakai dinas untuk memantau konsultan yang mereka bayar,
// jadi batasnya harus tegas:
//
//   admin (dinas)  -> seluruh proyek
//   konsultan      -> HANYA proyek yang dia pegang
//   staff          -> hanya dirinya sendiri
//
// Aturannya ditulis sekali di sini lalu dipakai seluruh endpoint. Kalau
// tiap controller menyusun syaratnya sendiri, cepat atau lambat ada satu
// yang lupa -- dan satu kueri yang lupa disaring sudah cukup untuk
// membocorkan data proyek konsultan lain.
//
// Pembatasan ini TIDAK menggantikan authorize(): peran tetap diperiksa
// lebih dulu di lapisan rute. Yang dikerjakan di sini adalah mempersempit
// baris yang boleh terbaca oleh peran yang memang sudah diizinkan masuk.
// ============================================================

// Proyek yang dipegang seorang konsultan. Sengaja larik, bukan satu nilai:
// satu konsultan bisa memegang lebih dari satu paket pekerjaan.
async function proyekKonsultan(userId) {
  const hasil = await query('SELECT id FROM projects WHERE consultant_id = $1', [userId]);
  return hasil.rows.map((r) => r.id);
}

// Tambahkan syarat lingkup ke kueri yang menyaring PEGAWAI (lewat u.project_id).
//
// Mengembalikan false kalau pengguna ini tidak boleh melihat baris apa pun --
// misalnya konsultan yang belum dipasangkan ke proyek mana pun. Pemanggil
// wajib memeriksanya dan membalas daftar kosong, BUKAN mengabaikannya:
// syarat yang tidak jadi ditambahkan berarti seluruh data terbuka.
async function batasiPerPegawai(user, conditions, params) {
  if (user.role === 'admin') return true;

  if (user.role === 'konsultan') {
    const daftar = await proyekKonsultan(user.id);
    if (daftar.length === 0) return false;
    params.push(daftar);
    conditions.push(`u.project_id = ANY($${params.length}::int[])`);
    return true;
  }

  // Pegawai biasa tidak pernah memakai endpoint ini; dijaga di lapisan rute.
  params.push(user.id);
  conditions.push(`u.id = $${params.length}`);
  return true;
}

// Versi untuk kueri yang menyaring lewat proyek yang TERCAP di baris absensi
// (a.project_id), bukan lewat penugasan pegawai saat ini.
//
// Dipakai pada riwayat, galeri, dan laporan. Bedanya penting: kalau seorang
// pegawai dipindahkan ke proyek lain, absensinya yang lama harus tetap
// terbaca oleh konsultan proyek lamanya -- karena itu memang kehadiran yang
// terjadi di proyek tersebut.
async function batasiPerAbsensi(user, conditions, params) {
  if (user.role === 'admin') return true;

  if (user.role === 'konsultan') {
    const daftar = await proyekKonsultan(user.id);
    if (daftar.length === 0) return false;
    params.push(daftar);
    // Baris lama sebelum migrasi 010 tidak punya proyek. Dibiarkan
    // tersembunyi dari konsultan: menebak pemiliknya justru mengarang data.
    conditions.push(`a.project_id = ANY($${params.length}::int[])`);
    return true;
  }

  params.push(user.id);
  conditions.push(`a.user_id = $${params.length}`);
  return true;
}

// Bolehkah pengguna ini menyentuh data pegawai tertentu?
//
// WAJIB dipanggil oleh setiap endpoint yang menerima id pegawai atau id
// pengajuan dari luar. Menyaring daftar saja tidak cukup: alamat seperti
// /api/leaves/57/review tidak melewati penyaring mana pun, dan tanpa
// pemeriksaan ini seorang konsultan bisa menyetujui pengajuan pegawai di
// proyek konsultan lain hanya dengan menebak nomornya.
async function bolehAksesPegawai(user, targetUserId) {
  if (user.role === 'admin') return true;
  if (Number(targetUserId) === Number(user.id)) return true;
  if (user.role !== 'konsultan') return false;

  const hasil = await query(
    `SELECT 1 FROM users u
     JOIN projects p ON u.project_id = p.id
     WHERE u.id = $1 AND p.consultant_id = $2`,
    [targetUserId, user.id]
  );
  return hasil.rows.length > 0;
}

// Bolehkah pengguna ini menyentuh proyek tertentu?
async function bolehAksesProyek(user, projectId) {
  if (user.role === 'admin') return true;
  if (user.role !== 'konsultan') return false;
  const daftar = await proyekKonsultan(user.id);
  return daftar.includes(Number(projectId));
}

module.exports = {
  proyekKonsultan,
  batasiPerPegawai,
  batasiPerAbsensi,
  bolehAksesPegawai,
  bolehAksesProyek,
};
