import { useEffect, useState } from 'react';
import api from '../api/axios';
import AdminSidebar from '../components/AdminSidebar';
import StatusBadge from '../components/StatusBadge';
import JenisBadge from '../components/JenisBadge';
import Avatar from '../components/Avatar';
import { urlFoto, useTokenFoto } from '../api/fileUrl';
import AdminCorrections from './AdminCorrections';
import { formatTanggal } from '../utils/tanggal';

export default function AdminLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [filter, setFilter] = useState('pending');
  // Saringan jenis pengajuan (izin/sakit/cuti). Harus dideklarasikan di sini,
  // bukan di bawah: dependency array useEffect membacanya saat render.
  const [jenis, setJenis] = useState('');
  // Izin dan koreksi sama-sama "pengajuan pegawai yang menunggu keputusan
  // admin", jadi digabung di satu halaman sebagai tab -- lebih baik daripada
  // menambah satu lagi menu di bilah navigasi yang sudah panjang.
  const [tab, setTab] = useState('izin');
  const tokenFoto = useTokenFoto();
  const [reviewingId, setReviewingId] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLeaves();
  }, [filter, jenis]);

  async function fetchLeaves() {
    try {
      const params = {};
      if (filter !== 'all') params.status = filter;
      if (jenis) params.type = jenis;
      const res = await api.get('/leaves', { params });
      setLeaves(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleReview(id, status) {
    setError('');
    try {
      await api.put(`/leaves/${id}/review`, { status, admin_note: note.trim() || null });
      setReviewingId(null);
      setNote('');
      fetchLeaves();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memproses review.');
    }
  }


  const filters = [
    { key: 'pending', label: 'Menunggu' },
    { key: 'approved', label: 'Disetujui' },
    { key: 'rejected', label: 'Ditolak' },
    { key: 'all', label: 'Semua' },
  ];

  return (
    <div className="min-h-screen transition-[padding] duration-200 lg:pl-[var(--lebar-sidebar)]">
      <AdminSidebar />

      <div className="wadah-petak px-5 lg:px-8 py-7">
        <div className="mb-5">
          <h1 className="text-[1.75rem] leading-tight font-extrabold text-strong tracking-[-0.02em]">Pengajuan Pegawai</h1>
          <p className="text-sm text-body mt-0.5">
            {tab === 'izin'
              ? 'Review pengajuan izin, sakit, dan cuti dari pegawai'
              : 'Review usulan koreksi jam absen dari pegawai'}
          </p>
        </div>

        <div className="flex gap-2 mb-5 border-b border-line">
          {[
            { key: 'izin', label: 'Izin, Sakit & Cuti' },
            { key: 'koreksi', label: 'Koreksi Absensi' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
                tab === t.key
                  ? 'border-primary-600 text-primary-700 dark:text-primary-300'
                  : 'border-transparent text-muted hover:text-strong'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'koreksi' && <AdminCorrections />}

        {tab === 'izin' && (
        <>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Filter status */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-sm px-4 py-2 rounded-full font-medium transition ${
                filter === f.key
                  ? 'bg-primary-600 text-white shadow-glow'
                  : 'bg-surface/75 backdrop-blur-xl border border-line text-body hover:border-line-strong hover:text-strong'
              }`}
            >
              {f.label}
            </button>
          ))}

          <span className="w-px bg-surface-3 mx-1 self-stretch" />

          {[
            { key: '', label: 'Semua jenis' },
            { key: 'izin', label: 'Izin' },
            { key: 'sakit', label: 'Sakit' },
            { key: 'cuti', label: 'Cuti' },
          ].map((j) => (
            <button
              key={j.key || 'semua'}
              onClick={() => setJenis(j.key)}
              className={`text-sm px-4 py-2 rounded-full font-medium transition ${
                jenis === j.key
                  ? 'bg-ink text-on-ink'
                  : 'bg-surface/75 backdrop-blur-xl border border-line text-body hover:border-line-strong hover:text-strong'
              }`}
            >
              {j.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {leaves.map((item) => (
            <div key={item.id} className="kartu-kaca p-5">
              <div className="flex justify-between items-start gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={item.name} src={item.avatar_url} size={34} />
                  <div className="min-w-0">
                    <p className="text-[17px] font-bold text-strong tracking-[-0.01em] truncate">{item.name}</p>
                    <p className="text-xs text-faint">{item.project_name || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <JenisBadge jenis={item.type} />
                  <StatusBadge status={item.status} />
                </div>
              </div>

              <div className="bg-surface-2 rounded-xl px-4 py-3 mb-3">
                <p className="text-sm font-medium text-strong">
                  {formatTanggal(item.start_date)}
                  {item.start_date !== item.end_date && ` — ${formatTanggal(item.end_date)}`}
                </p>
                <p className="text-sm text-muted mt-1">{item.reason}</p>
                {item.document_url && (
                  <a
                    href={urlFoto(item.document_url, tokenFoto)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline mt-2"
                  >
                    Buka lampiran{item.document_name ? ` — ${item.document_name}` : ''}
                  </a>
                )}
              </div>

              {item.status === 'pending' && reviewingId !== item.id && (
                <button
                  onClick={() => { setReviewingId(item.id); setNote(''); }}
                  className="text-sm text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-700 dark:hover:text-primary-300 dark:text-primary-300 transition"
                >
                  Review Pengajuan →
                </button>
              )}

              {reviewingId === item.id && (
                <div className="border-t border-line pt-4 space-y-3">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Catatan admin (opsional)"
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-sm transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(item.id, 'approved')}
                      className="text-sm bg-emerald-600 text-white px-5 py-2 rounded-xl font-semibold transition hover:bg-emerald-500"
                    >
                      Setujui
                    </button>
                    <button
                      onClick={() => handleReview(item.id, 'rejected')}
                      className="text-sm bg-red-600 text-white px-5 py-2 rounded-xl font-semibold transition hover:bg-red-500"
                    >
                      Tolak
                    </button>
                    <button
                      onClick={() => setReviewingId(null)}
                      className="text-sm text-muted px-3 hover:text-body transition"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {item.status !== 'pending' && (
                <p className="text-xs text-faint border-t border-line pt-3">
                  Direview oleh <span className="font-medium text-muted">{item.reviewed_by_name || '—'}</span>
                  {item.admin_note && <span className="italic"> — "{item.admin_note}"</span>}
                </p>
              )}
            </div>
          ))}

          {leaves.length === 0 && (
            <div className="kartu-kaca py-14 text-center">
              <p className="text-sm text-faint">Tidak ada pengajuan.</p>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
