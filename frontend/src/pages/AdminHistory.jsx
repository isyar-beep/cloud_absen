import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const LIMIT = 50;

const statusBadge = {
  hadir: 'bg-green-50 text-green-700',
  terlambat: 'bg-amber-50 text-amber-700',
  izin: 'bg-blue-50 text-blue-700',
  alpha: 'bg-red-50 text-red-700',
};

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
    return t ? new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link to="/admin" className="text-sm text-gray-500">← Dashboard</Link>
          <p className="font-semibold text-gray-900">Riwayat Absensi Pegawai</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Filter */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dari tanggal</label>
            <input
              type="date"
              value={filter.start_date}
              onChange={(e) => setFilter({ ...filter, start_date: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sampai tanggal</label>
            <input
              type="date"
              value={filter.end_date}
              onChange={(e) => setFilter({ ...filter, end_date: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Departemen</label>
            <select
              value={filter.department_id}
              onChange={(e) => setFilter({ ...filter, department_id: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Semua</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
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

        {/* Tabel riwayat */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Departemen</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Masuk</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Pulang</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Foto</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{formatTanggal(item.date)}</td>
                  <td className="px-4 py-3 text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-gray-600">{item.department || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{formatJam(item.check_in_time)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatJam(item.check_out_time)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${statusBadge[item.status]}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                    {item.photo_in_url && (
                      <a href={item.photo_in_url} target="_blank" rel="noreferrer" className="text-xs text-primary-600">
                        Masuk
                      </a>
                    )}
                    {item.photo_out_url && (
                      <a href={item.photo_out_url} target="_blank" rel="noreferrer" className="text-xs text-primary-600">
                        Pulang
                      </a>
                    )}
                    {!item.photo_in_url && !item.photo_out_url && (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

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
