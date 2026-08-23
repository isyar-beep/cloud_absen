-- ============================================
-- Migration 007: Penetapan WFA (Work From Anywhere)
-- Jalankan: psql -U postgres -d cloud_absen -f database/migrations/007_wfa.sql
--
-- WFA ditetapkan ADMIN, bukan diajukan pegawai: admin menandai rentang
-- tanggal seorang pegawai bekerja dari luar kantor. Pegawainya tetap absen
-- berfoto seperti biasa; yang berbeda hanya catatannya ditandai WFA supaya
-- terbaca di riwayat, galeri, dan laporan.
--
-- CATATAN PENTING: sistem ini belum pernah memvalidasi lokasi absen --
-- koordinat hanya direkam, tidak dibandingkan dengan titik kantor. Jadi
-- kolom work_mode saat ini murni penanda untuk pelaporan. Kalau nanti
-- validasi radius kantor dipasang, di sinilah pengecualiannya dibaca.
-- ============================================

-- Mode kerja pada tiap catatan absensi. Diisi saat absen masuk, mengikuti
-- penetapan WFA yang berlaku pada tanggal shift-nya.
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS work_mode VARCHAR(10) NOT NULL DEFAULT 'wfo';

ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_work_mode_valid;
ALTER TABLE attendance
  ADD CONSTRAINT attendance_work_mode_valid CHECK (work_mode IN ('wfo', 'wfa'));

CREATE TABLE IF NOT EXISTS wfa_assignments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  note TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT wfa_rentang_wajar CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_wfa_user_rentang ON wfa_assignments(user_id, start_date, end_date);

-- Cegah dua penetapan WFA yang tumpang tindih untuk pegawai yang sama.
-- Dijaga di tingkat database, bukan hanya di kode: dua admin yang menyimpan
-- bersamaan tidak boleh menghasilkan rentang ganda yang saling menimpa.
--
-- Butuh ekstensi btree_gist. Kalau tidak tersedia (mis. pengguna database
-- bukan superuser), migration tetap lanjut -- pemeriksaan tumpang tindih di
-- controller yang jadi penjaganya.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS btree_gist;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wfa_tidak_tumpang_tindih'
  ) THEN
    ALTER TABLE wfa_assignments
      ADD CONSTRAINT wfa_tidak_tumpang_tindih
      EXCLUDE USING gist (
        user_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
      );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Lewati exclusion constraint WFA: %', SQLERRM;
END $$;
