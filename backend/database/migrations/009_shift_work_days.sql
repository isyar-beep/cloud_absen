-- ============================================
-- Migration 009: Hari kerja per shift
-- Jalankan: psql -U postgres -d cloud_absen -f database/migrations/009_shift_work_days.sql
--
-- Sebelumnya Sabtu & Minggu tertutup untuk SEMUA orang, dipaku di kode
-- (workday.js dan penanda alpha). Divisi yang memang bertugas akhir pekan
-- -- piket, pengawas lapangan, shift malam Sabtu -- sama sekali tidak bisa
-- absen, dan penanda alpha pun melewati mereka.
--
-- Hari kerja sekarang menempel di SHIFT, bukan di kode. Nilainya nomor hari
-- ala Postgres EXTRACT(DOW) dan JavaScript getDay(): 0=Minggu ... 6=Sabtu.
-- Dua sumber itu memakai penomoran yang sama, jadi tidak ada penerjemahan
-- di tengah yang bisa salah.
--
-- Default '{1,2,3,4,5}' = Senin-Jumat, persis perilaku sebelum migration ini.
-- Shift yang sudah ada tidak berubah perilakunya sedikit pun.
-- ============================================

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS work_days SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5}';

-- Jaga supaya isinya benar-benar nomor hari dan tidak pernah kosong. Tanpa
-- ini, satu salah ketik di panel admin bisa membuat sebuah shift tidak punya
-- hari kerja sama sekali -- pegawainya terkunci total tanpa pesan yang
-- menjelaskan sebabnya.
--
-- Nilai kembar sengaja tidak dicegah di sini: CHECK di Postgres tidak boleh
-- memuat subquery, dan kembar pun tidak berbahaya karena pemeriksaannya
-- memakai keanggotaan (= ANY), bukan hitungan. Controller tetap merapikan
-- masukan jadi urut dan unik sebelum menyimpan.
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_work_days_valid;
ALTER TABLE shifts ADD CONSTRAINT shifts_work_days_valid CHECK (
  array_length(work_days, 1) BETWEEN 1 AND 7
  AND work_days <@ '{0,1,2,3,4,5,6}'::SMALLINT[]
);
