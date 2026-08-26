// Penanda jenis pengajuan: izin, sakit, atau cuti.
//
// Ketiganya berujung pada status absensi 'izin' yang sama -- yang dibedakan
// hanya keterangannya untuk HRD. Warnanya sengaja berbeda dari StatusBadge
// supaya tidak tertukar: badge ini menjawab "pengajuan apa", StatusBadge
// menjawab "sudah diputuskan atau belum".
const GAYA = {
  izin: { label: 'Izin', kelas: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-500/30' },
  sakit: { label: 'Sakit', kelas: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-500/30' },
  cuti: { label: 'Cuti', kelas: 'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-100 dark:border-teal-500/30' },
};

export default function JenisBadge({ jenis, className = '' }) {
  const gaya = GAYA[jenis] || GAYA.izin;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${gaya.kelas} ${className}`}
    >
      {gaya.label}
    </span>
  );
}
