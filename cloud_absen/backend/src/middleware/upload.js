const multer = require('multer');

// Simpan file sementara di memory sebelum diunggah ke Firebase Storage
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format file tidak didukung. Gunakan JPEG, PNG, atau WEBP.'));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // maksimal 5MB per foto
});

module.exports = upload;
