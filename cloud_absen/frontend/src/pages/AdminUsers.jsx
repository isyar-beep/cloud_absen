import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
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
      await api.post('/users', form);
      setForm({ name: '', email: '', password: '', role: 'staff' });
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-sm text-gray-500">← Dashboard</Link>
            <p className="font-semibold text-gray-900">Kelola Pengguna</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm bg-primary-600 text-white px-4 py-2 rounded-lg font-medium"
          >
            + Tambah Pengguna
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                placeholder="Nama lengkap"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                required
                type="password"
                placeholder="Password sementara"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan Pengguna'}
            </button>
          </form>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{u.role}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${u.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleActive(u)}
                      className="text-xs text-primary-600 font-medium"
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
