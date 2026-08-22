import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import { ArrowLeftIcon } from '../components/Icons';
import { formatTanggal } from '../utils/tanggal';

export default function Leaves() {
  const navigate = useNavigate();
  const [leaves, setLeaves] = useState([]);
  const [form, setForm] = useState({ start_date: '', end_date: '', reason: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLeaves();
  }, []);

  async function fetchLeaves() {
    try {
      const res = await api.get('/leaves/me');
      setLeaves(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.post('/leaves', form);
      setMessage(res.data.message);
      setForm({ start_date: '', end_date: '', reason: '' });
      fetchLeaves();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengirim pengajuan izin.');
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-5"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Kembali
        </button>

        <h1 className="text-xl font-bold text-gray-900 tracking-tight mb-1">Pengajuan Izin</h1>
        <p className="text-sm text-gray-500 mb-6">
          Ajukan izin tidak masuk. Status akan berubah setelah direview admin.
        </p>

        {message && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-4 font-medium">
            ✓ {message}
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Dari tanggal</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Sampai tanggal</label>
              <input
                type="date"
                required
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Alasan</label>
            <textarea
              required
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Contoh: keperluan keluarga, sakit, dll."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 rounded-xl text-sm font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Mengirim...' : 'Ajukan Izin'}
          </button>
        </form>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          <p className="text-sm font-semibold text-gray-900 px-5 pt-4 pb-2">Riwayat Pengajuan</p>
          {leaves.map((item) => (
            <div key={item.id} className="px-5 py-3.5 border-t border-gray-50 hover:bg-gray-50/60 transition">
              <div className="flex justify-between items-center mb-1">
                <p className="text-sm font-medium text-gray-900">
                  {formatTanggal(item.start_date)}
                  {item.start_date !== item.end_date && ` — ${formatTanggal(item.end_date)}`}
                </p>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-xs text-gray-500">{item.reason}</p>
              {item.admin_note && (
                <p className="text-xs text-gray-400 mt-1 italic">Catatan admin: {item.admin_note}</p>
              )}
            </div>
          ))}
          {leaves.length === 0 && (
            <p className="text-sm text-gray-400 px-5 py-8 text-center">Belum ada pengajuan izin.</p>
          )}
        </div>
      </div>
    </div>
  );
}
