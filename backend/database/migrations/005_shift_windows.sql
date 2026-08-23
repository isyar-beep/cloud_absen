-- ============================================
-- Migration 005: Jendela waktu absen per shift
-- Jalankan: psql -U postgres -d cloud_absen -f database/migrations/005_shift_windows.sql
--
-- Sebelumnya absen bisa dikirim kapan saja sepanjang hari. Sekarang tiap
-- shift punya jendela waktunya sendiri, dihitung dalam MENIT relatif
-- terhadap jam mulai/selesai shift -- bukan jam tetap -- supaya shift pagi,
-- siang, dan malam memakai aturan yang sama.
--
-- Nilai bawaan sengaja longgar di sisi penutupan: yang perlu dicegah adalah
-- absen jauh di luar jam kerja, bukan menghukum pegawai yang telat.
-- ============================================

ALTER TABLE shifts
  -- Absen masuk dibuka 30 menit sebelum jam shift mulai.
  ADD COLUMN IF NOT EXISTS checkin_open_minutes INT NOT NULL DEFAULT 30,
  -- Ditutup 4 jam setelah shift mulai. Lewat dari itu dianggap tidak masuk
  -- dan harus lewat pengajuan izin atau koreksi admin.
  ADD COLUMN IF NOT EXISTS checkin_close_minutes INT NOT NULL DEFAULT 240,
  -- Absen pulang dibuka 15 menit sebelum shift selesai.
  ADD COLUMN IF NOT EXISTS checkout_open_minutes INT NOT NULL DEFAULT 15,
  -- Ditutup 6 jam setelah shift selesai, memberi ruang untuk lembur.
  ADD COLUMN IF NOT EXISTS checkout_close_minutes INT NOT NULL DEFAULT 360;

-- Jaga-jaga dari nilai yang tidak masuk akal saat admin mengedit shift.
ALTER TABLE shifts
  DROP CONSTRAINT IF EXISTS shifts_jendela_wajar;
ALTER TABLE shifts
  ADD CONSTRAINT shifts_jendela_wajar CHECK (
    checkin_open_minutes    BETWEEN 0 AND 720 AND
    checkin_close_minutes   BETWEEN 0 AND 1440 AND
    checkout_open_minutes   BETWEEN 0 AND 720 AND
    checkout_close_minutes  BETWEEN 0 AND 1440
  );
