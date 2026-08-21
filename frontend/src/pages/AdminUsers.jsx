import { useEffect, useState } from 'react';
import api from '../api/axios';
import AdminHeader from '../components/AdminHeader';
import { PlusIcon } from '../components/Icons';

// Avatar inisial nama dengan warna deterministik
function InitialAvatar({ name }) {
  const colors = [
    'bg-primary-100 text-primary-700', 'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700',
  ];
  const idx = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  const initials = (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${colors[idx]}`}>
      {initials}
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', shift_id: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    api.get('/shifts').then((res) => setShifts(res.data)).catch(console.error);
  }, []);

  async function fetchUsers() {
    const res = await api.get('/users');
    setUsers(res.data);
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
    'px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/40 focus:border-primary-300';
  const labelClass = 'block text-xs font-medium text-gray-500 mb-1.5';

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-4xl mx-auto px-4 py-7">
        <div className="flex justify-between items-center mb-6 gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Kelola Pengguna</h1>
            <p className="text-sm text-gray-500 mt-0.5">{users.length} akun terdaftar</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 text-sm bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600"
          >
            <PlusIcon className="w-4 h-4" />
            Tambah Pengguna
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 mb-6 space-y-4">
            <p className="text-sm font-semibold text-gray-900">Pengguna Baru</p>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
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
                className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Pengguna'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-gray-500 px-3 hover:text-gray-700 transition"
              >
                Batal
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Pengguna</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Role</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Shift</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <InitialAvatar name={u.name} />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ring-1 ring-inset ${
                      u.role === 'admin'
                        ? 'bg-violet-50 text-violet-700 ring-violet-600/20'
                        : 'bg-gray-50 text-gray-600 ring-gray-500/20'
                    }`}>
                      {u.role === 'admin' ? 'Admin' : 'Staff'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={u.shift_id || ''}
                      onChange={(e) => changeShift(u, e.target.value)}
                      className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
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
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                        : 'bg-gray-100 text-gray-500 ring-gray-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`text-xs font-semibold transition ${
                        u.is_active
                          ? 'text-red-500 hover:text-red-600'
                          : 'text-primary-600 hover:text-primary-700'
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
