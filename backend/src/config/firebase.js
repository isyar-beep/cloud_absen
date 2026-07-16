const admin = require('firebase-admin');
require('dotenv').config();

// Firebase Admin SDK digunakan backend untuk upload foto ke Firebase Storage
// dan (opsional) verifikasi token jika nanti login dipindah ke Firebase Auth
//
// Inisialisasi hanya dijalankan jika kredensial lengkap tersedia di .env.
// Ini supaya server tetap bisa start (mis. untuk testing lokal / health check)
// walau kredensial Firebase belum diisi -- endpoint yang butuh upload foto
// akan melempar error yang jelas saat dipakai, bukan meng-crash seluruh server.
const hasFirebaseCredentials =
  process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY;

if (hasFirebaseCredentials && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const bucket = hasFirebaseCredentials ? admin.storage().bucket() : null;

module.exports = { admin, bucket };
