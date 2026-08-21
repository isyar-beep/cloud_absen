import { useEffect, useState } from 'react';
import api from '../api/axios';
import AdminHeader from '../components/AdminHeader';
import { PlusIcon } from '../components/Icons';

export default function AdminHolidays() {
  const [holidays, setHolidays] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHolidays();
  }, []);

  async function fetchHolidays() {
    const res = await api.get('/holidays');
    setHolidays(res.data);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/holidays', form);
      setForm({ date: '', name: '' });
      setShowForm(false);
      fetchHolidays();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menambah hari libur.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(holiday) {
    if (!confirm(`Hapus hari libur "${holiday.name}"?`)) return;
    await api.delete(`/holidays/${holiday.id}`);
    fetchHolidays();
  }

  function formatTanggal(d) {
    return new Date(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  const inputClass =
    'px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/40 focus:border-primary-300';
  const labelClass = 'block text-xs font-medium text-gray-500 mb-1.5';

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-3xl mx-auto px-4 py-7">
        <div className="flex justify-between items-center mb-6 gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Hari Libur</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {holidays.length} tanggal terdaftar — Sabtu &amp; Minggu otomatis dianggap bukan hari kerja
            </p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setError(''); }}
            className="flex items-center gap-1.5 text-sm bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600"
          >
            <PlusIcon className="w-4 h-4" />
            Tambah
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 mb-6 space-y-4">
            <p className="text-sm font-semibold text-gray-900">Hari Libur Baru</p>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Tanggal</label>
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div>
                <label className={labelClass}>Keterangan</label>
                <input
                  required
                  placeholder="mis. Hari Kemerdekaan"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan'}
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

        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          {holidays.map((h) => (
            <div key={h.id} className="flex justify-between items-center px-5 py-3.5 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition">
              <div>
                <p className="text-sm font-medium text-gray-900">{h.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatTanggal(h.date)}</p>
              </div>
              <button onClick={() => handleDelete(h)} className="text-xs font-semibold text-red-500 hover:text-red-600 transition">
                Hapus
              </button>
            </div>
          ))}
          {holidays.length === 0 && (
            <p className="text-sm text-gray-400 px-5 py-12 text-center">Belum ada hari libur terdaftar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
