// Penanda jenis pengajuan: izin, sakit, atau cuti.
//
// Ketiganya berujung pada status absensi 'izin' yang sama -- yang dibedakan
// hanya keterangannya untuk HRD. Warnanya sengaja berbeda dari StatusBadge
// supaya tidak tertukar: badge ini menjawab "pengajuan apa", StatusBadge
// menjawab "sudah diputuskan atau belum".
const GAYA = {
  izin: { label: 'Izin', kelas: 'bg-blue-50 text-blue-700 border-blue-100' },
  sakit: { label: 'Sakit', kelas: 'bg-rose-50 text-rose-700 border-rose-100' },
  cuti: { label: 'Cuti', kelas: 'bg-teal-50 text-teal-700 border-teal-100' },
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
