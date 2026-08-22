const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Direktori tempat foto absensi disimpan di server (bukan cloud storage).
// Bisa diarahkan ke disk lain via UPLOAD_DIR di .env (mis. volume terpisah di VPS).
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

// URL dasar publik untuk mengakses foto (di-serve lewat express.static di app.js)
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

// Upload buffer foto (dari multer memoryStorage) ke disk lokal server.
// Mengembalikan URL yang bisa langsung disimpan di database.
async function uploadPhotoToStorage(fileBuffer, mimetype, folder = 'attendance') {
  const targetDir = path.join(uploadDir, folder);
  await fs.promises.mkdir(targetDir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomUUID()}.jpg`;
  const filePath = path.join(targetDir, filename);

  await fs.promises.writeFile(filePath, fileBuffer);

  const relativeUrl = `/uploads/${folder}/${filename}`;
  return publicBaseUrl ? `${publicBaseUrl}${relativeUrl}` : relativeUrl;
}

// Hapus berkas lama saat foto diganti, supaya disk server tidak menumpuk
// file yatim. URL yang tidak dikenali (mis. dari domain lain) diabaikan.
async function hapusFotoLama(url) {
  if (!url) return;
  const relatif = url.replace(publicBaseUrl, '');
  if (!relatif.startsWith('/uploads/')) return;

  const target = path.join(uploadDir, relatif.replace('/uploads/', ''));
  // Pastikan tetap di dalam folder uploads -- cegah path traversal
  if (!path.resolve(target).startsWith(path.resolve(uploadDir))) return;

  try {
    await fs.promises.unlink(target);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Gagal hapus foto lama:', err.message);
  }
}

module.exports = { uploadPhotoToStorage, hapusFotoLama, uploadDir };
