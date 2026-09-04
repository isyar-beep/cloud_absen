const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================
// Masa simpan foto absensi dan lampiran pengajuan.
//
// Yang dibuang hanya BERKASNYA, bukan baris absensinya. Ini pemisahan
// yang membuat penyimpanan berhenti tumbuh tanpa kehilangan riwayat:
// baris absensi -- tanggal, jam, status, koordinat -- kecil sekali dan
// tetap disimpan penuh, sedangkan foto yang menghabiskan disk dibuang
// setelah tidak lagi dipakai memeriksa apa pun.
//
// SATU HAL YANG TIDAK BOLEH DILANGGAR: penghapusan hanya boleh berjalan
// untuk bulan yang berkasnya sudah disalin keluar DAN salinannya sudah
// dibuktikan utuh. Dinas menyimpan sendiri foto tiap tahun sebagai
// datanya; penghapusan yang berjalan sebelum penyalinan itu bukan
// penghematan disk, melainkan penghancuran data orang lain.
//
// Karena itu berkas ini tidak menghapus apa pun. Yang disediakannya:
//
//   arsipkanBulan -> menyalin satu bulan ke tempat lain, memeriksa sha256
//                    tiap berkas hasil salinan, lalu menulis manifes.
//   bolehDihapus  -> menjawab apakah satu bulan sudah aman dihapus.
//
// Penghapusannya sendiri tetap milik database/purge-photos.js yang sudah
// ada sejak awal -- ia yang tahu mengosongkan photo_in_url di basis data,
// dan memisahkan itu ke dua tempat hanya akan membuat keduanya berbeda
// diam-diam.
//
// Guard itu tidak bisa membuktikan dinas sudah mengambil salinannya --
// tidak ada kode yang bisa. Yang bisa dibuktikan: seseorang benar-benar
// menjalankan penyalinan, dan hasil salinannya benar-benar sama persis
// dengan aslinya. Itu jauh lebih baik daripada percaya bahwa seseorang
// mungkin sudah mengingatnya.
// ============================================================

// Bawaan 2 tahun: menutup satu tahun anggaran penuh ditambah masa
// pemeriksaannya di tahun berikutnya, dengan sisa kelonggaran.
//
// Diambil dari PHOTO_RETENTION_YEARS, tombol yang SAMA dengan yang
// dipakai purge-photos.js. Memberi berkas ini tombolnya sendiri akan
// membuat pengarsipan dan penghapusan memakai batas yang berbeda tanpa
// ada yang menyadarinya -- dan bentuk kegagalannya paling buruk: foto
// yang belum diarsipkan justru sudah masuk daftar hapus.
const TAHUN_SIMPAN = Number(process.env.PHOTO_RETENTION_YEARS) || 2;
const BULAN_SIMPAN = TAHUN_SIMPAN * 12;

const JENIS = ['absensi', 'dokumen'];

// Bulan dijadikan satu bilangan supaya perbandingannya tidak terpeleset
// di pergantian tahun -- "2025-01" lebih tua dari "2024-12" kalau
// dibandingkan sebagai teks.
function nomorBulan(tahun, bulan) {
  return tahun * 12 + (bulan - 1);
}

function uraikanNamaBulan(nama) {
  const c = /^(\d{4})-(\d{2})$/.exec(nama);
  if (!c) return null;
  const tahun = Number(c[1]);
  const bulan = Number(c[2]);
  if (bulan < 1 || bulan > 12) return null;
  return { tahun, bulan, nomor: nomorBulan(tahun, bulan) };
}

/**
 * Apakah satu folder bulan sudah lewat masa simpan?
 *
 * Sengaja memakai pembandingan yang KETAT (<, bukan <=). Folder "2024-09"
 * berisi berkas berumur 23 sampai 24 bulan pada September 2026; membuang
 * folder itu berarti ada berkas yang dibuang sebelum genap 24 bulan.
 * Ketika ragu, yang disimpan lebih lama -- kelebihan simpan sebulan hanya
 * memakan disk, sedangkan kekurangan simpan sehari bisa berarti bukti
 * yang hilang saat diperiksa.
 */
function lewatMasaSimpan(namaBulan, { bulanSimpan = BULAN_SIMPAN, sekarang = new Date() } = {}) {
  const b = uraikanNamaBulan(namaBulan);
  if (!b) return false;
  const kini = nomorBulan(sekarang.getFullYear(), sekarang.getMonth() + 1);
  return b.nomor < kini - bulanSimpan;
}

function sha256(berkas) {
  return crypto.createHash('sha256').update(fs.readFileSync(berkas)).digest('hex');
}

// Daftar folder bulan yang ada di bawah satu jenis.
function daftarBulan(dasar, jenis) {
  const dir = path.join(dasar, jenis);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((n) => uraikanNamaBulan(n))
    .filter((n) => fs.statSync(path.join(dir, n)).isDirectory())
    .sort();
}

function daftarBerkas(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((n) => fs.statSync(path.join(dir, n)).isFile())
    .sort();
}

function jalurManifes(arsipDir, jenis, bulan) {
  return path.join(arsipDir, jenis, `${bulan}.manifes.json`);
}

/**
 * Menyalin satu bulan ke direktori arsip dan membuktikan salinannya utuh.
 *
 * Yang dibandingkan sha256 berkas HASIL SALINAN yang dibaca ulang dari
 * disk, bukan sekadar ukurannya. Salinan yang terpotong di tengah karena
 * disk penuh berukuran berbeda dan akan tertangkap; salinan yang rusak
 * satu bita tetap berukuran sama dan hanya tertangkap oleh sha256.
 */
function arsipkanBulan({ dasar, arsipDir, jenis, bulan }) {
  const asal = path.join(dasar, jenis, bulan);
  const tujuan = path.join(arsipDir, jenis, bulan);
  const berkas = daftarBerkas(asal);

  fs.mkdirSync(tujuan, { recursive: true });

  const catatanBerkas = [];
  for (const nama of berkas) {
    const dari = path.join(asal, nama);
    const ke = path.join(tujuan, nama);
    const cap = sha256(dari);

    fs.copyFileSync(dari, ke);

    const capSalinan = sha256(ke);
    if (capSalinan !== cap) {
      throw new Error(
        `Salinan ${nama} tidak sama dengan aslinya. Arsip dibatalkan supaya ` +
        'penghapusan tidak pernah berjalan atas salinan yang rusak.'
      );
    }
    catatanBerkas.push({ nama, ukuran: fs.statSync(dari).size, sha256: cap });
  }

  const manifes = {
    jenis,
    bulan,
    dibuat: new Date().toISOString(),
    jumlah: catatanBerkas.length,
    total_bita: catatanBerkas.reduce((a, b) => a + b.ukuran, 0),
    berkas: catatanBerkas,
  };

  const jm = jalurManifes(arsipDir, jenis, bulan);
  fs.mkdirSync(path.dirname(jm), { recursive: true });
  fs.writeFileSync(jm, JSON.stringify(manifes, null, 2));

  return manifes;
}

/**
 * Memeriksa apakah satu bulan boleh dihapus.
 *
 * @returns {{boleh: boolean, alasan?: string, jumlah?: number}}
 */
function bolehDihapus({ dasar, arsipDir, jenis, bulan }) {
  const jm = jalurManifes(arsipDir, jenis, bulan);
  if (!fs.existsSync(jm)) {
    return { boleh: false, alasan: 'belum diarsipkan' };
  }

  let manifes;
  try {
    manifes = JSON.parse(fs.readFileSync(jm, 'utf8'));
  } catch {
    return { boleh: false, alasan: 'manifesnya rusak dan tidak bisa dibaca' };
  }

  const asal = path.join(dasar, jenis, bulan);
  const adaSekarang = daftarBerkas(asal);
  const diManifes = new Map((manifes.berkas || []).map((b) => [b.nama, b]));

  // Berkas yang masuk SETELAH pengarsipan tidak ada salinannya. Ini
  // bukan keadaan aneh: koreksi absensi yang disetujui bisa menambah
  // foto ke bulan yang sudah lewat.
  const belumTersalin = adaSekarang.filter((n) => !diManifes.has(n));
  if (belumTersalin.length > 0) {
    return {
      boleh: false,
      alasan: `${belumTersalin.length} berkas masuk setelah pengarsipan; jalankan arsip ulang`,
    };
  }

  const tujuan = path.join(arsipDir, jenis, bulan);

  for (const nama of adaSekarang) {
    const dicatat = diManifes.get(nama).sha256;

    // Manifes yang masih ada sementara salinannya sudah tidak BUKAN
    // bukti apa pun -- ia hanya catatan bahwa dulu pernah disalin.
    // Tanpa pemeriksaan ini, memindahkan folder arsip ke penyimpanan
    // dinas (lalu menghapus yang di server, yang justru wajar
    // dilakukan) akan membuat penghapusan berikutnya berjalan tanpa
    // satu pun salinan tersisa.
    const salinan = path.join(tujuan, nama);
    if (!fs.existsSync(salinan)) {
      return { boleh: false, alasan: `salinan ${nama} tidak ada di folder arsip` };
    }

    // Keduanya diperiksa, bukan salah satu. Asal yang berubah berarti
    // salinannya bukan salinan yang benar lagi; salinan yang berubah
    // berarti yang disimpan dinas sudah rusak. Dua-duanya alasan untuk
    // berhenti. Membaca ulang seluruh berkas memang mahal, tapi ini
    // pekerjaan tahunan yang menjaga penghapusan tak terpulihkan --
    // kecepatan bukan yang ditukar di sini.
    if (sha256(path.join(asal, nama)) !== dicatat) {
      return { boleh: false, alasan: `sidik ${nama} tidak cocok dengan arsipnya` };
    }
    if (sha256(salinan) !== dicatat) {
      return { boleh: false, alasan: `salinan ${nama} sudah rusak` };
    }
  }

  return { boleh: true, jumlah: adaSekarang.length };
}

// Bulan dari URL foto: "/uploads/absensi/2026-08/xxx.jpg" -> "2026-08".
// Dipakai purge-photos.js untuk mencari manifes yang bersangkutan.
function bulanDariUrl(url) {
  const c = /\/uploads\/(absensi|dokumen)\/(\d{4}-\d{2})\//.exec(String(url || ''));
  return c ? { jenis: c[1], bulan: c[2] } : null;
}

// Apakah satu berkas sungguh-sungguh punya salinan yang masih utuh?
//
// Tiga hal diperiksa, dan ketiganya pernah menjadi lubang:
//
// 1. Namanya ada di manifes. Foto yang masuk SETELAH pengarsipan --
//    misalnya dari koreksi absensi yang disetujui belakangan -- tidak
//    punya salinan, dan itu yang paling mudah terlewat.
// 2. Berkas salinannya masih ada. Manifes tanpa salinan bukan bukti apa
//    pun, hanya catatan bahwa dulu pernah disalin. Memindahkan folder
//    arsip ke penyimpanan dinas lalu menghapus yang di server adalah
//    tindakan yang wajar sekali, dan tanpa pemeriksaan ini justru
//    tindakan itulah yang membuka jalan penghapusan tanpa salinan.
// 3. Isinya masih sama dengan yang dicatat.
//
// Pemeriksaan ini berdiri sendiri, tidak menumpang bolehDihapus(),
// karena inilah yang dipanggil tepat sebelum berkasnya benar-benar
// dihapus. Pemeriksaan yang lebih longgar di jalur yang menghapus
// membuat pemeriksaan ketat di jalur yang hanya melapor menjadi
// pajangan.
const singgahan = new Map();
function manifesMemuat(arsipDir, jenis, bulan, namaBerkas) {
  const jm = jalurManifes(arsipDir, jenis, bulan);
  if (!singgahan.has(jm)) {
    let peta = null;
    try {
      const m = JSON.parse(fs.readFileSync(jm, 'utf8'));
      peta = new Map((m.berkas || []).map((b) => [b.nama, b.sha256]));
    } catch { peta = null; }
    singgahan.set(jm, peta);
  }

  const peta = singgahan.get(jm);
  if (!peta || !peta.has(namaBerkas)) return false;

  const salinan = path.join(arsipDir, jenis, bulan, namaBerkas);
  if (!fs.existsSync(salinan)) return false;

  try {
    return sha256(salinan) === peta.get(namaBerkas);
  } catch {
    return false;
  }
}

function lupakanSinggahan() { singgahan.clear(); }

module.exports = {
  BULAN_SIMPAN, TAHUN_SIMPAN, JENIS,
  nomorBulan, uraikanNamaBulan, lewatMasaSimpan,
  daftarBulan, daftarBerkas, jalurManifes,
  arsipkanBulan, bolehDihapus, sha256,
  bulanDariUrl, manifesMemuat, lupakanSinggahan,
};
