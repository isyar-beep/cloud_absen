import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { urlFoto, useTokenFoto } from '../api/fileUrl';
import AdminHeader from '../components/AdminHeader';
import StatusBadge from '../components/StatusBadge';
import WfaBadge from '../components/WfaBadge';
import EditAbsensiModal from '../components/EditAbsensiModal';
import Koordinat from '../components/Koordinat';
import { formatTanggal, formatJam } from '../utils/tanggal';

const LIMIT = 50;

export default function AdminHistory() {
  const tokenFoto = useTokenFoto();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState({ start_date: '', end_date: '', status: '', user_id: '' });
  const [hasMore, setHasMore] = useState(false);
  const [edit, setEdit] = useState(null);
  const [pesan, setPesan] = useState('');
  const [loading, setLoading] = useState(false);

  // Daftar pegawai untuk saringan. Departemen sengaja tidak dipakai:
  // tabelnya ada, tapi belum ada pegawai yang di-assign ke departemen mana
  // pun, sehingga saringan itu selalu mengembalikan tabel kosong.
  useEffect(() => {
    api.get('/users')
      .then((res) => setUsers(res.data.filter((u) => u.role !== 'admin')))
      .catch(console.error);
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



  const inputClass =
    'w-full px-2.5 py-2 bg-surface-2 border border-line rounded-xl text-sm transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40';

  return (
    <div className="min-h-screen">
      <AdminHeader />

      <div className="max-w-6xl mx-auto px-4 py-7">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-strong tracking-tight">Riwayat Absensi Pegawai</h1>
          <p className="text-sm text-muted mt-0.5">Semua catatan absensi dengan filter</p>
        </div>

        {/* Filter */}
        <div className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft p-4 mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Dari tanggal</label>
            <input
              type="date"
              value={filter.start_date}
              onChange={(e) => setFilter({ ...filter, start_date: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Sampai tanggal</label>
            <input
              type="date"
              value={filter.end_date}
              onChange={(e) => setFilter({ ...filter, end_date: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Pegawai</label>
            <select
              value={filter.user_id}
              onChange={(e) => setFilter({ ...filter, user_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Semua pegawai</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Status</label>
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

        {pesan && (
          <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/30 rounded-xl px-4 py-3 mb-4 font-medium">
            ✓ {pesan}
          </div>
        )}

        {/* Tabel riwayat */}
        <div className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Tanggal</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Nama</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Masuk</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Pulang</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Lokasi</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Foto</th>
                <th className="text-right px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-b-0 hover:bg-surface-2/60 transition">
                  <td className="px-5 py-3.5 text-strong font-medium whitespace-nowrap">{formatTanggal(item.date)}</td>
                  <td className="px-5 py-3.5 text-strong">{item.name}</td>
                  <td className="px-5 py-3.5 text-body">{formatJam(item.check_in_time)}</td>
                  <td className="px-5 py-3.5 text-body">{formatJam(item.check_out_time)}</td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1.5">
                      <StatusBadge status={item.status} />
                      <WfaBadge mode={item.work_mode} />
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <Koordinat latitude={item.latitude} longitude={item.longitude} />
                  </td>
                  <td className="px-5 py-3.5 space-x-2 whitespace-nowrap">
                    {item.photo_in_url && (
                      <a href={urlFoto(item.photo_in_url, tokenFoto)} target="_blank" rel="noreferrer" className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline">
                        Masuk
                      </a>
                    )}
                    {item.photo_out_url && (
                      <a href={urlFoto(item.photo_out_url, tokenFoto)} target="_blank" rel="noreferrer" className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline">
                        Pulang
                      </a>
                    )}
                    {!item.photo_in_url && !item.photo_out_url && (
                      <span className="text-xs text-faint">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setEdit(item)}
                      className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 dark:text-primary-300 transition"
                    >
                      Koreksi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {items.length === 0 && !loading && (
            <p className="text-sm text-faint px-5 py-12 text-center">
              Tidak ada data untuk filter ini.
            </p>
          )}
        </div>

        {hasMore && (
          <button
            onClick={() => fetchHistory(items.length, true)}
            disabled={loading}
            className="w-full mt-4 bg-surface/75 backdrop-blur-xl border border-line text-body py-3 rounded-2xl text-sm font-semibold shadow-soft transition hover:border-line-strong disabled:opacity-50"
          >
            {loading ? 'Memuat...' : 'Muat Lebih Banyak'}
          </button>
        )}
      </div>

      {edit && (
        <EditAbsensiModal
          baris={edit}
          onTutup={() => setEdit(null)}
          onSimpan={(msg) => {
            setEdit(null);
            setPesan(msg);
            fetchHistory();
          }}
        />
      )}
    </div>
  );
}
