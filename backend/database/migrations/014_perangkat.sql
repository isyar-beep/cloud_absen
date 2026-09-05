-- ============================================
-- Migration 014: Token push per perangkat, dan pengenalan perangkat
--
-- DUA HAL, DAN YANG PERTAMA MEMPERBAIKI CACAT YANG SUDAH ADA.
--
-- 1. users.push_token adalah SATU KOLOM (migrasi 002). Satu pengguna =
--    satu token. Perangkat yang login terakhir MENIMPA token sebelumnya.
--
--    Akibat yang sudah terasa sekarang: pegawai yang punya HP dan tablet
--    hanya menerima pemberitahuan di perangkat yang terakhir dipakai
--    login. Yang lain diam tanpa sebab yang terlihat.
--
--    Akibat yang lebih berat, dan ini yang membuatnya mendesak: kalau ada
--    yang login memakai akun pegawai di HP lain, SELURUH pemberitahuan
--    pegawai itu mengalir ke HP tersebut. Termasuk peringatan keamanan
--    apa pun yang dibangun kemudian -- alarm yang kabelnya tersambung ke
--    rumah pencuri.
--
-- 2. Tabel perangkat: supaya sistem bisa mengenali "perangkat ini sudah
--    pernah dipakai akun ini" dan memberi tahu pemiliknya saat ada yang
--    baru. Setara pemberitahuan "ada login baru di perangkat X".
--
-- KENAPA DUA TABEL, BUKAN SATU.
--
-- Sekilas keduanya "perangkat", tapi isinya menjawab pertanyaan yang
-- berbeda dan hidupnya berbeda:
--
--   push_tokens -> "ke mana pemberitahuan dikirim". Hanya ada untuk
--     aplikasi HP; peramban tidak punya token push. Barisnya dibuang
--     begitu Expo bilang perangkatnya sudah tidak terdaftar.
--
--   perangkat   -> "apakah akun ini pernah dipakai dari sini". Ada untuk
--     HP MAUPUN peramban. Barisnya justru harus bertahan, sebab yang
--     dijawabnya adalah pertanyaan tentang masa lalu.
--
-- Menggabungkannya berarti menghapus riwayat pengenalan setiap kali
-- sebuah token mati -- dan peringatan "perangkat baru" akan menyala lagi
-- untuk perangkat yang sebenarnya sudah lama dikenal.
--
-- Jalankan pada database yang SUDAH ada.
--
--   Database via Docker (cara yang dipakai README opsi A):
--     docker exec -i cloud_absen_db psql -U postgres -d cloud_absen \
--       < database/migrations/014_perangkat.sql
--
--   PowerShell tidak mengenal pengalihan "<", jadi di Windows:
--     Get-Content database/migrations/014_perangkat.sql | `
--       docker exec -i cloud_absen_db psql -U postgres -d cloud_absen
--
--   PostgreSQL terpasang langsung (README opsi B):
--     psql -U postgres -d cloud_absen -f database/migrations/014_perangkat.sql
-- ============================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Token push, satu baris per perangkat
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- UNIQUE pada tokennya sendiri, bukan pada (user_id, token).
  --
  -- Satu token Expo menunjuk satu pemasangan aplikasi pada satu HP. Kalau
  -- HP itu dipakai login oleh pegawai lain, tokennya harus BERPINDAH
  -- pemilik, bukan tercatat dua kali -- kalau tercatat dua kali,
  -- pemberitahuan milik dua orang berbeda sama-sama terkirim ke HP yang
  -- sama, dan masing-masing membaca pemberitahuan yang bukan haknya.
  token VARCHAR(255) NOT NULL UNIQUE,

  -- Diisi expo-device di aplikasi HP. Dipakai menyusun kalimat
  -- pemberitahuan yang bisa dikenali orang: "Samsung Galaxy S21",
  -- bukan deretan huruf token.
  merek VARCHAR(60),
  model VARCHAR(120),
  os VARCHAR(60),

  terdaftar_pada TIMESTAMP DEFAULT NOW(),
  terakhir_dipakai TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);

-- Pindahkan token yang sudah ada supaya tidak ada pegawai yang kehilangan
-- pemberitahuannya saat migrasi ini dipasang. ON CONFLICT menjaga
-- perintah ini aman diulang.
INSERT INTO push_tokens (user_id, token)
SELECT id, push_token FROM users
WHERE push_token IS NOT NULL AND push_token <> ''
ON CONFLICT (token) DO NOTHING;

-- Kolom lamanya dibuang. Membiarkannya berarti dua sumber kebenaran untuk
-- hal yang sama, dan cepat atau lambat ada kode yang membaca yang salah --
-- diam-diam, karena pemberitahuan yang tidak terkirim tidak menimbulkan
-- galat apa pun.
ALTER TABLE users DROP COLUMN IF EXISTS push_token;

-- ------------------------------------------------------------
-- 2. Perangkat yang dikenal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS perangkat (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Penanda yang dibuat KLIEN sekali lalu disimpan: UUID acak di
  -- penyimpanan aplikasi (HP) atau localStorage (peramban).
  --
  -- Ini BUKAN penanda kelas keamanan, dan tidak berpura-pura begitu.
  -- Bisa hilang kalau data aplikasi dibersihkan, dan bisa diubah orang
  -- yang tahu caranya. Tapi cara gagalnya aman: penanda yang hilang
  -- membuat perangkat lama tampak baru, sehingga muncul SATU peringatan
  -- tambahan. Merepotkan sedikit, tidak berbahaya.
  --
  -- Android sengaja tidak menyediakan penanda permanen demi privasi, jadi
  -- tidak ada pilihan yang lebih baik dari ini -- dan untuk pertanyaan
  -- "pernahkah akun ini dipakai dari sini", ini sudah memadai.
  sidik VARCHAR(64) NOT NULL,

  -- Sudah berupa kalimat siap baca: "Samsung Galaxy S21" atau
  -- "Chrome di Windows". Disusun klien, karena hanya klien yang tahu
  -- dirinya sendiri -- peramban tidak memberi tahu merek laptopnya, dan
  -- User-Agent mentah tidak layak ditampilkan ke pegawai.
  nama VARCHAR(160),

  pertama_pada TIMESTAMP DEFAULT NOW(),
  terakhir_pada TIMESTAMP DEFAULT NOW(),

  -- Satu perangkat dikenal terpisah untuk tiap pengguna. HP yang dipakai
  -- dua akun berbeda memang dua hubungan yang berbeda, dan masing-masing
  -- pemilik akun berhak diberi tahu saat akunnya dipakai dari sana.
  UNIQUE (user_id, sidik)
);

CREATE INDEX IF NOT EXISTS idx_perangkat_user ON perangkat(user_id);

COMMIT;

-- Untuk memeriksa hasilnya:
--
--   SELECT COUNT(*) AS token_dipindahkan FROM push_tokens;
--   SELECT COUNT(*) FROM information_schema.columns
--    WHERE table_name = 'users' AND column_name = 'push_token';  -- harus 0
