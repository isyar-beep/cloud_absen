-- ============================================
-- Schema Database: Cloud Absen
-- Database: PostgreSQL
-- ============================================

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'staff', -- 'admin' | 'staff'
  department_id INT REFERENCES departments(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIMESTAMP,
  check_out_time TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'hadir', -- 'hadir' | 'terlambat' | 'izin' | 'alpha'
  reason TEXT,
  photo_in_url VARCHAR(255),
  photo_out_url VARCHAR(255),
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date) -- satu pegawai hanya 1 record absensi per hari
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  detail TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index untuk mempercepat query yang sering dipakai
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);

-- Data awal contoh departemen
INSERT INTO departments (name) VALUES
  ('IT'), ('HR'), ('Sales'), ('Finance'), ('Operations')
ON CONFLICT (name) DO NOTHING;

-- Akun admin default (password: admin123 -- WAJIB diganti setelah login pertama)
-- Hash ini dibuat dari bcrypt('admin123', 10) -- lihat backend/database/seed.js untuk generate ulang
