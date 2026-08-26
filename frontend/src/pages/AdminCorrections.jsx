import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import Avatar from '../components/Avatar';
import StatusBadge from '../components/StatusBadge';
import { formatTanggalHari, formatJam } from '../utils/tanggal';

const SARINGAN = [
  { key: 'pending', label: 'Menunggu' },
  { key: 'approved', label: 'Disetujui' },
  { key: 'rejected', label: 'Ditolak' },
  { key: 'all', label: 'Semua' },
];

// "17:30:00" -> "17.30"
function jamUsulan(t) {
  if (!t) return null;
  const [h, m] = String(t).split(':');
  return `${h}.${m}`;
}

// Daftar pengajuan koreksi absensi dari pegawai.
//
// Yang penting di layar ini adalah PERBANDINGAN: apa yang sekarang tercatat
// di sistem versus apa yang diusulkan pegawai. Tanpa itu admin harus
// membuka halaman riwayat di tab lain untuk bisa memutuskan.
export default function AdminCorrections() {
  const [items, setItems] = useState([]);
  const [saringan, setSaringan] = useState('pending');
  const [meninjauId, setMeninjauId] = useState(null);
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState('');
  const [pesan, setPesan] = useState('');
  const [loading, setLoading] = useState(false);

  const ambil = useCallback(async () => {
    setError('');
    try {
      const params = saringan === 'all' ? {} : { status: saringan };
      const res = await api.get('/corrections', { params });
      setItems(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat pengajuan koreksi.');
    }
  }, [saringan]);

  useEffect(() => { ambil(); }, [ambil]);

  async function putuskan(id, status) {
    setLoading(true);
    setError('');
    try {
      const res = await api.put(`/corrections/${id}/review`, { status, admin_note: catatan || null });
      setPesan(res.data.message);
      setMeninjauId(null);
      setCatatan('');
      ambil();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan keputusan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {pesan && (
        <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/30 rounded-xl px-4 py-3 mb-4 font-medium">
          ✓ {pesan}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Fungsi tab ini tidak terbaca dari namanya saja, jadi diterangkan
          langsung di layar daripada mengandalkan orang bertanya. */}
      <div className="bg-blue-50/60 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/30 rounded-xl px-4 py-3 mb-5">
        <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
          <span className="font-semibold">Apa ini?</span> Usulan perbaikan jam
          absen dari pegawai &mdash; misalnya lupa absen pulang, atau jam masuk
          tercatat keliru. Pegawai mengajukan dari menu Riwayat di aplikasinya,
          lalu Anda memutuskan di sini. Yang disetujui langsung memperbaiki
          catatan absensinya dan tercatat di jejak audit. Untuk memperbaiki
          sendiri tanpa menunggu pengajuan, buka menu{' '}
          <span className="font-semibold">Riwayat</span> lalu klik{' '}
          <span className="font-semibold">Koreksi</span> pada barisnya.
        </p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {SARINGAN.map((f) => (
          <button
            key={f.key}
            onClick={() => setSaringan(f.key)}
            className={`text-sm px-4 py-2 rounded-full font-medium transition ${
              saringan === f.key
                ? 'bg-primary-600 text-white shadow-glow'
                : 'bg-surface/75 backdrop-blur-xl border border-line text-body hover:border-line-strong hover:text-strong'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft p-5">
            <div className="flex justify-between items-start gap-3 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={item.name} src={item.avatar_url} size={34} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-strong truncate">{item.name}</p>
                  <p className="text-xs text-faint">{item.department || '—'}</p>
                </div>
              </div>
              <StatusBadge status={item.status} />
            </div>

            <p className="text-sm font-medium text-strong mb-2">
              Koreksi untuk {formatTanggalHari(item.date)}
            </p>

            {/* Tercatat sekarang vs diusulkan */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-surface-2 rounded-xl px-3.5 py-2.5">
                <p className="text-[11px] text-faint mb-1">Tercatat sekarang</p>
                <p className="text-sm text-body tabular-nums">
                  Masuk {formatJam(item.check_in_time)} · Pulang {formatJam(item.check_out_time)}
                </p>
                {item.status_absensi
                  ? <p className="text-[11px] text-faint mt-1">Status: {item.status_absensi}</p>
                  : <p className="text-[11px] text-faint mt-1">Belum ada catatan absensi</p>}
              </div>
              <div className="bg-primary-50/70 dark:bg-primary-500/15 border border-primary-100 dark:border-primary-500/30 rounded-xl px-3.5 py-2.5">
                <p className="text-[11px] text-primary-700/70 mb-1">Diusulkan pegawai</p>
                <p className="text-sm text-primary-900 dark:text-primary-200 font-medium tabular-nums">
                  {jamUsulan(item.requested_check_in) && `Masuk ${jamUsulan(item.requested_check_in)}`}
                  {item.requested_check_in && item.requested_check_out && ' · '}
                  {jamUsulan(item.requested_check_out) && `Pulang ${jamUsulan(item.requested_check_out)}`}
                </p>
                <p className="text-[11px] text-primary-700/70 mt-1">
                  Jam yang tidak diusulkan tetap seperti sekarang
                </p>
              </div>
            </div>

            <div className="bg-surface-2 rounded-xl px-4 py-3 mb-3">
              <p className="text-[11px] text-faint mb-0.5">Alasan pegawai</p>
              <p className="text-sm text-body">{item.reason}</p>
            </div>

            {item.status === 'pending' && meninjauId !== item.id && (
              <button
                onClick={() => { setMeninjauId(item.id); setCatatan(''); }}
                className="text-sm bg-ink text-on-ink px-4 py-2 rounded-xl font-semibold transition hover:bg-ink/90"
              >
                Tinjau
              </button>
            )}

            {meninjauId === item.id && (
              <div className="space-y-2.5">
                <textarea
                  rows={2}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Catatan untuk pegawai (opsional)"
                  className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-sm resize-none transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40"
                />
                <div className="flex gap-2">
                  <button
                    disabled={loading}
                    onClick={() => putuskan(item.id, 'approved')}
                    className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Setujui &amp; perbarui absensi
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => putuskan(item.id, 'rejected')}
                    className="text-sm bg-surface/75 backdrop-blur-xl border border-line text-red-600 dark:text-red-400 px-4 py-2 rounded-xl font-semibold transition hover:border-red-200 dark:hover:border-red-500/40 dark:border-red-500/35 disabled:opacity-50"
                  >
                    Tolak
                  </button>
                  <button
                    onClick={() => setMeninjauId(null)}
                    className="text-sm text-muted px-2 hover:text-body transition"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {item.status !== 'pending' && item.admin_note && (
              <p className="text-xs text-muted italic">Catatan admin: {item.admin_note}</p>
            )}
          </div>
        ))}

        {items.length === 0 && (
          <div className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft px-5 py-12 text-center">
            <p className="text-sm text-faint">
              {saringan === 'pending'
                ? 'Tidak ada pengajuan koreksi yang menunggu keputusan Anda.'
                : 'Tidak ada pengajuan koreksi pada saringan ini.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
