import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const LIMIT = 30;

const statusBadge = {
  hadir: 'bg-green-50 text-green-700',
  terlambat: 'bg-amber-50 text-amber-700',
  izin: 'bg-blue-50 text-blue-700',
  alpha: 'bg-red-50 text-red-700',
};

export default function History() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState({ start_date: '', end_date: '', status: '' });
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset };
      if (filter.start_date) params.start_date = filter.start_date;
      if (filter.end_date) params.end_date = filter.end_date;
      if (filter.status) params.status = filter.status;

      const res = await api.get('/attendance/history', { params });
      setItems((prev) => (append ? [...prev, ...res.data] : res.data));
      setHasMore(res.data.length === LIMIT);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function formatTanggal(d) {
    return new Date(d).toLocaleDateString('id-ID', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  function formatJam(t) {
    return t ? new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-sm text-gray-500 mb-4">
          ← Kembali
        </button>

        <h1 className="text-xl font-semibold text-gray-900 mb-4">Riwayat Absensi</h1>

        {/* Filter */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dari</label>
            <input
              type="date"
              value={filter.start_date}
              onChange={(e) => setFilter({ ...filter, start_date: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sampai</label>
            <input
              type="date"
              value={filter.end_date}
              onChange={(e) => setFilter({ ...filter, end_date: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Semua</option>
              <option value="hadir">Hadir</option>
              <option value="terlambat">Terlambat</option>
              <option value="izin">Izin</option>
              <option value="alpha">Alpha</option>
            </select>
          </div>
        </div>

        {/* Daftar riwayat */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {items.map((item) => (
            <div key={item.id} className="px-4 py-3 border-b border-gray-100 last:border-b-0">
              <div className="flex justify-between items-center mb-1">
                <p className="text-sm font-medium text-gray-900">{formatTanggal(item.date)}</p>
                <span className={`text-xs px-2 py-1 rounded-full ${statusBadge[item.status]}`}>
                  {item.status}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-gray-500">
                <span>Masuk: {formatJam(item.check_in_time)}</span>
                <span>Pulang: {formatJam(item.check_out_time)}</span>
                {item.photo_in_url && (
                  <a href={item.photo_in_url} target="_blank" rel="noreferrer" className="text-primary-600">
                    Foto masuk
                  </a>
                )}
                {item.photo_out_url && (
                  <a href={item.photo_out_url} target="_blank" rel="noreferrer" className="text-primary-600">
                    Foto pulang
                  </a>
                )}
              </div>
              {item.reason && <p className="text-xs text-gray-400 mt-1">{item.reason}</p>}
            </div>
          ))}

          {items.length === 0 && !loading && (
            <p className="text-sm text-gray-400 px-4 py-10 text-center">
              Tidak ada data untuk filter ini.
            </p>
          )}
        </div>

        {hasMore && (
          <button
            onClick={() => fetchHistory(items.length, true)}
            disabled={loading}
            className="w-full mt-4 bg-white border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Memuat...' : 'Muat Lebih Banyak'}
          </button>
        )}
      </div>
    </div>
  );
}
