-- ============================================
-- Migration 003: Shift kerja per pegawai
-- Jalankan: psql -U postgres -d cloud_absen -f database/migrations/003_shifts.sql
-- ============================================

CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS shift_id INT REFERENCES shifts(id) ON DELETE SET NULL;

-- Shift default supaya pegawai yang sudah ada tetap punya batas jam masuk (08:00, sama seperti sebelumnya)
INSERT INTO shifts (name, start_time, end_time)
SELECT 'Reguler', '08:00', '17:00'
WHERE NOT EXISTS (SELECT 1 FROM shifts WHERE name = 'Reguler');

UPDATE users SET shift_id = (SELECT id FROM shifts WHERE name = 'Reguler' LIMIT 1)
WHERE shift_id IS NULL;
