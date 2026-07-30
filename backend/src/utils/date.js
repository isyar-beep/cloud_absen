// Utilitas tanggal berbasis zona waktu lokal server (env TZ, mis. Asia/Jakarta).
// PENTING: jangan pakai new Date().toISOString() untuk tanggal absensi --
// toISOString() selalu UTC, sehingga absensi dini hari WIB (sebelum 07:00)
// akan tercatat di tanggal yang salah.
function todayLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = { todayLocal };
