const { query } = require('../config/db');

// ============================================================
// Token push dan pengenalan perangkat.
//
// Satu pintu untuk keduanya. Sebelumnya token dibaca langsung dari kolom
// users.push_token di ENAM tempat berbeda, masing-masing menyusun
// kuerinya sendiri. Selama bentuknya satu kolom itu masih tertahankan;
// begitu berubah jadi tabel, enam salinan aturan yang sama adalah enam
// kesempatan untuk berbeda diam-diam -- dan pemberitahuan yang tidak
// terkirim tidak menimbulkan galat apa pun yang bisa dilihat orang.
// ============================================================

/**
 * Token push milik sekumpulan pengguna.
 *
 * Mengembalikan larik datar, bukan dikelompokkan per pengguna: seluruh
 * pemanggil memang mengirim isi yang sama ke semua tujuan sekaligus.
 */
async function tokenPengguna(userIds) {
  const daftar = [...new Set((userIds || []).filter(Boolean).map(Number))];
  if (daftar.length === 0) return [];

  const hasil = await query(
    `SELECT user_id, token FROM push_tokens WHERE user_id = ANY($1::int[])`,
    [daftar]
  );
  return hasil.rows;
}

/**
 * Berapa perangkat yang bisa dijangkau untuk tiap pegawai.
 *
 * Menghitung di basis data, bukan menarik seluruh token lalu menghitung
 * di JavaScript: layar admin hanya perlu tahu "ada atau tidak", dan token
 * itu alamat perangkat pribadi pegawai yang tidak perlu keluar dari
 * server hanya untuk dijadikan angka.
 */
async function jumlahPerangkat() {
  const hasil = await query(
    'SELECT user_id, COUNT(*)::int AS jumlah FROM push_tokens GROUP BY user_id'
  );
  return new Map(hasil.rows.map((r) => [r.user_id, r.jumlah]));
}

/**
 * Mendaftarkan token sebuah perangkat.
 *
 * ON CONFLICT pada tokennya: satu token Expo menunjuk satu pemasangan
 * aplikasi pada satu HP. Kalau HP itu dipakai login pegawai lain,
 * tokennya BERPINDAH pemilik. Menyimpannya dua kali akan membuat
 * pemberitahuan milik dua orang terkirim ke HP yang sama, dan
 * masing-masing membaca yang bukan haknya.
 */
async function daftarkanToken({ userId, token, merek, model, os }) {
  await query(
    `INSERT INTO push_tokens (user_id, token, merek, model, os)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (token) DO UPDATE
     SET user_id = EXCLUDED.user_id,
         merek = COALESCE(EXCLUDED.merek, push_tokens.merek),
         model = COALESCE(EXCLUDED.model, push_tokens.model),
         os = COALESCE(EXCLUDED.os, push_tokens.os),
         terakhir_dipakai = NOW()`,
    [userId, token, merek || null, model || null, os || null]
  );
}

// Melepas satu token, dipakai saat pegawai keluar dari satu perangkat.
// Hanya token milik pengguna itu -- tanpa syarat user_id, siapa pun yang
// tahu sebuah token bisa mematikan pemberitahuan orang lain.
async function lepaskanToken({ userId, token }) {
  await query('DELETE FROM push_tokens WHERE user_id = $1 AND token = $2', [userId, token]);
}

// Membuang token yang ditolak layanan push. Expo membalas
// DeviceNotRegistered untuk perangkat yang sudah menghapus aplikasinya;
// tanpa pembersihan ini tabelnya menggemuk oleh alamat yang tidak pernah
// bisa dijangkau lagi.
async function buangToken(daftarToken) {
  const token = [...new Set((daftarToken || []).filter(Boolean))];
  if (token.length === 0) return 0;
  const hasil = await query('DELETE FROM push_tokens WHERE token = ANY($1::text[])', [token]);
  return hasil.rowCount;
}

/**
 * Mencatat perangkat yang dipakai login, dan memberitahukan apakah ia baru.
 *
 * @returns {{baru: boolean, pertamaKali: boolean, nama: string|null}}
 *
 * pertamaKali dibedakan dari baru, dan bedanya menentukan apakah pemilik
 * akun perlu diganggu: login PERTAMA sebuah akun selalu dari perangkat
 * yang belum dikenal, tapi memberi tahu "ada login dari perangkat baru"
 * pada saat itu hanya melatih orang mengabaikan peringatan berikutnya.
 */
async function catatPerangkat({ userId, sidik, nama }) {
  // Tanpa penanda dari klien, tidak ada yang bisa dikenali. Ini terjadi
  // pada aplikasi versi lama yang belum mengirimkannya -- dan diam lebih
  // baik daripada menuduh setiap login sebagai perangkat baru.
  if (!sidik) return { baru: false, pertamaKali: false, nama: null };

  const sebelum = await query(
    'SELECT COUNT(*)::int AS n FROM perangkat WHERE user_id = $1',
    [userId]
  );
  const pertamaKali = sebelum.rows[0].n === 0;

  // xmax = 0 hanya pada baris yang benar-benar BARU disisipkan; baris
  // yang jatuh ke DO UPDATE membawa xmax bukan nol. Dengan satu kueri
  // kita tahu sekaligus: perangkatnya tercatat, dan apakah ia baru.
  // Memisahkannya jadi SELECT lalu INSERT membuka celah waktu antara
  // keduanya -- dua login serentak bisa sama-sama merasa dirinya baru.
  const hasil = await query(
    `INSERT INTO perangkat (user_id, sidik, nama)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, sidik) DO UPDATE
     SET terakhir_pada = NOW(),
         nama = COALESCE(EXCLUDED.nama, perangkat.nama)
     RETURNING (xmax = 0) AS baru, nama`,
    [userId, String(sidik).slice(0, 64), nama ? String(nama).slice(0, 160) : null]
  );

  const baris = hasil.rows[0];
  return { baru: baris.baru, pertamaKali, nama: baris.nama };
}

module.exports = {
  tokenPengguna, jumlahPerangkat, daftarkanToken, lepaskanToken, buangToken,
  catatPerangkat,
};
