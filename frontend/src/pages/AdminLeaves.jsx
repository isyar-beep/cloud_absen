import { useEffect, useState } from 'react';
import api from '../api/axios';
import AdminHeader from '../components/AdminHeader';
import StatusBadge from '../components/StatusBadge';

export default function AdminLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [reviewingId, setReviewingId] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLeaves();
  }, [filter]);

  async function fetchLeaves() {
    try {
      const res = await api.get('/leaves', { params: filter === 'all' ? {} : { status: filter } });
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

  function formatTanggal(d) {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const filters = [
    { key: 'pending', label: 'Menunggu' },
    { key: 'approved', label: 'Disetujui' },
    { key: 'rejected', label: 'Ditolak' },
    { key: 'all', label: 'Semua' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-4xl mx-auto px-4 py-7">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Pengajuan Izin</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review pengajuan izin dari pegawai</p>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
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
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {leaves.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.department || '—'}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>

              <div className="bg-gray-50 rounded-xl px-4 py-3 mb-3">
                <p className="text-sm font-medium text-gray-800">
                  {formatTanggal(item.start_date)}
                  {item.start_date !== item.end_date && ` — ${formatTanggal(item.end_date)}`}
                </p>
                <p className="text-sm text-gray-500 mt-1">{item.reason}</p>
              </div>

              {item.status === 'pending' && reviewingId !== item.id && (
                <button
                  onClick={() => { setReviewingId(item.id); setNote(''); }}
                  className="text-sm text-primary-600 font-semibold hover:text-primary-700 transition"
                >
                  Review Pengajuan →
                </button>
              )}

              {reviewingId === item.id && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Catatan admin (opsional)"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/40"
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
                      className="text-sm text-gray-500 px-3 hover:text-gray-700 transition"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {item.status !== 'pending' && (
                <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">
                  Direview oleh <span className="font-medium text-gray-500">{item.reviewed_by_name || '—'}</span>
                  {item.admin_note && <span className="italic"> — "{item.admin_note}"</span>}
                </p>
              )}
            </div>
          ))}

          {leaves.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft py-14 text-center">
              <p className="text-sm text-gray-400">Tidak ada pengajuan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
