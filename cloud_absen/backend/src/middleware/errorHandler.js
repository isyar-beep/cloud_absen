// Menangkap semua error yang tidak tertangani di controller
// supaya response ke client selalu konsisten dan server tidak crash
function errorHandler(err, req, res, next) {
  console.error(err.stack);

  const status = err.statusCode || 500;
  const message = err.message || 'Terjadi kesalahan pada server.';

  res.status(status).json({ message });
}

module.exports = errorHandler;
