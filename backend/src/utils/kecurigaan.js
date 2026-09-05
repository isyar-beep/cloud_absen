const { query } = require('../config/db');
const { batasiPerAbsensi } = require('./lingkupProyek');

// ============================================================
// Absensi yang perlu ditinjau manusia.
//
// TIDAK ADA yang diblokir di sini, dan itu inti rancangannya. Yang
// dihasilkan cuma daftar "tolong lihat fotonya" untuk konsultan.
//
// Alasannya: pelakunya bukan penyerang profesional, melainkan rekan
// kerja yang menolong teman. Orang seperti itu tidak akan memalsukan
// penanda perangkat atau memasang ulang aplikasi untuk mengelabui
// sistem. Yang menghentikan mereka adalah tahu bahwa perbuatannya
// tercatat dan terlihat -- bukan tembok.
//
// Dan tembok punya harga yang tidak sebanding: pegawai yang HP-nya rusak
// tidak bisa absen, sementara absensinya menentukan bayarannya.
// ============================================================

// Dua absensi dianggap "berdekatan waktunya" bila selisihnya di bawah
// ini. Dipakai hanya untuk penanda koordinat, yang memang lemah.
const SELANG_DEKAT_DETIK = 120;

// Jarak yang dianggap "praktis di titik yang sama". Sekitar 30 meter
// pada garis lintang Indonesia.
//
// Sengaja longgar: yang dicari bukan ketepatan lokasi, melainkan dua
// absensi yang tampak ditekan dari tempat yang sama pada saat yang sama.
const DEKAT_DERAJAT = 0.0003;

/**
 * Satu perangkat dipakai absen oleh DUA PEGAWAI atau lebih pada hari yang sama.
 *
 * Ini sinyal terkuatnya. Di lapangan tidak ada HP yang dipakai
 * bergantian, jadi dalam keadaan normal hal ini mustahil.
 *
 * Sinyalnya tetap bekerja walau penanda perangkatnya tidak stabil: yang
 * dibandingkan dua absensi pada HARI YANG SAMA, bukan riwayat panjang.
 * Aplikasi yang dipasang ulang menghasilkan penanda baru, tapi itu tidak
 * menghapus fakta bahwa hari itu satu perangkat dipakai dua orang.
 */
async function perangkatDipakaiBersama(user, { dari, sampai, limit = 100 } = {}) {
  const kondisi = ["a.sidik_perangkat IS NOT NULL", "u.role = 'staff'"];
  const params = [];

  // Konsultan hanya melihat proyeknya sendiri. Balas kosong kalau dia
  // belum dipasangkan ke proyek mana pun -- syarat yang tidak jadi
  // ditambahkan berarti seluruh data terbuka.
  if (!(await batasiPerAbsensi(user, kondisi, params))) return [];

  if (dari) { params.push(dari); kondisi.push(`a.date >= $${params.length}`); }
  if (sampai) { params.push(sampai); kondisi.push(`a.date <= $${params.length}`); }

  params.push(Math.min(Number(limit) || 100, 500));

  // Dikelompokkan per (tanggal, perangkat), lalu disaring yang pemakainya
  // lebih dari satu orang. COUNT(DISTINCT) penting: satu pegawai yang
  // absen masuk DAN pulang dari HP-nya sendiri menghasilkan dua baris
  // pada perangkat yang sama, dan itu justru keadaan yang paling normal.
  const hasil = await query(
    `SELECT to_char(a.date, 'YYYY-MM-DD') AS tanggal,
            a.sidik_perangkat,
            COUNT(DISTINCT a.user_id)::int AS jumlah_pegawai,
            json_agg(DISTINCT jsonb_build_object(
              'user_id', u.id, 'nama', u.name, 'proyek', pr.name
            )) AS pegawai
     FROM attendance a
     JOIN users u ON a.user_id = u.id
     LEFT JOIN projects pr ON a.project_id = pr.id
     WHERE ${kondisi.join(' AND ')}
     GROUP BY a.date, a.sidik_perangkat
     HAVING COUNT(DISTINCT a.user_id) > 1
     ORDER BY a.date DESC
     LIMIT $${params.length}`,
    params
  );

  return hasil.rows.map((r) => ({
    jenis: 'perangkat_bersama',
    tanggal: r.tanggal,
    jumlah_pegawai: r.jumlah_pegawai,
    pegawai: r.pegawai,
    keterangan: `${r.jumlah_pegawai} pegawai absen dari perangkat yang sama pada hari ini.`,
  }));
}

/**
 * Dua absensi dari titik yang praktis sama, dalam hitungan detik.
 *
 * SINYAL LEMAH, dan sengaja dilaporkan terpisah supaya tidak tercampur
 * dengan yang kuat. Di satu lokasi proyek, dua pegawai memang berdiri
 * berdekatan dan bisa absen hampir bersamaan -- itu keadaan yang wajar,
 * bukan pelanggaran.
 *
 * Gunanya sebagai penunjuk tambahan saat sudah ada kecurigaan lain,
 * bukan sebagai tuduhan yang berdiri sendiri.
 */
async function absenBerdempet(user, { dari, sampai, limit = 100 } = {}) {
  const kondisi = [
    'a.latitude IS NOT NULL', 'b.latitude IS NOT NULL',
    'a.check_in_time IS NOT NULL', 'b.check_in_time IS NOT NULL',
    // a.user_id < b.user_id: tanpa ini tiap pasangan muncul dua kali,
    // sekali dari tiap sisi.
    'a.user_id < b.user_id',
    'a.date = b.date',
  ];
  const params = [];

  if (!(await batasiPerAbsensi(user, kondisi, params))) return [];

  if (dari) { params.push(dari); kondisi.push(`a.date >= $${params.length}`); }
  if (sampai) { params.push(sampai); kondisi.push(`a.date <= $${params.length}`); }

  params.push(DEKAT_DERAJAT);
  const pDekat = params.length;
  params.push(SELANG_DEKAT_DETIK);
  const pSelang = params.length;
  params.push(Math.min(Number(limit) || 100, 500));

  const hasil = await query(
    `SELECT to_char(a.date, 'YYYY-MM-DD') AS tanggal,
            ua.id AS user_a, ua.name AS nama_a,
            ub.id AS user_b, ub.name AS nama_b,
            ABS(EXTRACT(EPOCH FROM (a.check_in_time - b.check_in_time)))::int AS selisih_detik
     FROM attendance a
     JOIN attendance b ON a.date = b.date
     JOIN users ua ON a.user_id = ua.id
     JOIN users ub ON b.user_id = ub.id
     WHERE ${kondisi.join(' AND ')}
       AND ABS(a.latitude - b.latitude) < $${pDekat}
       AND ABS(a.longitude - b.longitude) < $${pDekat}
       AND ABS(EXTRACT(EPOCH FROM (a.check_in_time - b.check_in_time))) < $${pSelang}
     ORDER BY a.date DESC
     LIMIT $${params.length}`,
    params
  );

  return hasil.rows.map((r) => ({
    jenis: 'absen_berdempet',
    tanggal: r.tanggal,
    pegawai: [
      { user_id: r.user_a, nama: r.nama_a },
      { user_id: r.user_b, nama: r.nama_b },
    ],
    selisih_detik: r.selisih_detik,
    keterangan: `${r.nama_a} dan ${r.nama_b} absen dari titik yang sama, `
      + `selisih ${r.selisih_detik} detik.`,
  }));
}

module.exports = {
  perangkatDipakaiBersama, absenBerdempet,
  SELANG_DEKAT_DETIK, DEKAT_DERAJAT,
};
