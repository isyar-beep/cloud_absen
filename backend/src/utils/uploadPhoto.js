const { bucket } = require('../config/firebase');
const crypto = require('crypto');

// Upload buffer foto (dari multer memoryStorage) ke Firebase Storage
// Mengembalikan public URL yang bisa langsung disimpan di database
async function uploadPhotoToStorage(fileBuffer, mimetype, folder = 'attendance') {
  if (!bucket) {
    const err = new Error('Firebase Storage belum dikonfigurasi. Isi kredensial Firebase di .env.');
    err.statusCode = 500;
    throw err;
  }

  const filename = `${folder}/${Date.now()}-${crypto.randomUUID()}.jpg`;
  const file = bucket.file(filename);

  await file.save(fileBuffer, {
    metadata: { contentType: mimetype },
    public: true,
  });

  return `https://storage.googleapis.com/${bucket.name}/${filename}`;
}

module.exports = { uploadPhotoToStorage };
