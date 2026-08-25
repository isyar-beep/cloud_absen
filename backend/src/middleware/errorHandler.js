// Menangkap semua error yang tidak tertangani di controller
// supaya response ke client selalu konsisten dan server tidak crash
function errorHandler(err, req, res, next) {
  console.error(err.stack);

  let status = err.statusCode || 500;
  let message = err.message || 'Terjadi kesalahan pada server.';

  // Pelanggaran unique constraint PostgreSQL (mis. email sudah terdaftar)
  if (err.code === '23505') {
    status = 409;
    message = 'Data sudah terdaftar (duplikat).';
  }

  // Error dari multer saat upload file
  if (err.name === 'MulterError') {
    status = 400;
    // Pesannya netral: jalur unggah bukan cuma foto absensi, ada juga
    // lampiran pengajuan izin/sakit/cuti dengan batas yang sama.
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran berkas maksimal 5MB.' : 'Unggah berkas gagal.';
  }

  // Di production, jangan bocorkan detail error internal (query, stack, path)
  if (status === 500 && process.env.NODE_ENV === 'production') {
    message = 'Terjadi kesalahan pada server.';
  }

  res.status(status).json({ message });
}

module.exports = errorHandler;
