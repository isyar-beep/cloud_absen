-- ============================================
-- Migration 006: Koreksi absensi
-- Jalankan: psql -U postgres -d cloud_absen -f database/migrations/006_attendance_corrections.sql
--
-- Dua hal:
--
-- 1. attendance_edits -- jejak audit tiap kali admin mengubah absensi.
--    Admin memang berhak penuh mengoreksi data absensi, tapi kewenangan
--    tanpa jejak berbahaya: kalau ada sengketa kehadiran, harus bisa
--    ditunjukkan siapa mengubah apa, kapan, dan atas dasar apa. Nilai
--    lama disimpan supaya perubahan bisa ditelusuri, bahkan dibalik.
--
-- 2. correction_requests -- pegawai mengajukan koreksi, admin memutuskan.
--    Selama ini pegawai yang lupa absen pulang tidak punya jalur resmi
--    selain minta lisan ke admin.
-- ============================================

CREATE TABLE IF NOT EXISTS attendance_edits (
  id SERIAL PRIMARY KEY,
  attendance_id INT NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  edited_by INT REFERENCES users(id) ON DELETE SET NULL,

  -- Nilai sebelum dan sesudah. Disimpan sebagai teks supaya satu tabel
  -- ini bisa mencatat perubahan jam maupun status tanpa kolom terpisah.
  field VARCHAR(30) NOT NULL,
  old_value TEXT,
  new_value TEXT,

  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_edits_attendance ON attendance_edits(attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_edits_created ON attendance_edits(created_at DESC);

CREATE TABLE IF NOT EXISTS correction_requests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Tanggal absensi yang dikoreksi. Sengaja disimpan sebagai tanggal,
  -- bukan attendance_id, karena pegawai juga perlu bisa mengajukan hari
  -- yang catatannya sama sekali belum ada (lupa absen masuk).
  date DATE NOT NULL,

  -- Usulan pegawai. Boleh salah satu saja -- yang lupa absen pulang
  -- cukup mengisi jam pulang.
  requested_check_in TIME,
  requested_check_out TIME,

  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT correction_status_valid CHECK (status IN ('pending', 'approved', 'rejected')),
  -- Pengajuan tanpa usulan jam apa pun tidak ada gunanya.
  CONSTRAINT correction_ada_usulan CHECK (
    requested_check_in IS NOT NULL OR requested_check_out IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_correction_user ON correction_requests(user_id, date);
CREATE INDEX IF NOT EXISTS idx_correction_status ON correction_requests(status);

-- Satu pengajuan menunggu per pegawai per tanggal. Tanpa ini, pegawai
-- bisa menumpuk banyak pengajuan untuk hari yang sama dan admin harus
-- memutuskan berkali-kali untuk satu perkara.
CREATE UNIQUE INDEX IF NOT EXISTS idx_correction_pending_unik
  ON correction_requests(user_id, date)
  WHERE status = 'pending';
