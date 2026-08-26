// Badge status absensi dengan titik indikator -- dipakai konsisten di semua halaman
const styles = {
  hadir: { text: 'Hadir', chip: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-600/20', dot: 'bg-emerald-500' },
  // Terlambat tetap dihitung hadir -- teksnya menyebut keduanya supaya
  // pegawai tidak salah paham dikira tidak masuk.
  terlambat: { text: 'Hadir (Terlambat)', chip: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-600/20', dot: 'bg-amber-500' },
  izin: { text: 'Izin', chip: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-600/20', dot: 'bg-blue-500' },
  alpha: { text: 'Alpha', chip: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 ring-red-600/20', dot: 'bg-red-500' },
  pending: { text: 'Menunggu', chip: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-600/20', dot: 'bg-amber-500' },
  approved: { text: 'Disetujui', chip: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-600/20', dot: 'bg-emerald-500' },
  rejected: { text: 'Ditolak', chip: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 ring-red-600/20', dot: 'bg-red-500' },
};

export default function StatusBadge({ status }) {
  const s = styles[status] || { text: status, chip: 'bg-surface-3 text-body ring-line-strong/40', dot: 'bg-faint' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ring-inset ${s.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.text}
    </span>
  );
}
