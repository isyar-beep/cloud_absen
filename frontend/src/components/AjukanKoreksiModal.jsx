import { useEffect, useState } from 'react';
import api from '../api/axios';
import { formatTanggalHari, formatJam } from '../utils/tanggal';

function keJamInput(stempel) {
  if (!stempel) return '';
  const cocok = String(stempel).match(/[ T](\d{2}):(\d{2})/);
  return cocok ? `${cocok[1]}:${cocok[2]}` : '';
}

// Pengajuan koreksi jam absen oleh pegawai.
//
// Jam yang dikosongkan berarti "biarkan seperti sekarang" -- pegawai yang
// hanya lupa absen pulang cukup mengisi satu kolom. Keputusan tetap di
// tangan admin; halaman ini tidak pernah mengubah absensi secara langsung.
export default function AjukanKoreksiModal({ baris, onTutup, onKirim }) {
  const [form, setForm] = useState({
    requested_check_in: '',
    requested_check_out: '',
    reason: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onTutup();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onTutup]);

  async function kirim(e) {
    e.preventDefault();
    setError('');
    if (!form.requested_check_in && !form.requested_check_out) {
      setError('Isi minimal satu usulan jam (masuk atau pulang).');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/corrections', {
        date: baris.date,
        requested_check_in: form.requested_check_in || null,
        requested_check_out: form.requested_check_out || null,
        reason: form.reason,
      });
      onKirim(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengirim pengajuan.');
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
        className="kaca-pekat border border-line rounded-2xl shadow-glass w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-line">
          <p className="text-sm font-bold text-strong">Ajukan Koreksi Absensi</p>
          <p className="text-xs text-muted mt-0.5">{formatTanggalHari(baris.date)}</p>
        </div>

        <form onSubmit={kirim} className="p-5 space-y-4">
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <div className="bg-surface-2 rounded-xl px-3.5 py-2.5">
            <p className="text-[11px] text-faint mb-0.5">Tercatat sekarang</p>
            <p className="text-sm text-body tabular-nums">
              Masuk {formatJam(baris.check_in_time)} · Pulang {formatJam(baris.check_out_time)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Usulan jam masuk</label>
              <input
                type="time"
                value={form.requested_check_in}
                onChange={(e) => setForm({ ...form, requested_check_in: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Usulan jam pulang</label>
              <input
                type="time"
                value={form.requested_check_out}
                onChange={(e) => setForm({ ...form, requested_check_out: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-[11px] text-faint -mt-2">
            Kosongkan yang tidak perlu diubah.
          </p>

          <div>
            <label className={labelClass}>
              Alasan <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="mis. Lupa absen pulang karena rapat sampai sore"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-glow transition disabled:opacity-50"
            >
              {loading ? 'Mengirim...' : 'Kirim Pengajuan'}
            </button>
            <button
              type="button"
              onClick={onTutup}
              className="text-sm text-muted px-3 hover:text-body transition"
            >
              Batal
            </button>
          </div>

          <p className="text-[11px] text-faint">
            Absensi baru berubah setelah admin menyetujui.
          </p>
        </form>
      </div>
    </div>
  );
}
