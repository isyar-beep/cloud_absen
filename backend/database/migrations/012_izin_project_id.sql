-- ============================================
-- Migration 012: Pulihkan proyek pada baris izin yang terlanjur kosong
--
-- Persetujuan izin/sakit/cuti menulis baris attendance berstatus 'izin',
-- dan sampai perbaikan ini baris itu dibuat TANPA project_id. Konsultan
-- menyaring seluruh data lewat a.project_id, dan NULL tidak pernah cocok
-- dengan syarat apa pun -- jadi setiap hari izin yang disetujui lenyap
-- dari layar konsultan: riwayat, galeri, laporan.
--
-- Yang dilihat konsultan bukan "Izin" melainkan tidak ada catatan sama
-- sekali. Pegawai yang justru sudah benar mengurus izinnya terbaca
-- seperti menghilang tanpa kabar.
--
-- Kode yang menulisnya sudah diperbaiki. Berkas ini mengurus baris yang
-- terlanjur tersimpan sebelum perbaikan itu.
--
-- CARA MENEBAK PROYEKNYA, DAN KENAPA BUKAN "AMBIL SAJA PENUGASAN
-- SEKARANG".
--
-- Penugasan hari ini belum tentu penugasan saat izin itu diambil.
-- Pegawai yang sudah pindah proyek akan membuat hari izin lamanya
-- tercap di proyek yang tidak ada hubungannya -- konsultan baru melihat
-- izin yang tidak pernah terjadi di bawahnya, konsultan lama kehilangan
-- catatan yang memang haknya. Itu bukan memperbaiki data, itu
-- mengarangnya.
--
-- Maka urutannya:
--
--   1. Baris absensi TERDEKAT milik pegawai yang sama yang punya proyek.
--      Ini bukti dari datanya sendiri: di tanggal sekitar situ, pegawai
--      itu memang tercatat hadir di proyek tersebut.
--
--   2. Kalau pegawai itu tidak punya SATU PUN baris berproyek -- misalnya
--      baru masuk lalu langsung izin -- barulah penugasannya sekarang
--      dipakai. Tidak ada bukti lain, dan tidak ada bukti yang
--      bertentangan.
--
--   3. Kalau keduanya tidak ada, dibiarkan NULL. Menebak tanpa dasar
--      lebih buruk daripada mengakui tidak tahu.
--
-- Hanya menyentuh baris yang memang lahir dari jalur izin: status 'izin'
-- DAN belum pernah check-in. Absensi sungguhan tidak disentuh sama
-- sekali.
--
-- Aman dijalankan berkali-kali: yang sudah punya project_id dilewati.
--
-- Jalankan pada database yang SUDAH ada.
--
--   Database via Docker (cara yang dipakai README opsi A):
--     docker exec -i cloud_absen_db psql -U postgres -d cloud_absen \
--       < database/migrations/012_izin_project_id.sql
--
--   PowerShell tidak mengenal pengalihan "<", jadi di Windows:
--     Get-Content database/migrations/012_izin_project_id.sql | `
--       docker exec -i cloud_absen_db psql -U postgres -d cloud_absen
--
--   PostgreSQL terpasang langsung (README opsi B):
--     psql -U postgres -d cloud_absen -f database/migrations/012_izin_project_id.sql
-- ============================================

BEGIN;

-- Langkah 1: dari baris absensi terdekat milik pegawai yang sama.
--
-- ORDER BY selisih hari, lalu tanggal menurun sebagai pemutus: kalau ada
-- dua baris berjarak sama (satu sebelum, satu sesudah), yang dipilih yang
-- lebih baru. Tanpa pemutus itu hasilnya bergantung urutan baca PostgreSQL
-- dan bisa berbeda antar server.
UPDATE attendance a
SET project_id = (
  SELECT b.project_id
  FROM attendance b
  WHERE b.user_id = a.user_id
    AND b.project_id IS NOT NULL
  ORDER BY abs(b.date - a.date), b.date DESC
  LIMIT 1
)
WHERE a.project_id IS NULL
  AND a.status = 'izin'
  AND a.check_in_time IS NULL;

-- Langkah 2: pegawai yang tidak punya satu pun baris berproyek. Sisa
-- setelah langkah 1 memang berarti tidak ada bukti dari absensinya, jadi
-- penugasannya sekarang adalah satu-satunya keterangan yang ada -- dan
-- tidak ada yang membantahnya.
UPDATE attendance a
SET project_id = u.project_id
FROM users u
WHERE a.user_id = u.id
  AND a.project_id IS NULL
  AND a.status = 'izin'
  AND a.check_in_time IS NULL
  AND u.project_id IS NOT NULL;

-- Sisanya sengaja dibiarkan NULL: pegawainya tidak punya riwayat proyek
-- apa pun DAN belum ditugaskan sekarang. Tidak ada dasar untuk menebak.

COMMIT;

-- Untuk memeriksa hasilnya:
--
--   SELECT status,
--          COUNT(*) FILTER (WHERE project_id IS NULL) AS tanpa_proyek,
--          COUNT(*) AS total
--   FROM attendance
--   GROUP BY status
--   ORDER BY status;
