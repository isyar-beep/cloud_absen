import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import AdminHeader from '../components/AdminHeader';
import StatusBadge from '../components/StatusBadge';

const LIMIT = 50;

export default function AdminHistory() {
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filter, setFilter] = useState({ start_date: '', end_date: '', status: '', department_id: '' });
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data)).catch(console.error);
  }, []);

  const fetchHistory = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset };
      Object.entries(filter).forEach(([key, value]) => {
        if (value) params[key] = value;
      });

      const res = await api.get('/attendance/all', { params });
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
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatJam(t) {
    return t ? new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—';
  }

  const inputClass =
    'w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/40';

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-6xl mx-auto px-4 py-7">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Riwayat Absensi Pegawai</h1>
          <p className="text-sm text-gray-500 mt-0.5">Semua catatan absensi dengan filter</p>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-4 mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Dari tanggal</label>
            <input
              type="date"
              value={filter.start_date}
              onChange={(e) => setFilter({ ...filter, start_date: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Sampai tanggal</label>
            <input
              type="date"
              value={filter.end_date}
              onChange={(e) => setFilter({ ...filter, end_date: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Departemen</label>
            <select
              value={filter.department_id}
              onChange={(e) => setFilter({ ...filter, department_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Semua</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
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

        {/* Tabel riwayat */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Tanggal</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Nama</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Departemen</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Masuk</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Pulang</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Foto</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition">
                  <td className="px-5 py-3.5 text-gray-900 font-medium whitespace-nowrap">{formatTanggal(item.date)}</td>
                  <td className="px-5 py-3.5 text-gray-900">{item.name}</td>
                  <td className="px-5 py-3.5 text-gray-500">{item.department || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-600">{formatJam(item.check_in_time)}</td>
                  <td className="px-5 py-3.5 text-gray-600">{formatJam(item.check_out_time)}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-5 py-3.5 space-x-2 whitespace-nowrap">
                    {item.photo_in_url && (
                      <a href={item.photo_in_url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 font-medium hover:underline">
                        Masuk
                      </a>
                    )}
                    {item.photo_out_url && (
                      <a href={item.photo_out_url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 font-medium hover:underline">
                        Pulang
                      </a>
                    )}
                    {!item.photo_in_url && !item.photo_out_url && (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {items.length === 0 && !loading && (
            <p className="text-sm text-gray-400 px-5 py-12 text-center">
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
