// Badge status absensi dengan titik indikator -- dipakai konsisten di semua halaman
const styles = {
  hadir: { text: 'Hadir', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  terlambat: { text: 'Terlambat', chip: 'bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-500' },
  izin: { text: 'Izin', chip: 'bg-blue-50 text-blue-700 ring-blue-600/20', dot: 'bg-blue-500' },
  alpha: { text: 'Alpha', chip: 'bg-red-50 text-red-700 ring-red-600/20', dot: 'bg-red-500' },
  pending: { text: 'Menunggu', chip: 'bg-amber-50 text-amber-700 ring-amber-600/20', dot: 'bg-amber-500' },
  approved: { text: 'Disetujui', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500' },
  rejected: { text: 'Ditolak', chip: 'bg-red-50 text-red-700 ring-red-600/20', dot: 'bg-red-500' },
};

export default function StatusBadge({ status }) {
  const s = styles[status] || { text: status, chip: 'bg-gray-100 text-gray-600 ring-gray-500/20', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ring-inset ${s.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.text}
    </span>
  );
}
