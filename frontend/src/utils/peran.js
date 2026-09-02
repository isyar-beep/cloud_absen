// ============================================================
// Nama dan warna peran, ditulis sekali.
//
// Sebelumnya daftar ini hidup di dua tempat dengan isi berbeda: sidebar
// menyebut "Dinas" sementara halaman Pengguna menyebut "Admin (Dinas)".
// Satu orang bisa melihat dirinya disebut dua nama di layar yang sama,
// dan yang lebih panjang terpotong jadi dua baris di dalam lencana.
// ============================================================

export const LABEL_PERAN = {
  admin: 'Dinas',
  konsultan: 'Konsultan',
  staff: 'Pegawai',
};

// Warna membedakan kewenangan sekilas: ungu memutuskan, kuning menyelia,
// netral dipantau.
export const WARNA_PERAN = {
  admin: 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-600/20',
  konsultan: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-600/20',
  staff: 'bg-surface-2 text-body ring-line-strong/40',
};

export function namaPeran(peran) {
  return LABEL_PERAN[peran] || peran;
}
