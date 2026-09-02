import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { urlFoto, useTokenFoto } from '../api/fileUrl';
import AdminSidebar from '../components/AdminSidebar';
import StatusBadge from '../components/StatusBadge';
import WfaBadge from '../components/WfaBadge';
import EditAbsensiModal from '../components/EditAbsensiModal';
import Koordinat from '../components/Koordinat';
import Pilihan, { KELAS_PILIHAN } from '../components/Pilihan';
import { formatTanggal, formatJam } from '../utils/tanggal';

const LIMIT = 50;

const STATUS_SAH = ['hadir', 'terlambat', 'izin', 'alpha'];

// Nilai status dari alamat, disaring lewat daftar putih. Boleh berisi
// beberapa status dipisah koma; server memahami bentuk yang sama.
function bersihkanStatus(nilai) {
  return String(nilai || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => STATUS_SAH.includes(s))
    .join(',');
}

export default function AdminHistory() {
  const tokenFoto = useTokenFoto();
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  // Seluruh saringan dibaca dari alamat, bukan cuma proyek. Dengan begitu
  // angka di dashboard bisa menjadi tautan yang membuka halaman ini dalam
  // keadaan sudah tersaring -- misalnya "Alpha: 3" langsung memperlihatkan
  // ketiganya, bukan menyuruh orang menyetel saringannya sendiri.
  const [filter, setFilter] = useState(() => {
    const url = new URLSearchParams(window.location.search);
    const status = url.get('status');
    return {
      start_date: url.get('start_date') || '',
      end_date: url.get('end_date') || '',
      // Hanya nilai yang memang dikenal; alamat bisa diketik siapa saja.
      // Boleh lebih dari satu dipisah koma, karena KPI "Hadir Hari Ini"
      // menjumlahkan hadir dan terlambat sekaligus.
      status: bersihkanStatus(status),
      user_id: '',
      project_id: url.get('project_id') || '',
    };
  });
  const [projects, setProjects] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [edit, setEdit] = useState(null);
  const [pesan, setPesan] = useState('');
  const [loading, setLoading] = useState(false);

  // Daftar pegawai untuk saringan. Departemen sengaja tidak dipakai:
  // tabelnya ada, tapi belum ada pegawai yang di-assign ke departemen mana
  // pun, sehingga saringan itu selalu mengembalikan tabel kosong.
  useEffect(() => {
    api.get('/projects').then((res) => setProjects(res.data)).catch(() => {});
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
    <div className="min-h-screen transition-[padding] duration-200 lg:pl-[var(--lebar-sidebar)]">
      <AdminSidebar />

      <div className="wadah-petak px-5 lg:px-8 py-7">
        <div className="mb-6">
          <h1 className="text-[1.75rem] leading-tight font-extrabold text-strong tracking-[-0.02em]">Riwayat Absensi Pegawai</h1>
          <p className="text-sm text-body mt-0.5">Semua catatan absensi dengan filter</p>
        </div>

        {/* Filter */}
        <div className="kartu-kaca p-4 mb-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
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
            <label className="block text-xs font-medium text-muted mb-1.5">Proyek</label>
            <Pilihan
              value={filter.project_id}
              onChange={(e) => setFilter({ ...filter, project_id: e.target.value })}
              ariaLabel="Proyek"
              className={`${KELAS_PILIHAN} w-full`}
              options={[
                { value: '', label: 'Semua proyek' },
                ...projects.map((pr) => ({ value: pr.id, label: pr.name })),
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Pegawai</label>
            <Pilihan
              value={filter.user_id}
              onChange={(e) => setFilter({ ...filter, user_id: e.target.value })}
              ariaLabel="Pegawai"
              className={`${KELAS_PILIHAN} w-full`}
              options={[
                { value: '', label: 'Semua pegawai' },
                ...users.map((u) => ({ value: u.id, label: u.name })),
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Status</label>
            <Pilihan
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              ariaLabel="Status"
              className={`${KELAS_PILIHAN} w-full`}
              options={[
                { value: '', label: 'Semua' },
                // Pasangan ini punya pilihannya sendiri supaya saringan yang
                // datang dari tautan dashboard tetap terbaca di kotak ini --
                // tanpa pilihan yang cocok, kotaknya tampil seolah "Semua"
                // padahal daftarnya sedang tersaring.
                { value: 'hadir,terlambat', label: 'Hadir & terlambat' },
                { value: 'hadir', label: 'Hadir' },
                { value: 'terlambat', label: 'Terlambat' },
                { value: 'izin', label: 'Izin' },
                { value: 'alpha', label: 'Alpha' },
              ]}
            />
          </div>
        </div>

        {pesan && (
          <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/30 rounded-xl px-4 py-3 mb-4 font-medium">
            ✓ {pesan}
          </div>
        )}

        {/* Tabel riwayat */}
        <div className="kartu-kaca overflow-x-auto p-4">
          <table className="tabel-pil text-sm">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Nama</th>
                <th>Masuk</th>
                <th>Pulang</th>
                <th>Status</th>
                <th>Lokasi</th>
                <th>Foto</th>
                <th className="!text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="text-strong font-medium whitespace-nowrap">{formatTanggal(item.date)}</td>
                  <td className="text-strong">
                    {item.name}
                    {/* Proyek yang TERCAP pada baris ini, bukan penugasan
                        pegawai saat ini -- pegawai yang sudah dimutasi tetap
                        terbaca di proyek tempat kehadirannya terjadi. */}
                    {item.project_name && (
                      <span className="block text-[11px] text-faint font-normal mt-0.5">{item.project_name}</span>
                    )}
                  </td>
                  <td className="text-body">{formatJam(item.check_in_time)}</td>
                  <td className="text-body">{formatJam(item.check_out_time)}</td>
                  <td>
                    <span className="flex items-center gap-1.5">
                      <StatusBadge status={item.status} kurang={item.kurang} />
                      <WfaBadge mode={item.work_mode} />
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <Koordinat latitude={item.latitude} longitude={item.longitude} />
                  </td>
                  <td className="space-x-2 whitespace-nowrap">
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
                  <td className="text-right">
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
