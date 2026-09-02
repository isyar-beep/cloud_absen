import { Link } from 'react-router-dom';

// ============================================================
// Keadaan kosong.
//
// Sebelumnya tiap halaman menuliskan sebaris teks kelabu sendiri --
// "Belum ada data." -- dan hasilnya layar yang tampak setengah jadi.
// Padahal pada sistem yang datanya masih tipis, INILAH layar yang
// paling sering benar-benar dilihat orang.
//
// Dibedakan dua sebab, karena keduanya menuntut kalimat dan tindakan
// yang berbeda:
//
//   jenis="kosong"  -- datanya memang belum ada. Yang dibutuhkan
//                      pemakai adalah jalan untuk MEMBUAT-nya.
//   jenis="saringan"-- datanya ada, tapi saringan sedang menyembunyikan
//                      semuanya. Yang dibutuhkan adalah jalan untuk
//                      MELONGGARKAN saringannya.
//
// Tanpa pembedaan itu, orang yang salah menyetel saringan akan mengira
// datanya hilang.
// ============================================================

export default function KeadaanKosong({
  ikon: Ikon,
  judul,
  pesan,
  jenis = 'kosong',
  aksi,          // { label, to } atau { label, onClick }
  className = '',
}) {
  const saringan = jenis === 'saringan';

  return (
    <div className={`flex flex-col items-center text-center px-6 py-14 ${className}`}>
      {Ikon && (
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
            saringan
              ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
              : 'bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400'
          }`}
          aria-hidden="true"
        >
          <Ikon className="w-7 h-7" />
        </div>
      )}

      <p className="text-[15px] font-bold text-strong tracking-[-0.01em]">{judul}</p>

      {pesan && (
        // max-w: kalimat yang melebar sampai 1600px tidak terbaca sebagai
        // kalimat lagi. Keadaan kosong selalu di tengah dan sempit.
        <p className="text-sm text-muted mt-1.5 max-w-sm leading-relaxed">{pesan}</p>
      )}

      {aksi && (
        aksi.to ? (
          <Link
            to={aksi.to}
            className="mt-5 text-sm bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600"
          >
            {aksi.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={aksi.onClick}
            className="mt-5 text-sm bg-surface/75 backdrop-blur-xl border border-line text-body px-4 py-2.5 rounded-xl font-semibold shadow-soft transition hover:border-line-strong hover:text-strong"
          >
            {aksi.label}
          </button>
        )
      )}
    </div>
  );
}
