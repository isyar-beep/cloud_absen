const multer = require('multer');

// Unggahan lampiran pengajuan izin/sakit/cuti: surat dokter, surat tugas,
// surat cuti. Dipisah dari middleware foto absensi karena format yang
// diterima berbeda -- di sini PDF ikut boleh, di foto absensi tidak.
const storage = multer.memoryStorage();

const FORMAT_DIIZINKAN = ['application/pdf', 'image/jpeg', 'image/png'];

function fileFilter(req, file, cb) {
  if (FORMAT_DIIZINKAN.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error('Format lampiran tidak didukung. Gunakan PDF, JPG, atau PNG.');
    err.statusCode = 400;
    cb(err);
  }
}

const uploadDocument = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // maksimal 5MB per lampiran
});

module.exports = uploadDocument;
