import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const statusBadge = {
  pending: { text: 'Menunggu', class: 'bg-amber-50 text-amber-700' },
  approved: { text: 'Disetujui', class: 'bg-green-50 text-green-700' },
  rejected: { text: 'Ditolak', class: 'bg-red-50 text-red-700' },
};

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
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-sm text-gray-500">← Dashboard</Link>
            <p className="font-semibold text-gray-900">Pengajuan Izin</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        {/* Filter status */}
        <div className="flex gap-2 mb-4">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium ${
                filter === f.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {leaves.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.department || '-'}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${statusBadge[item.status]?.class}`}>
                  {statusBadge[item.status]?.text}
                </span>
              </div>

              <p className="text-sm text-gray-700 mb-1">
                {formatTanggal(item.start_date)}
                {item.start_date !== item.end_date && ` — ${formatTanggal(item.end_date)}`}
              </p>
              <p className="text-sm text-gray-500 mb-3">{item.reason}</p>

              {item.status === 'pending' && reviewingId !== item.id && (
                <button
                  onClick={() => { setReviewingId(item.id); setNote(''); }}
                  className="text-sm text-primary-600 font-medium"
                >
                  Review
                </button>
              )}

              {reviewingId === item.id && (
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Catatan admin (opsional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(item.id, 'approved')}
                      className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg font-medium"
                    >
                      Setujui
                    </button>
                    <button
                      onClick={() => handleReview(item.id, 'rejected')}
                      className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg font-medium"
                    >
                      Tolak
                    </button>
                    <button
                      onClick={() => setReviewingId(null)}
                      className="text-sm text-gray-500 px-2"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {item.status !== 'pending' && (
                <p className="text-xs text-gray-400 border-t border-gray-100 pt-2">
                  Direview oleh {item.reviewed_by_name || '-'}
                  {item.admin_note && ` — "${item.admin_note}"`}
                </p>
              )}
            </div>
          ))}

          {leaves.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-10">Tidak ada pengajuan.</p>
          )}
        </div>
      </div>
    </div>
  );
}
