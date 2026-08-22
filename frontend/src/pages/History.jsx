import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { urlFoto } from '../api/fileUrl';
import StatusBadge from '../components/StatusBadge';
import { ArrowLeftIcon } from '../components/Icons';

const LIMIT = 30;

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
    return t ? new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—';
  }

  const inputClass =
    'w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/40';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-5"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Kembali
        </button>

        <h1 className="text-xl font-bold text-gray-900 tracking-tight mb-4">Riwayat Absensi</h1>

        {/* Filter */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-4 mb-4 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Dari</label>
            <input
              type="date"
              value={filter.start_date}
              onChange={(e) => setFilter({ ...filter, start_date: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Sampai</label>
            <input
              type="date"
              value={filter.end_date}
              onChange={(e) => setFilter({ ...filter, end_date: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className={inputClass}
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          {items.map((item) => (
            <div key={item.id} className="px-5 py-4 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition">
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-sm font-semibold text-gray-900">{formatTanggal(item.date)}</p>
                <StatusBadge status={item.status} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>Masuk: <span className="font-medium text-gray-700">{formatJam(item.check_in_time)}</span></span>
                <span>Pulang: <span className="font-medium text-gray-700">{formatJam(item.check_out_time)}</span></span>
                {item.photo_in_url && (
                  <a href={urlFoto(item.photo_in_url)} target="_blank" rel="noreferrer" className="text-primary-600 font-medium hover:underline">
                    Foto masuk
                  </a>
                )}
                {item.photo_out_url && (
                  <a href={urlFoto(item.photo_out_url)} target="_blank" rel="noreferrer" className="text-primary-600 font-medium hover:underline">
                    Foto pulang
                  </a>
                )}
              </div>
              {item.reason && <p className="text-xs text-gray-400 mt-1 italic">{item.reason}</p>}
            </div>
          ))}

          {items.length === 0 && !loading && (
            <p className="text-sm text-gray-400 px-5 py-10 text-center">
              Tidak ada data untuk filter ini.
            </p>
          )}
        </div>

        {hasMore && (
          <button
            onClick={() => fetchHistory(items.length, true)}
            disabled={loading}
            className="w-full mt-4 bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl text-sm font-semibold shadow-soft transition hover:border-gray-300 disabled:opacity-50"
          >
            {loading ? 'Memuat...' : 'Muat Lebih Banyak'}
          </button>
        )}
      </div>
    </div>
  );
}
