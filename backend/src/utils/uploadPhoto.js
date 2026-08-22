const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Direktori tempat foto disimpan di server (bukan cloud storage).
// Bisa diarahkan ke disk lain via UPLOAD_DIR di .env (mis. volume terpisah di VPS).
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

// Ubah nama orang jadi potongan nama berkas yang aman:
// "Budi Pegawai" -> "budi-pegawai"
function slug(teks) {
  return (teks || 'tanpa-nama')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // buang aksen
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'tanpa-nama';
}

// Nama berkas foto absensi, contoh:
//   2026-08-22_07-58-13_id02_budi-pegawai_masuk_a7f3.jpg
//
// - Urut alfabet = urut waktu, jadi mudah ditelusuri di file manager
// - Jam memakai tanda hubung karena Windows melarang ':' pada nama berkas
// - ID pegawai ikut ditulis: nama bisa sama antar orang dan bisa berubah,
//   ID yang menjamin keunikan sekaligus dipakai untuk memeriksa kepemilikan
// - Akhiran acak membuat URL tidak bisa ditebak walau namanya terbaca
function namaBerkasAbsensi({ userId, userName, jenis, waktu = new Date() }) {
  const y = waktu.getFullYear();
  const m = String(waktu.getMonth() + 1).padStart(2, '0');
  const d = String(waktu.getDate()).padStart(2, '0');
  const hh = String(waktu.getHours()).padStart(2, '0');
  const mm = String(waktu.getMinutes()).padStart(2, '0');
  const ss = String(waktu.getSeconds()).padStart(2, '0');
  const acak = crypto.randomBytes(2).toString('hex');

  return {
    // Folder dipisah per bulan supaya tidak menumpuk puluhan ribu berkas
    // dalam satu direktori -- lambat dibuka dan menyulitkan pencadangan.
    folder: `absensi/${y}-${m}`,
    nama: `${y}-${m}-${d}_${hh}-${mm}-${ss}_id${String(userId).padStart(2, '0')}_${slug(userName)}_${jenis}_${acak}.jpg`,
  };
}

function namaBerkasAvatar({ userId, userName, waktu = new Date() }) {
  const y = waktu.getFullYear();
  const m = String(waktu.getMonth() + 1).padStart(2, '0');
  const d = String(waktu.getDate()).padStart(2, '0');
  const acak = crypto.randomBytes(2).toString('hex');

  return {
    folder: 'avatar',
    nama: `${y}-${m}-${d}_id${String(userId).padStart(2, '0')}_${slug(userName)}_${acak}.jpg`,
  };
}

// Simpan buffer foto ke disk, kembalikan path relatif untuk disimpan di database.
// Path sengaja relatif supaya data tidak terikat satu domain -- pindah server
// tidak membuat seluruh URL lama rusak.
async function simpanFoto(fileBuffer, { folder, nama }) {
  const targetDir = path.join(uploadDir, folder);
  await fs.promises.mkdir(targetDir, { recursive: true });
  await fs.promises.writeFile(path.join(targetDir, nama), fileBuffer);
  return `/uploads/${folder}/${nama}`;
}

// Foto absensi. `waktu` hanya diisi oleh seed demo yang menulis foto
// bertanggal mundur; absen sungguhan selalu memakai waktu sekarang.
async function uploadFotoAbsensi(fileBuffer, { userId, userName, jenis, waktu }) {
  return simpanFoto(fileBuffer, namaBerkasAbsensi({ userId, userName, jenis, waktu }));
}

// Foto profil
async function uploadFotoProfil(fileBuffer, { userId, userName }) {
  return simpanFoto(fileBuffer, namaBerkasAvatar({ userId, userName }));
}

// Ubah path relatif dari database jadi lokasi berkas di disk.
// Mengembalikan null kalau path mencurigakan (mis. mencoba keluar folder uploads).
function lokasiBerkas(relatif) {
  if (!relatif) return null;
  const bersih = relatif.replace(/^\/uploads\//, '').replace(/^\/+/, '');
  const target = path.resolve(uploadDir, bersih);
  if (!target.startsWith(path.resolve(uploadDir))) return null; // cegah path traversal
  return target;
}

// Hapus berkas lama saat foto diganti, supaya disk tidak menumpuk berkas yatim
async function hapusFotoLama(url) {
  const target = lokasiBerkas(url);
  if (!target) return;
  try {
    await fs.promises.unlink(target);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Gagal hapus foto lama:', err.message);
  }
}

module.exports = {
  uploadFotoAbsensi,
  uploadFotoProfil,
  hapusFotoLama,
  lokasiBerkas,
  uploadDir,
};
