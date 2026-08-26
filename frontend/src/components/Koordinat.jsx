// Koordinat absen sebagai keterangan tempat.
//
// PENTING: ini bukan geofencing. Tidak ada pemeriksaan jarak ke kantor di
// mana pun di aplikasi ini -- absen lapangan memang bisa dari mana saja.
// Yang ditampilkan hanya di mana absennya diambil, supaya admin punya
// gambaran tanpa harus membuka fotonya satu per satu.
//
// Formatnya sengaja sama persis dengan cap yang ditanam di foto
// (backend/src/utils/capFoto.js), jadi angka di tabel dan angka di gambar
// bisa dicocokkan sekilas.
export function formatKoordinat(latitude, longitude) {
  // null dan string kosong harus ditolak SEBELUM Number(). Number(null)
  // dan Number('') sama-sama menghasilkan 0 -- angka yang sah menurut
  // isFinite -- sehingga absen tanpa GPS akan tampil sebagai
  // "0,00000N 0,00000E", yaitu titik di Teluk Guinea, bukan tanda strip.
  if (latitude === null || latitude === undefined || latitude === ''
    || longitude === null || longitude === undefined || longitude === '') {
    return null;
  }
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const sisi = (nilai, positif, negatif) =>
    `${Math.abs(nilai).toFixed(5).replace('.', ',')}${nilai < 0 ? negatif : positif}`;

  return `${sisi(lat, 'N', 'S')} ${sisi(lon, 'E', 'W')}`;
}

export default function Koordinat({ latitude, longitude, className = '' }) {
  const teks = formatKoordinat(latitude, longitude);

  if (!teks) {
    return (
      <span className={`text-xs text-faint ${className}`} title="GPS mati atau izin lokasi ditolak saat absen">
        —
      </span>
    );
  }

  // Peta dibuka di tab baru lewat URL pencarian Google Maps. Sengaja tidak
  // menyematkan peta di halaman: itu butuh API key berbayar, sementara
  // tautan biasa sudah cukup untuk sesekali memastikan lokasi.
  const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Buka di Google Maps"
      className={`text-xs tabular-nums text-primary-600 dark:text-primary-400 hover:underline ${className}`}
    >
      {teks}
    </a>
  );
}
