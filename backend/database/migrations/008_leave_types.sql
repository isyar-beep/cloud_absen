-- ============================================
-- Migration 008: Jenis pengajuan (izin/sakit/cuti) + lampiran dokumen
-- Jalankan: psql -U postgres -d cloud_absen -f database/migrations/008_leave_types.sql
--
-- Selama ini semua ketidakhadiran berencana masuk satu pintu bernama
-- "izin". Padahal izin sehari, sakit, dan cuti beberapa hari punya arti
-- berbeda bagi HRD walau sama-sama tidak masuk kerja.
--
-- Yang dipisah cuma JENIS PENGAJUANNYA. Status di tabel absensi tetap
-- 'izin' untuk ketiganya -- mengubah daftar status absensi akan merusak
-- semua rumus attendance rate, laporan, dan grafik yang sudah ada, dan
-- tidak ada gunanya: buat perhitungan kehadiran ketiganya sama saja.
-- Rincian jenisnya dibaca dari tabel leave_requests saat diperlukan.
--
-- Cuti sengaja TANPA kuota tahunan. Kalau nanti kuota diperlukan, itu
-- tabel tersendiri -- bukan kolom di sini.
-- ============================================

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'izin';

ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_type_valid;
ALTER TABLE leave_requests
  ADD CONSTRAINT leave_type_valid CHECK (type IN ('izin', 'sakit', 'cuti'));

-- Lampiran opsional: surat dokter, surat tugas, surat cuti. Disimpan
-- sebagai path relatif ke folder uploads, sama seperti foto absensi,
-- supaya pindah server tidak merusak seluruh URL lama.
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS document_url TEXT,
  ADD COLUMN IF NOT EXISTS document_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_leave_requests_type ON leave_requests(type);
