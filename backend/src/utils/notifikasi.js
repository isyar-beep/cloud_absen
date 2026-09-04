const { query } = require('../config/db');
const { sendPushNotifications } = require('./pushNotification');

// ============================================================
// Membuat pemberitahuan.
//
// Satu pintu untuk seluruh kejadian, supaya bentuk pemberitahuan tidak
// berbeda-beda tergantung siapa yang menulisnya.
//
// Dua saluran, dan pembagiannya disengaja:
//   - baris di tabel  -> dibaca web MAUPUN HP, tidak hilang saat aplikasi
//                        ditutup. Ini yang utama.
//   - push Expo       -> hanya sampai ke aplikasi HP, dan hanya bagi yang
//                        punya token. Ini tambahan, bukan pengganti.
//
// Kegagalan push TIDAK menggagalkan pemberitahuannya. Layanan push milik
// pihak lain dan bisa lambat atau mati; kalau kegagalannya dibiarkan
// merambat, pengajuan izin bisa ikut gagal tersimpan hanya karena Expo
// sedang bermasalah. Barisnya tetap ada, dan pemakainya tetap melihatnya
// saat membuka aplikasi.
// ============================================================

async function kirimNotifikasi({ userIds, jenis, judul, pesan, tautan, push = true }) {
  const tujuan = [...new Set((userIds || []).filter(Boolean).map(Number))];
  if (tujuan.length === 0) return { dibuat: 0 };

  const hasil = await query(
    `INSERT INTO notifications (user_id, jenis, judul, pesan, tautan)
     SELECT unnest($1::int[]), $2, $3, $4, $5
     RETURNING id`,
    [tujuan, jenis, judul, pesan || null, tautan || null]
  );

  if (push) {
    try {
      const token = await query(
        `SELECT push_token FROM users
         WHERE id = ANY($1::int[]) AND push_token IS NOT NULL`,
        [tujuan]
      );
      if (token.rows.length > 0) {
        await sendPushNotifications(token.rows.map((r) => ({
          to: r.push_token,
          title: judul,
          body: pesan || '',
          data: { jenis, tautan },
        })));
      }
    } catch (err) {
      // Sengaja hanya dicatat. Lihat catatan di atas.
      console.error('Push gagal, pemberitahuan tetap tersimpan:', err.message);
    }
  }

  return { dibuat: hasil.rows.length };
}

// Siapa yang perlu tahu ketika seorang pegawai melakukan sesuatu.
//
// Konsultan penanggung jawab proyeknya DAN seluruh admin. Keduanya, bukan
// salah satu: konsultan yang biasanya memutuskan, tapi dinas harus tetap
// bisa bertindak bila konsultannya berhalangan -- dan itu mustahil kalau
// dinas tidak pernah tahu ada pengajuan masuk.
//
// Pegawainya sendiri dikecualikan: tidak ada gunanya diberi tahu tentang
// perbuatannya sendiri.
async function penyeliaPegawai(userId) {
  const hasil = await query(
    `SELECT DISTINCT p.id FROM users p
     WHERE (p.role = 'admin'
            OR p.id = (SELECT pj.consultant_id FROM users u
                       JOIN projects pj ON u.project_id = pj.id
                       WHERE u.id = $1))
       AND p.is_active = TRUE
       AND p.id <> $1`,
    [userId]
  );
  return hasil.rows.map((r) => r.id);
}

module.exports = { kirimNotifikasi, penyeliaPegawai };
