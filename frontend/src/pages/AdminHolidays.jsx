import { useEffect, useState } from 'react';
import api from '../api/axios';
import AdminSidebar from '../components/AdminSidebar';
import { useDialog } from '../components/Dialog';
import { PlusIcon } from '../components/Icons';
import { tanggalLokal } from '../utils/tanggal';

export default function AdminHolidays() {
  const [holidays, setHolidays] = useState([]);
  const { konfirmasi } = useDialog();
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
    const setuju = await konfirmasi({
      judul: `Hapus hari libur "${holiday.name}"?`,
      pesan: 'Absen di tanggal itu akan terbuka kembali untuk semua pegawai.',
      tombolYa: 'Hapus',
    });
    if (!setuju) return;
    await api.delete(`/holidays/${holiday.id}`);
    fetchHolidays();
  }

  function formatTanggal(d) {
    return tanggalLokal(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  const inputClass =
    'px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-sm transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40 focus:border-primary-300';
  const labelClass = 'block text-xs font-medium text-muted mb-1.5';

  return (
    <div className="min-h-screen transition-[padding] duration-200 lg:pl-[var(--lebar-sidebar)]">
      <AdminSidebar />

      <div className="wadah-petak px-5 lg:px-8 py-7">
        <div className="flex justify-between items-center mb-6 gap-3">
          <div>
            <h1 className="text-[1.75rem] leading-tight font-extrabold text-strong tracking-[-0.02em]">Hari Libur</h1>
            <p className="text-sm text-muted mt-0.5">
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
          <form onSubmit={handleSubmit} className="kartu-kaca max-w-4xl p-5 mb-6 space-y-4">
            <p className="text-[17px] font-bold text-strong tracking-[-0.01em]">Hari Libur Baru</p>
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-2.5">
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
                className="bg-ink text-on-ink px-5 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-ink/90 disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan'}
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

        <div className="kartu-kaca overflow-hidden">
          {holidays.map((h) => (
            <div key={h.id} className="flex justify-between items-center px-5 py-3.5 border-b border-line last:border-b-0 hover:bg-surface-2/60 transition">
              <div>
                <p className="text-sm font-medium text-strong">{h.name}</p>
                <p className="text-xs text-faint mt-0.5">{formatTanggal(h.date)}</p>
              </div>
              <button onClick={() => handleDelete(h)} className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 transition">
                Hapus
              </button>
            </div>
          ))}
          {holidays.length === 0 && (
            <p className="text-sm text-faint px-5 py-12 text-center">Belum ada hari libur terdaftar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
