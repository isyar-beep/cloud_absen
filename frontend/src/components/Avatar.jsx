import { urlFoto, useTokenFoto } from '../api/fileUrl';

// Avatar tunggal untuk seluruh aplikasi: tampilkan foto profil bila ada,
// jatuh ke inisial nama bila belum. Sebelumnya kode ini terduplikasi di
// beberapa halaman dan tidak pernah memakai foto sama sekali.

const WARNA = [
  'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300', 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300',
  'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300', 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
  'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300', 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300',
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
  // Token diambil sekali lalu dipakai bersama seluruh avatar di halaman
  const tokenFoto = useTokenFoto();
  const gaya = { width: size, height: size };

  if (src && tokenFoto) {
    return (
      <img
        src={urlFoto(src, tokenFoto)}
        alt={name || 'Foto profil'}
        style={gaya}
        className={`rounded-full object-cover bg-surface-3 shrink-0 ${className}`}
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
