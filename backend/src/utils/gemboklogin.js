// ============================================================
// Pembatasan percobaan login per AKUN.
//
// Yang sudah ada sebelumnya membatasi per ALAMAT IP. Itu berguna untuk
// menahan satu mesin yang menembak membabi buta, tapi tidak menahan
// serangan yang justru paling masuk akal di sini: satu akun tertentu
// -- misalnya admin dinas, yang emailnya diketahui semua orang --
// ditebak pelan-pelan dari banyak alamat IP sekaligus. Setiap IP tetap
// di bawah ambangnya, jadi penjagaan per IP tidak pernah menyala.
//
// Karena itu hitungannya di sini dipasang pada EMAIL yang dikirim,
// terlepas dari IP-nya.
//
// Dihitung berdasarkan email yang DIKIRIM, bukan akun yang ditemukan.
// Kalau hanya email yang benar-benar ada yang dihitung, maka bedanya
// balasan antara "email tidak dikenal" dan "akun terkunci" akan
// memberi tahu penebak akun mana yang nyata -- persis yang berusaha
// disembunyikan oleh pesan "Email atau password salah".
//
// Disimpan di memori, bukan di basis data. Sistem ini berjalan pada satu
// server, jadi satu proses sudah melihat seluruh percobaan; menulisnya ke
// basis data hanya menambah satu tulisan pada setiap login gagal tanpa
// menambah keamanan apa pun. Bila kelak berjalan di beberapa proses,
// bagian inilah yang harus pindah ke Redis atau tabel -- dan hanya
// bagian ini.
// ============================================================

// Ambangnya jauh di atas salah ketik yang wajar, tapi jauh di bawah
// jumlah tebakan yang berguna bagi penyerang.
const BATAS_GAGAL = 8;

// Selang penghitungan: kegagalan yang lebih tua dari ini tidak dihitung
// lagi. Tanpa ini, orang yang salah ketik sekali sebulan akan terkunci
// setelah delapan bulan.
const SELANG_HITUNG = 15 * 60 * 1000;

// Lama terkunci setelah ambangnya terlampaui. Sengaja tidak selamanya:
// mengunci permanen berarti siapa pun yang tahu email seorang pegawai
// bisa mengunci orang itu dari pekerjaannya kapan saja.
const LAMA_GEMBOK = 15 * 60 * 1000;

const catatan = new Map();

function kunci(email) {
  return String(email || '').trim().toLowerCase();
}

// Dipanggil dari luar hanya oleh pengujian; di jalur biasa pembersihan
// terjadi sendiri saat catatannya disentuh.
function lupakanSemua() {
  catatan.clear();
}

function lupakan(email) {
  catatan.delete(kunci(email));
}

// Membuang catatan yang sudah tidak berguna. Dipanggil setiap kali ada
// login gagal supaya Map-nya tidak tumbuh terus oleh email acak yang
// ditembakkan sekali lalu ditinggalkan.
function sapu(sekarang) {
  for (const [k, c] of catatan) {
    if (c.gembokSampai <= sekarang && c.terakhir + SELANG_HITUNG <= sekarang) {
      catatan.delete(k);
    }
  }
}

/**
 * Apakah akun ini sedang terkunci?
 * @returns {{terkunci: boolean, sisaDetik: number}}
 */
function periksa(email) {
  const c = catatan.get(kunci(email));
  const sekarang = Date.now();
  if (!c || c.gembokSampai <= sekarang) return { terkunci: false, sisaDetik: 0 };
  return { terkunci: true, sisaDetik: Math.ceil((c.gembokSampai - sekarang) / 1000) };
}

/**
 * Mencatat satu login gagal.
 * @returns {{terkunci: boolean, sisaDetik: number, sisaPercobaan: number}}
 */
function catatGagal(email) {
  const k = kunci(email);
  const sekarang = Date.now();
  sapu(sekarang);

  let c = catatan.get(k);

  // Catatan yang selangnya sudah lewat dimulai dari nol lagi.
  if (!c || c.terakhir + SELANG_HITUNG <= sekarang) {
    c = { gagal: 0, terakhir: sekarang, gembokSampai: 0 };
  }

  c.gagal += 1;
  c.terakhir = sekarang;

  if (c.gagal >= BATAS_GAGAL) {
    c.gembokSampai = sekarang + LAMA_GEMBOK;
    // Hitungan disetel ulang supaya sesudah gembok terbuka orangnya
    // mendapat kesempatan penuh lagi, bukan langsung terkunci oleh satu
    // salah ketik berikutnya.
    c.gagal = 0;
  }

  catatan.set(k, c);
  return {
    terkunci: c.gembokSampai > sekarang,
    sisaDetik: c.gembokSampai > sekarang ? Math.ceil((c.gembokSampai - sekarang) / 1000) : 0,
    sisaPercobaan: Math.max(0, BATAS_GAGAL - c.gagal),
  };
}

// Login berhasil menghapus seluruh catatan akun itu.
function catatBerhasil(email) {
  catatan.delete(kunci(email));
}

// Hanya untuk pengujian: membuktikan penyapuannya benar-benar
// membuang, bukan sekadar berhenti mengunci.
function jumlahCatatan() {
  return catatan.size;
}

module.exports = {
  periksa, catatGagal, catatBerhasil, lupakan, lupakanSemua, jumlahCatatan,
  BATAS_GAGAL, SELANG_HITUNG, LAMA_GEMBOK,
};
