import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';
import JenisBadge from '../components/JenisBadge';
import { ArrowLeftIcon } from '../components/Icons';
import { formatTanggal, tanggalLokal } from '../utils/tanggal';
import { urlFoto, useTokenFoto } from '../api/fileUrl';

const JENIS = [
  { id: 'izin', label: 'Izin', bantu: 'Keperluan pribadi atau keluarga' },
  { id: 'sakit', label: 'Sakit', bantu: 'Lampirkan surat dokter bila ada' },
  { id: 'cuti', label: 'Cuti', bantu: 'Cuti beberapa hari' },
];

const MAKS_BYTE = 5 * 1024 * 1024;
const FORMAT_DITERIMA = ['application/pdf', 'image/jpeg', 'image/png'];

const FORM_KOSONG = { type: 'izin', start_date: '', end_date: '', reason: '' };

export default function Leaves() {
  const navigate = useNavigate();
  const tokenFoto = useTokenFoto();
  const berkasRef = useRef(null);
  const [leaves, setLeaves] = useState([]);
  const [form, setForm] = useState(FORM_KOSONG);
  const [berkas, setBerkas] = useState(null);
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

  // Diperiksa di sini juga, bukan hanya di server: pegawai yang salah pilih
  // berkas sebaiknya tahu sebelum menunggu unggahan 5MB selesai.
  function pilihBerkas(e) {
    const f = e.target.files?.[0];
    setError('');
    if (!f) { setBerkas(null); return; }
    if (!FORMAT_DITERIMA.includes(f.type)) {
      setError('Lampiran harus PDF, JPG, atau PNG.');
      e.target.value = '';
      setBerkas(null);
      return;
    }
    if (f.size > MAKS_BYTE) {
      setError(`Ukuran lampiran maksimal 5MB. Berkas Anda ${(f.size / 1024 / 1024).toFixed(1)}MB.`);
      e.target.value = '';
      setBerkas(null);
      return;
    }
    setBerkas(f);
  }

  function hapusBerkas() {
    setBerkas(null);
    if (berkasRef.current) berkasRef.current.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      // Selalu multipart supaya satu jalur saja yang perlu benar, ada
      // lampiran maupun tidak.
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, v));
      if (berkas) data.append('document', berkas);

      const res = await api.post('/leaves', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage(res.data.message);
      setForm(FORM_KOSONG);
      hapusBerkas();
      fetchLeaves();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengirim pengajuan.');
    } finally {
      setLoading(false);
    }
  }

  const jenisTerpilih = JENIS.find((j) => j.id === form.type) || JENIS[0];

  const jumlahHari = form.start_date && form.end_date
    ? Math.round((tanggalLokal(form.end_date) - tanggalLokal(form.start_date)) / 86400000) + 1
    : 0;

  const inputClass =
    'w-full px-3 py-2.5 bg-surface-2 border border-line rounded-xl text-sm transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40';

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-strong transition mb-5"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Kembali
        </button>

        <h1 className="text-xl font-bold text-strong tracking-tight mb-1">Pengajuan Izin</h1>
        <p className="text-sm text-muted mb-6">
          Ajukan izin, sakit, atau cuti. Status berubah setelah direview konsultan atau dinas.
        </p>

        {message && (
          <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/30 rounded-xl px-4 py-3 mb-4 font-medium">
            ✓ {message}
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="kartu-kaca p-5 space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-body mb-1.5">Jenis pengajuan</label>
            <div className="grid grid-cols-3 gap-2">
              {JENIS.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setForm({ ...form, type: j.id })}
                  className={`py-2 rounded-xl text-sm font-semibold border transition ${
                    form.type === j.id
                      ? 'bg-primary-600 text-white border-primary-600 shadow-glow'
                      : 'bg-surface-2 text-body border-line hover:border-line-strong'
                  }`}
                >
                  {j.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-faint mt-1.5">{jenisTerpilih.bantu}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-body mb-1.5">Dari tanggal</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-body mb-1.5">Sampai tanggal</label>
              <input
                type="date"
                required
                min={form.start_date}
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          {jumlahHari > 0 && (
            <p className="text-xs text-muted -mt-2">
              {jumlahHari} hari kalender.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-body mb-1.5">Alasan</label>
            <textarea
              required
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Contoh: keperluan keluarga, kontrol ke dokter, dll."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-body mb-1.5">
              Lampiran <span className="text-faint font-normal">(opsional)</span>
            </label>
            {berkas ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-surface-2 border border-line rounded-xl">
                <p className="text-sm text-body truncate">
                  {berkas.name}
                  <span className="text-xs text-faint ml-1.5">
                    {berkas.size < 1024 ? '<1' : (berkas.size / 1024).toFixed(0)} KB
                  </span>
                </p>
                <button
                  type="button"
                  onClick={hapusBerkas}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 transition shrink-0"
                >
                  Hapus
                </button>
              </div>
            ) : (
              <input
                ref={berkasRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={pilihBerkas}
                className="w-full text-sm text-body file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-surface-3 file:text-body hover:file:bg-surface-3 file:cursor-pointer"
              />
            )}
            <p className="text-xs text-faint mt-1.5">
              Surat dokter, surat tugas, atau surat cuti. PDF/JPG/PNG maks. 5MB.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 rounded-xl text-sm font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Mengirim...' : `Ajukan ${jenisTerpilih.label}`}
          </button>
        </form>

        <div className="kartu-kaca overflow-hidden">
          <p className="text-[17px] font-bold text-strong tracking-[-0.01em] px-5 pt-4 pb-2">Riwayat Pengajuan</p>
          {leaves.map((item) => (
            <div key={item.id} className="px-5 py-3.5 border-t border-line hover:bg-surface-2/60 transition">
              <div className="flex justify-between items-center gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <JenisBadge jenis={item.type} />
                  <p className="text-sm font-medium text-strong truncate">
                    {formatTanggal(item.start_date)}
                    {item.start_date !== item.end_date && ` — ${formatTanggal(item.end_date)}`}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-xs text-muted">{item.reason}</p>
              {item.document_url && (
                <a
                  href={urlFoto(item.document_url, tokenFoto)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline mt-1"
                >
                  Lihat lampiran{item.document_name ? ` — ${item.document_name}` : ''}
                </a>
              )}
              {item.admin_note && (
                <p className="text-xs text-faint mt-1 italic">Catatan admin: {item.admin_note}</p>
              )}
            </div>
          ))}
          {leaves.length === 0 && (
            <p className="text-sm text-faint px-5 py-8 text-center">Belum ada pengajuan.</p>
          )}
        </div>
      </div>
    </div>
  );
}
