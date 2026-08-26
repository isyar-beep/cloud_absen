import { useEffect, useState } from 'react';
import api from '../api/axios';
import AdminHeader from '../components/AdminHeader';
import { PlusIcon } from '../components/Icons';
import Avatar from '../components/Avatar';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', shift_id: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Dibedakan dari `error` (kegagalan form) -- ini kegagalan memuat daftar.
  // Tanpa ini, request yang gagal cuma menampilkan tabel kosong dan terlihat
  // seolah semua akun terhapus.
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchUsers();
    api.get('/shifts').then((res) => setShifts(res.data)).catch(console.error);
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
      await api.post('/users', { ...form, shift_id: form.shift_id || null });
      setForm({ name: '', email: '', password: '', role: 'staff', shift_id: '' });
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
      if (!confirm(`Nonaktifkan akun ${userItem.name}?`)) return;
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

  const inputClass =
    'px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-sm transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40 focus:border-primary-300';
  const labelClass = 'block text-xs font-medium text-muted mb-1.5';

  return (
    <div className="min-h-screen">
      <AdminHeader />

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
          <form onSubmit={handleCreate} className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft p-5 mb-6 space-y-4">
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
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
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

        <div className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Pengguna</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Role</th>
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
                        : 'bg-surface-2 text-body ring-line-strong/40'
                    }`}>
                      {u.role === 'admin' ? 'Admin' : 'Staff'}
                    </span>
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
                    <button
                      onClick={() => toggleActive(u)}
                      className={`text-xs font-semibold transition ${
                        u.is_active
                          ? 'text-red-500 hover:text-red-600 dark:text-red-400'
                          : 'text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 dark:text-primary-300'
                      }`}
                    >
                      {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
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
