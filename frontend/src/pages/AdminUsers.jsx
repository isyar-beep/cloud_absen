import { useEffect, useState } from 'react';
import api from '../api/axios';
import AdminSidebar from '../components/AdminSidebar';
import { useDialog } from '../components/Dialog';
import { useAuthStore } from '../store/authStore';
import { PlusIcon } from '../components/Icons';
import Avatar from '../components/Avatar';

const LABEL_PERAN = { admin: 'Admin (Dinas)', konsultan: 'Konsultan', staff: 'Pegawai' };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const { konfirmasi } = useDialog();
  const user = useAuthStore((s) => s.user);
  const [shifts, setShifts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', shift_id: '', project_id: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Dibedakan dari `error` (kegagalan form) -- ini kegagalan memuat daftar.
  // Tanpa ini, request yang gagal cuma menampilkan tabel kosong dan terlihat
  // seolah semua akun terhapus.
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchUsers();
    api.get('/shifts').then((res) => setShifts(res.data)).catch(console.error);
    // Proyek yang sudah selesai tidak ditawarkan sebagai penugasan baru,
    // tapi tetap terbaca pada pegawai yang sudah terlanjur di sana.
    api.get('/projects')
      .then((res) => setProjects(res.data.filter((x) => x.status === 'berjalan')))
      .catch(console.error);
  }, []);

  async function fetchUsers() {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
      setLoadError('');
    } catch (err) {
      setLoadError(
        err.response?.data?.message ||
        'Gagal memuat daftar pengguna. Periksa koneksi ke server, lalu muat ulang halaman.'
      );
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/users', {
        ...form,
        shift_id: form.shift_id || null,
        project_id: form.project_id || null,
      });
      setForm({ name: '', email: '', password: '', role: 'staff', shift_id: '', project_id: '' });
      setShowForm(false);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuat pengguna.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(userItem) {
    if (userItem.is_active) {
      const setuju = await konfirmasi({
        judul: `Nonaktifkan akun ${userItem.name}?`,
        pesan: 'Akunnya tidak bisa dipakai login dan tidak ikut dihitung di statistik. '
          + 'Riwayat absensinya tetap tersimpan, dan akun ini bisa diaktifkan lagi kapan saja.',
        tombolYa: 'Nonaktifkan',
      });
      if (!setuju) return;
      await api.delete(`/users/${userItem.id}`);
    } else {
      await api.put(`/users/${userItem.id}`, { is_active: true });
    }
    fetchUsers();
  }

  async function changeShift(userItem, shiftId) {
    await api.put(`/users/${userItem.id}`, { shift_id: shiftId ? Number(shiftId) : null });
    fetchUsers();
  }

  async function changeProject(userItem, projectId) {
    await api.put(`/users/${userItem.id}`, { project_id: projectId ? Number(projectId) : null });
    fetchUsers();
  }

  const inputClass =
    'px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-sm transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40 focus:border-primary-300';
  const labelClass = 'block text-xs font-medium text-muted mb-1.5';

  return (
    <div className="min-h-screen transition-[padding] duration-200 lg:pl-[var(--lebar-sidebar)]">
      <AdminSidebar />

      <div className="max-w-4xl mx-auto px-4 py-7">
        <div className="flex justify-between items-center mb-6 gap-3">
          <div>
            <h1 className="text-xl font-bold text-strong tracking-tight">Kelola Pengguna</h1>
            <p className="text-sm text-muted mt-0.5">{users.length} akun terdaftar</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 text-sm bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600"
          >
            <PlusIcon className="w-4 h-4" />
            Tambah Pengguna
          </button>
        </div>

        {loadError && (
          <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-3 mb-5">
            {loadError}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="kartu-kaca p-5 mb-6 space-y-4">
            <p className="text-sm font-semibold text-strong">Pengguna Baru</p>
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Nama lengkap</label>
                <input
                  required
                  placeholder="mis. Budi Santoso"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  required
                  type="email"
                  placeholder="nama@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div>
                <label className={labelClass}>Password sementara</label>
                <input
                  required
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div>
                <label className={labelClass}>Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className={`${inputClass} w-full`}
                >
                  <option value="staff">Pegawai</option>
                  <option value="konsultan">Konsultan</option>
                  <option value="admin">Admin (Dinas)</option>
                </select>
              </div>
              {form.role === 'staff' && (
                <div className="sm:col-span-2">
                  <label className={labelClass}>Proyek penugasan</label>
                  <select
                    value={form.project_id}
                    onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                    className={`${inputClass} w-full`}
                  >
                    <option value="">Belum ditugaskan</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}{p.location ? ` — ${p.location}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className={labelClass}>Shift kerja</label>
                <select
                  value={form.shift_id}
                  onChange={(e) => setForm({ ...form, shift_id: e.target.value })}
                  className={`${inputClass} w-full`}
                >
                  <option value="">Tanpa shift (batas telat default 08:00)</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-ink text-on-ink px-5 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-ink/90 disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Pengguna'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-muted px-3 hover:text-body transition"
              >
                Batal
              </button>
            </div>
          </form>
        )}

        <div className="kartu-kaca overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Pengguna</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Role</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Proyek</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Shift</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-b-0 hover:bg-surface-2/60 transition">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} src={u.avatar_url} />
                      <div className="min-w-0">
                        <p className="font-medium text-strong truncate">{u.name}</p>
                        <p className="text-xs text-faint truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ring-1 ring-inset ${
                      u.role === 'admin'
                        ? 'bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-600/20'
                        : u.role === 'konsultan'
                          ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-600/20'
                          : 'bg-surface-2 text-body ring-line-strong/40'
                    }`}>
                      {LABEL_PERAN[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {/* Penugasan proyek hanya bermakna untuk pegawai. Konsultan
                        ditunjuk sebagai penanggung jawab lewat halaman Proyek,
                        dan admin tidak absen sama sekali. */}
                    {u.role === 'staff' ? (
                      <select
                        value={u.project_id || ''}
                        onChange={(e) => changeProject(u, e.target.value)}
                        className="text-xs bg-surface-2 border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                      >
                        <option value="">Belum ditugaskan</option>
                        {projects.map((pr) => (
                          <option key={pr.id} value={pr.id}>{pr.name}</option>
                        ))}
                        {/* Proyek yang sudah selesai tidak ada di daftar di atas;
                            tanpa baris ini, penugasan lama tampil kosong seolah
                            pegawainya tidak pernah ditugaskan. */}
                        {u.project_id && !projects.some((pr) => pr.id === u.project_id) && (
                          <option value={u.project_id}>{u.project_name} (selesai)</option>
                        )}
                      </select>
                    ) : (
                      <span className="text-xs text-faint">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={u.shift_id || ''}
                      onChange={(e) => changeShift(u, e.target.value)}
                      className="text-xs bg-surface-2 border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                    >
                      <option value="">Tanpa shift (08:00)</option>
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.start_time}-{s.end_time})</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ring-inset ${
                      u.is_active
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-600/20'
                        : 'bg-surface-3 text-muted ring-line-strong/40'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-faint'}`} />
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {/* Baris akun sendiri tidak menawarkan tombolnya. Server
                        juga menolak, tapi menawarkan tombol yang pasti gagal
                        hanya membuat orang mencoba lalu bingung. */}
                    {u.id === user?.id ? (
                      <span className="text-xs text-faint">Akun Anda</span>
                    ) : (
                      <button
                        onClick={() => toggleActive(u)}
                        className={`text-xs font-semibold transition ${
                          u.is_active
                            ? 'text-red-500 hover:text-red-600 dark:text-red-400'
                            : 'text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300'
                        }`}
                      >
                        {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
