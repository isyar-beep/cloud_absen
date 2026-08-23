// Penanda kecil "WFA" pada satu catatan absensi.
//
// Sengaja tidak digabung ke StatusBadge: hadir/terlambat/izin/alpha
// menjawab "apakah masuk kerja", sedangkan WFA menjawab "dari mana
// bekerjanya". Dua pertanyaan berbeda, jadi dua penanda terpisah --
// pegawai WFA yang terlambat tetap perlu terlihat terlambat.
export default function WfaBadge({ mode, className = '' }) {
  if (mode !== 'wfa') return null;
  return (
    <span
      title="Work From Anywhere — ditetapkan admin"
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide bg-violet-50 text-violet-700 border border-violet-100 ${className}`}
    >
      WFA
    </span>
  );
}
