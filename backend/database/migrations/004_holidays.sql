-- ============================================
-- Migration 004: Hari libur nasional/cuti bersama
-- Jalankan: psql -U postgres -d cloud_absen -f database/migrations/004_holidays.sql
-- ============================================

CREATE TABLE IF NOT EXISTS holidays (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
