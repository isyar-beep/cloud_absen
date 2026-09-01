-- ============================================
-- Migration 010: Proyek sebagai kluster absensi
-- Jalankan: psql -U postgres -d cloud_absen -f database/migrations/010_projects.sql
--
-- Sistem ini dipakai dinas untuk memantau konsultan yang mereka bayar.
-- Tiap konsultan menurunkan pegawainya ke lokasi proyek yang berbeda-beda,
-- dan dinas perlu melihat kehadiran itu terpisah per proyek.
--
-- KENAPA PROYEK, BUKAN KONSULTAN, YANG JADI KLUSTERNYA.
-- Sekilas sama, karena satu konsultan memang memegang satu proyek. Tapi
-- konsultan bisa diganti di tengah jalan, sementara paket pekerjaannya
-- tetap berjalan sampai selesai. Kalau pegawai menempel pada konsultan,
-- pergantian penanggung jawab memaksa seluruh pegawai dipindahkan satu per
-- satu. Dengan proyek sebagai wadahnya, cukup satu kolom yang diubah.
--
-- Di layar, proyek tetap disajikan berikut nama konsultannya karena begitu
-- cara dinas memikirkannya.
-- ============================================

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,

  -- Lokasi ditulis bebas (nama ruas jalan, desa, kecamatan). Sengaja BUKAN
  -- koordinat: sistem ini tidak pernah membandingkan posisi absen dengan
  -- titik kantor, dan menyimpan koordinat proyek hanya akan mengundang
  -- pembatasan area yang sejak awal ditolak. Koordinat absen tetap direkam
  -- sebagai keterangan, bukan sebagai syarat.
  location VARCHAR(200),

  -- Konsultan penanggung jawab. ON DELETE SET NULL: proyek tidak boleh ikut
  -- hilang hanya karena akun konsultannya dinonaktifkan lalu dihapus --
  -- riwayat absensi di bawahnya masih harus bisa dilaporkan.
  consultant_id INT REFERENCES users(id) ON DELETE SET NULL,

  start_date DATE,
  end_date DATE,

  -- 'berjalan' | 'selesai'. Proyek selesai tidak lagi muncul sebagai
  -- pilihan penugasan, tapi datanya tetap utuh dan tetap bisa dilaporkan.
  status VARCHAR(20) NOT NULL DEFAULT 'berjalan',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_valid;
ALTER TABLE projects
  ADD CONSTRAINT projects_status_valid CHECK (status IN ('berjalan', 'selesai'));

-- Masa berlaku yang terbalik hampir pasti salah ketik, dan diam-diam
-- membuat proyek tidak pernah aktif.
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_periode_valid;
ALTER TABLE projects
  ADD CONSTRAINT projects_periode_valid
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date);

-- ============================================
-- Penugasan pegawai
--
-- Satu pegawai hanya aktif di SATU proyek -- ditetapkan dinas. Karena itu
-- cukup satu kolom di tabel users, bukan tabel penugasan tersendiri.
-- Kalau kelak seorang pegawai boleh merangkap dua proyek, barulah kolom ini
-- dipindah menjadi tabel sendiri.
-- ============================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS project_id INT REFERENCES projects(id) ON DELETE SET NULL;

-- ============================================
-- Proyek pada tiap baris absensi
--
-- INI YANG PALING PENTING. Proyek DICAP saat absen terjadi, bukan dibaca
-- belakangan dari penugasan pegawai.
--
-- Tanpa ini, memindahkan seorang pegawai dari Proyek A ke Proyek B akan
-- ikut memindahkan SELURUH riwayat absennya yang lama ke Proyek B --
-- laporan bulan lalu yang sudah diserahkan ke dinas berubah sendiri tanpa
-- ada yang mengubahnya. Catatan harus merekam keadaan pada saat kejadian,
-- bukan keadaan sekarang.
--
-- Pelajaran yang sama dengan tanggal shift pada migrasi 005.
-- ============================================
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS project_id INT REFERENCES projects(id) ON DELETE SET NULL;

-- ============================================
-- Peran konsultan
--
-- Berada di antara admin dan pegawai: melihat dan menyetujui, tapi hanya
-- untuk proyek yang dipegangnya. Daftar personel tetap dipegang dinas,
-- karena dalam kontrak konsultansi daftar itu bagian dari kontrak --
-- konsultan tidak boleh menambah namanya sendiri.
-- ============================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_valid;
ALTER TABLE users
  ADD CONSTRAINT users_role_valid CHECK (role IN ('admin', 'konsultan', 'staff'));

CREATE INDEX IF NOT EXISTS idx_users_project ON users(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_consultant ON projects(consultant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_project_date ON attendance(project_id, date);

-- Catatan absensi yang sudah ada dibiarkan tanpa proyek. Mengisinya dengan
-- tebakan justru berbahaya: data lama memang terjadi sebelum ada proyek,
-- dan menaruhnya di proyek mana pun akan mengarang sejarah.
