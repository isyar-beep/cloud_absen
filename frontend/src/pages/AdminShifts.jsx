import { useEffect, useState } from 'react';
import api from '../api/axios';
import AdminHeader from '../components/AdminHeader';
import { PlusIcon } from '../components/Icons';

export default function AdminShifts() {
  const [shifts, setShifts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', start_time: '08:00', end_time: '17:00' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchShifts();
  }, []);

  async function fetchShifts() {
    const res = await api.get('/shifts');
    setShifts(res.data);
  }

  function openCreateForm() {
    setEditingId(null);
    setForm({ name: '', start_time: '08:00', end_time: '17:00' });
    setError('');
    setShowForm(true);
  }

  function openEditForm(shift) {
    setEditingId(shift.id);
    setForm({ name: shift.name, start_time: shift.start_time, end_time: shift.end_time });
    setError('');
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/shifts/${editingId}`, form);
      } else {
        await api.post('/shifts', form);
      }
      setShowForm(false);
      fetchShifts();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan shift.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(shift) {
    if (!confirm(`Hapus shift "${shift.name}"? Pegawai yang memakainya jadi tanpa shift (batas telat default 08:00).`)) return;
    await api.delete(`/shifts/${shift.id}`);
    fetchShifts();
  }

  const inputClass =
    'px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/40';

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-4xl mx-auto px-4 py-7">
        <div className="flex justify-between items-center mb-6 gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Kelola Shift</h1>
            <p className="text-sm text-gray-500 mt-0.5">{shifts.length} shift terdaftar — menentukan batas jam telat per pegawai</p>
          </div>
          <button
            onClick={openCreateForm}
            className="flex items-center gap-1.5 text-sm bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600"
          >
            <PlusIcon className="w-4 h-4" />
            Tambah Shift
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 mb-6 space-y-4">
            <p className="text-sm font-semibold text-gray-900">{editingId ? 'Edit Shift' : 'Shift Baru'}</p>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                required
                placeholder="Nama shift (mis. Shift Pagi)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Jam masuk</label>
                <input
                  required
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Jam pulang</label>
                <input
                  required
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Pegawai yang check-in setelah jam masuk shift ini otomatis tercatat "terlambat".
            </p>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Shift'}
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
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Shift</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Jam Kerja</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Pegawai</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{s.name}</td>
                  <td className="px-5 py-3.5 text-gray-600 tabular-nums">{s.start_time} — {s.end_time}</td>
                  <td className="px-5 py-3.5 text-gray-600">{s.jumlah_pegawai} orang</td>
                  <td className="px-5 py-3.5 text-right space-x-3">
                    <button onClick={() => openEditForm(s)} className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(s)} className="text-xs font-semibold text-red-500 hover:text-red-600 transition">
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-sm text-gray-400 px-5 py-12">
                    Belum ada shift. Tambahkan shift pertama.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
