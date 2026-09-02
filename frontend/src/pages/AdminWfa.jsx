import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { useDialog } from '../components/Dialog';
import Avatar from '../components/Avatar';
import { PlusIcon } from '../components/Icons';
import { formatTanggalHari, tanggalLokal } from '../utils/tanggal';
import { keTanggal } from '../utils/periode';

// Penetapan WFA (Work From Anywhere).
//
// Ditetapkan admin, bukan diajukan pegawai — jadi tidak ada alur
// persetujuan di sini, cukup tambah dan batalkan.
export default function AdminWfa() {
  const [daftar, setDaftar] = useState([]);
  const { konfirmasi } = useDialog();
  const [pegawai, setPegawai] = useState([]);
  const [tampilForm, setTampilForm] = useState(false);
  const [form, setForm] = useState({ user_id: '', start_date: '', end_date: '', note: '' });
  const [saringan, setSaringan] = useState('semua');
  const [error, setError] = useState('');
  const [pesan, setPesan] = useState('');
  const [loading, setLoading] = useState(false);

  const ambil = useCallback(async () => {
    try {
      const params = saringan === 'aktif' ? { aktif: 'true' } : {};
      const res = await api.get('/wfa', { params });
      setDaftar(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat daftar WFA.');
    }
  }, [saringan]);

  useEffect(() => { ambil(); }, [ambil]);

  useEffect(() => {
    api.get('/users')
      .then((res) => setPegawai(res.data.filter((u) => u.role !== 'admin' && u.is_active)))
      .catch(console.error);
  }, []);

  function bukaForm() {
    const hariIni = keTanggal(new Date());
    setForm({ user_id: '', start_date: hariIni, end_date: hariIni, note: '' });
    setError('');
    setTampilForm(true);
  }

  async function simpan(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/wfa', form);
      setPesan(res.data.message);
      setTampilForm(false);
      ambil();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan penetapan WFA.');
    } finally {
      setLoading(false);
    }
  }

  async function hapus(w) {
    const setuju = await konfirmasi({
      judul: `Batalkan WFA ${w.name}?`,
      pesan: `Rentang ${w.start_date} s/d ${w.end_date}.\n\n`
        + 'Catatan absensi pada rentang itu akan kembali ditandai WFO.',
      tombolYa: 'Batalkan WFA',
    });
    if (!setuju) return;
    try {
      const res = await api.delete(`/wfa/${w.id}`);
      setPesan(res.data.message);
      ambil();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membatalkan penetapan WFA.');
    }
  }

  // Berapa hari kalender yang dicakup, supaya admin bisa memeriksa
  // rentangnya sebelum menyimpan.
  const jumlahHari = form.start_date && form.end_date
    ? Math.round((tanggalLokal(form.end_date) - tanggalLokal(form.start_date)) / 86400000) + 1
    : 0;

  const inputClass =
    'w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-sm transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40';
  const labelClass = 'block text-xs font-medium text-muted mb-1.5';

  return (
    <div>
      {pesan && (
        <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/30 rounded-xl px-4 py-3 mb-4 font-medium">
          ✓ {pesan}
        </div>
      )}
      {error && !tampilForm && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div className="flex gap-2">
          {[
            { key: 'semua', label: 'Semua' },
            { key: 'aktif', label: 'Sedang berjalan' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setSaringan(f.key)}
              className={`text-sm px-4 py-2 rounded-full font-medium transition ${
                saringan === f.key
                  ? 'bg-primary-600 text-white shadow-glow'
                  : 'bg-surface/75 backdrop-blur-xl border border-line text-body hover:border-line-strong'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={bukaForm}
          className="flex items-center gap-1.5 text-sm bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600"
        >
          <PlusIcon className="w-4 h-4" />
          Tetapkan WFA
        </button>
      </div>

      {tampilForm && (
        <form onSubmit={simpan} className="kartu-kaca max-w-4xl p-5 mb-6 space-y-4">
          <p className="text-sm font-semibold text-strong">Penetapan WFA Baru</p>
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Pegawai</label>
              <select
                required
                value={form.user_id}
                onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                className={inputClass}
              >
                <option value="">Pilih pegawai</option>
                {pegawai.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Mulai</label>
              <input
                required
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Selesai</label>
              <input
                required
                type="date"
                min={form.start_date}
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Keterangan</label>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="opsional, mis. Tugas luar kota"
              className={inputClass}
            />
          </div>

          {jumlahHari > 0 && (
            <p className="text-xs text-muted">
              Mencakup <span className="font-semibold">{jumlahHari} hari kalender</span>.
              Pegawai tetap absen berfoto seperti biasa — catatan absensinya
              ditandai WFA. Absensi yang sudah tercatat di rentang ini ikut ditandai.
            </p>
          )}

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
              onClick={() => setTampilForm(false)}
              className="text-sm text-muted px-3 hover:text-body transition"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2.5">
        {daftar.map((w) => (
          <div
            key={w.id}
            className={`kartu-kaca p-4 flex flex-wrap items-center justify-between gap-3 ${
              w.sedang_berjalan ? 'border-violet-200 dark:border-violet-500/35' : 'border-line'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={w.name} src={w.avatar_url} size={38} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-strong truncate">{w.name}</p>
                  {w.sedang_berjalan && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-500/30">
                      BERJALAN
                    </span>
                  )}
                  {w.sudah_lewat && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-surface-2 text-faint border border-line">
                      selesai
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {formatTanggalHari(w.start_date)}
                  {w.start_date !== w.end_date && ` — ${formatTanggalHari(w.end_date)}`}
                </p>
                {w.note && <p className="text-xs text-faint mt-0.5 italic truncate">{w.note}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[11px] text-faint">
                oleh {w.created_by_name || '—'}
              </span>
              <button
                onClick={() => hapus(w)}
                className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 transition"
              >
                Batalkan
              </button>
            </div>
          </div>
        ))}

        {daftar.length === 0 && (
          <div className="kartu-kaca px-5 py-12 text-center">
            <p className="text-sm text-faint">
              {saringan === 'aktif'
                ? 'Tidak ada pegawai yang sedang WFA hari ini.'
                : 'Belum ada penetapan WFA.'}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-faint mt-5">
        Catatan: sistem ini merekam koordinat saat absen, tapi belum
        membandingkannya dengan titik kantor. Jadi penandaan WFA saat ini
        berfungsi untuk pelaporan, bukan untuk melonggarkan pembatasan lokasi.
      </p>
    </div>
  );
}
