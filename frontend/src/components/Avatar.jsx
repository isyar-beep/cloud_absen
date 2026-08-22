import { urlFoto } from '../api/fileUrl';

// Avatar tunggal untuk seluruh aplikasi: tampilkan foto profil bila ada,
// jatuh ke inisial nama bila belum. Sebelumnya kode ini terduplikasi di
// beberapa halaman dan tidak pernah memakai foto sama sekali.

const WARNA = [
  'bg-primary-100 text-primary-700', 'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700',
];

function inisial(nama) {
  return (nama || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Warna dipilih dari nama, jadi orang yang sama selalu dapat warna sama
function warnaDari(nama) {
  const n = (nama || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return WARNA[n % WARNA.length];
}

export default function Avatar({ name, src, size = 36, className = '' }) {
  const gaya = { width: size, height: size };

  if (src) {
    return (
      <img
        src={urlFoto(src)}
        alt={name || 'Foto profil'}
        style={gaya}
        className={`rounded-full object-cover bg-gray-100 shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      style={{ ...gaya, fontSize: Math.max(10, size * 0.34) }}
      className={`rounded-full flex items-center justify-center font-bold shrink-0 ${warnaDari(name)} ${className}`}
    >
      {inisial(name)}
    </div>
  );
}
