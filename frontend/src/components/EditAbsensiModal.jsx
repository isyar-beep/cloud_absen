import { useEffect, useState } from 'react';
import api from '../api/axios';
import StatusBadge from './StatusBadge';
import { formatTanggalHari, formatJamDetik } from '../utils/tanggal';

// Ambil "07:15" dari "2026-08-17 07:15:00" untuk mengisi input type=time.
function keJamInput(stempel) {
  if (!stempel) return '';
  const cocok = String(stempel).match(/[ T](\d{2}):(\d{2})/);
  return cocok ? `${cocok[1]}:${cocok[2]}` : '';
}

const LABEL_KOLOM = {
  check_in_time: 'Jam masuk',
  check_out_time: 'Jam pulang',
  status: 'Status',
  reason: 'Keterangan',
};

function nilaiTampil(field, nilai) {
  if (nilai === null || nilai === '') return '(kosong)';
  if (field === 'check_in_time' || field === 'check_out_time') return formatJamDetik(nilai);
  return nilai;
}

// Jendela koreksi absensi oleh admin.
//
// Alasan perubahan sengaja wajib diisi: admin berwenang penuh mengubah
// data absensi, dan justru karena itu tiap perubahan harus punya
// keterangan yang bisa dibaca ulang saat ada sengketa kehadiran.
export default function EditAbsensiModal({ baris, onTutup, onSimpan }) {
  const [form, setForm] = useState({
    check_in_time: keJamInput(baris.check_in_time),
    check_out_time: keJamInput(baris.check_out_time),
    status: baris.status,
    reason: baris.reason || '',
    note: '',
  });
  const [riwayat, setRiwayat] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/attendance/${baris.id}/edits`)
      .then((r) => setRiwayat(r.data))
      .catch(() => setRiwayat([]));
  }, [baris.id]);

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onTutup();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onTutup]);

  async function simpan(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.put(`/attendance/${baris.id}/edit`, {
        check_in_time: form.check_in_time || null,
        check_out_time: form.check_out_time || null,
        status: form.status,
        reason: form.reason || null,
        note: form.note,
      });
      onSimpan(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan perubahan.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-sm transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40';
  const labelClass = 'block text-xs font-medium text-muted mb-1.5';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/55 dark:bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onTutup}
    >
      <div
        className="kaca-pekat border border-line rounded-2xl shadow-glass w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-line">
          <p className="text-sm font-bold text-strong">Koreksi Absensi</p>
          <p className="text-xs text-muted mt-0.5">
            {baris.name} · {formatTanggalHari(baris.date)}
          </p>
        </div>

        <form onSubmit={simpan} className="p-5 space-y-4">
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Jam masuk</label>
              <input
                type="time"
                value={form.check_in_time}
                onChange={(e) => setForm({ ...form, check_in_time: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Jam pulang</label>
              <input
                type="time"
                value={form.check_out_time}
                onChange={(e) => setForm({ ...form, check_out_time: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className={inputClass}
            >
              <option value="hadir">Hadir</option>
              <option value="terlambat">Hadir (Terlambat)</option>
              <option value="izin">Izin</option>
              <option value="alpha">Alpha</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Keterangan pada catatan absensi</label>
            <input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="opsional, tampil di riwayat pegawai"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Alasan perubahan <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="mis. Mesin absen error, dikonfirmasi ke atasan"
              className={`${inputClass} resize-none`}
            />
            <p className="text-[11px] text-faint mt-1">
              Tersimpan di jejak audit bersama nilai lama dan nama Anda. Tidak bisa dihapus.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="bg-ink text-on-ink px-5 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-ink/90 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
            <button
              type="button"
              onClick={onTutup}
              className="text-sm text-muted px-3 hover:text-body transition"
            >
              Batal
            </button>
          </div>
        </form>

        {riwayat.length > 0 && (
          <div className="px-5 pb-5">
            <p className="text-xs font-semibold text-body mb-2">
              Jejak perubahan ({riwayat.length})
            </p>
            <div className="space-y-2">
              {riwayat.map((e) => (
                <div key={e.id} className="text-[11px] bg-surface-2 border border-line rounded-xl px-3 py-2">
                  <p className="text-body">
                    <span className="font-semibold">{LABEL_KOLOM[e.field] || e.field}</span>:{' '}
                    <span className="text-faint line-through">{nilaiTampil(e.field, e.old_value)}</span>
                    {' → '}
                    <span className="font-medium text-strong">{nilaiTampil(e.field, e.new_value)}</span>
                  </p>
                  <p className="text-muted mt-0.5">
                    {e.edited_by_name || 'Pengguna terhapus'} · {formatTanggalHari(e.created_at)}
                    {e.note ? ` · ${e.note}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {riwayat.length === 0 && (
          <p className="px-5 pb-5 text-[11px] text-faint">
            Belum pernah diubah. <StatusBadge status={baris.status} /> tercatat dari absen pegawai sendiri.
          </p>
        )}
      </div>
    </div>
  );
}
