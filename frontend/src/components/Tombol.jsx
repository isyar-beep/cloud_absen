import { Link } from 'react-router-dom';

// ============================================================
// Tombol.
//
// Sebelumnya ada 23 tombol yang menuliskan gayanya sendiri-sendiri, dan
// tidak ada dua yang benar-benar sama: ada py-2, py-2.5, py-3; ada
// rounded-xl dan rounded-2xl; sebagian menekan saat diklik, sebagian
// diam. Selisih sekecil itu tidak kelihatan satu per satu, tapi begitu
// dua tombol berdampingan, matanya langsung menangkap bahwa keduanya
// tidak sejajar -- dan itulah yang membuat sebuah antarmuka terasa
// dirakit, bukan dirancang.
//
// Empat rupa, dan pembedaannya menurut BOBOT TINDAKAN, bukan warna:
//   utama  -- tindakan utama pada satu layar. Hanya boleh satu.
//   ink    -- tindakan setara yang mendampingi utama (mis. PDF di
//             sebelah Excel).
//   halus  -- tindakan sekunder; tidak menuntut perhatian.
//   bahaya -- tindakan yang menghapus atau tidak bisa ditarik kembali.
// ============================================================

const RUPA = {
  utama:
    'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-glow '
    + 'hover:from-primary-500 hover:to-primary-600 disabled:shadow-none',
  ink:
    'bg-ink text-on-ink hover:bg-ink/90',
  halus:
    'bg-surface/75 backdrop-blur-xl border border-line text-body shadow-soft '
    + 'hover:border-line-strong hover:text-strong',
  bahaya:
    'bg-red-600 text-white shadow-soft hover:bg-red-500',
};

const UKURAN = {
  sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-1.5',
  lg: 'text-sm px-5 py-3.5 rounded-2xl gap-2',
};

export default function Tombol({
  rupa = 'utama',
  ukuran = 'md',
  penuh = false,
  to,
  ikon: Ikon,
  children,
  className = '',
  ...sisa
}) {
  const kelas = [
    'inline-flex items-center justify-center font-semibold transition',
    // Menekan sedikit saat diklik. Balasan sekejap inilah yang membuat
    // ketukan terasa diterima, terutama di layar sentuh yang tidak punya
    // keadaan hover sama sekali.
    'active:scale-[0.98] motion-reduce:active:scale-100',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
    RUPA[rupa] || RUPA.utama,
    UKURAN[ukuran] || UKURAN.md,
    penuh ? 'w-full' : '',
    className,
  ].join(' ');

  const isi = (
    <>
      {Ikon && <Ikon className={ukuran === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
      {children}
    </>
  );

  if (to) return <Link to={to} className={kelas} {...sisa}>{isi}</Link>;
  return <button type="button" className={kelas} {...sisa}>{isi}</button>;
}
