-- ============================================
-- Migration 011: Pemberitahuan dalam aplikasi
--
-- Sebelumnya satu-satunya pemberitahuan yang ada adalah push Expo yang
-- DIKIRIM MANUAL oleh admin ke pegawai. Arah sebaliknya tidak ada sama
-- sekali: pengajuan izin masuk tanpa ada yang tahu sampai seseorang
-- kebetulan membuka menu Pengajuan.
--
-- Push saja tidak cukup untuk menutup itu, karena admin dan konsultan
-- bekerja di WEB sedangkan push Expo hanya sampai ke aplikasi HP. Maka
-- pemberitahuannya disimpan sebagai baris di sini: web membacanya lewat
-- lonceng, HP membacanya di daftar yang sama, dan push tinggal menjadi
-- pengantar tambahan bagi yang memang memakai aplikasi HP.
--
-- Menyimpannya juga berarti pemberitahuan tidak hilang saat aplikasi
-- ditutup -- hal yang tidak bisa dijamin push.
--
-- Jalankan: docker exec -i cloud_absen_db psql -U postgres -d cloud_absen \
--             < database/migrations/011_notifications.sql
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,

  -- Penerima. Dihapus bersama akunnya: pemberitahuan milik akun yang sudah
  -- tidak ada tidak punya arti apa pun.
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Jenis kejadian. Dipakai layar untuk memilih ikon dan warna, dan nanti
  -- untuk menyaring bila jenisnya bertambah banyak.
  jenis VARCHAR(40) NOT NULL,

  judul VARCHAR(150) NOT NULL,
  pesan TEXT,

  -- Alamat yang dituju saat pemberitahuannya diketuk, mis.
  -- "/admin/leaves". Pemberitahuan yang tidak bisa ditindaklanjuti hanya
  -- menambah kebisingan; hampir semuanya harus punya tujuan.
  tautan VARCHAR(200),

  -- NULL berarti belum dibaca. Disimpan sebagai waktu, bukan boolean,
  -- karena "kapan dibaca" kadang perlu ditelusuri dan boolean membuang
  -- keterangan itu tanpa menghemat apa pun.
  dibaca_pada TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Kueri yang paling sering: "pemberitahuan saya, yang terbaru dulu" dan
-- "berapa yang belum saya baca". Keduanya dilayani indeks ini.
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_belum_dibaca
  ON notifications(user_id) WHERE dibaca_pada IS NULL;
