import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

// Ubah password sendiri.
//
// Endpoint POST /api/auth/change-password sudah ada sejak awal, tapi tidak
// pernah punya tombol di layar mana pun -- satu-satunya cara pegawai
// mengganti password adalah meminta admin me-reset-nya, dan itu berarti
// passwordnya sempat diketahui orang lain.
// `wajib` dipakai saat sandinya ditetapkan admin dan belum pernah diganti
// pemiliknya. Bedanya bukan cuma tampilan: dalam keadaan itu modal ini
// TIDAK bisa ditutup, karena di belakangnya tidak ada satu pun halaman
// yang akan dilayani server sampai sandinya diganti.
export default function UbahPasswordModal({ onTutup, onSelesai, wajib = false }) {
  const gantiToken = useAuthStore((s) => s.gantiToken);
  const [form, setForm] = useState({ lama: '', baru: '', ulang: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (wajib) return undefined;
    const esc = (e) => e.key === 'Escape' && onTutup();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onTutup, wajib]);

  async function kirim(e) {
    e.preventDefault();
    setError('');

    // Ketiga pemeriksaan ini juga ada di server. Yang di sini hanya supaya
    // pegawai tidak perlu menunggu perjalanan bolak-balik untuk tahu
    // ketikannya keliru.
    //
    // Sengaja hanya yang paling kasar yang diperiksa di sini. Aturan
    // selebihnya -- sandi umum, deret, nama sendiri -- dijaga server dan
    // pesannya ditampilkan apa adanya. Menyalinnya ke sini berarti tiga
    // salinan aturan yang sama di tiga tempat, dan salinan seperti itu
    // selalu berakhir berbeda diam-diam.
    if (form.baru.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    if (form.baru !== form.ulang) {
      setError('Ulangi password tidak sama dengan password baru.');
      return;
    }
    if (form.baru === form.lama) {
      setError('Password baru tidak boleh sama dengan password lama.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/change-password', {
        oldPassword: form.lama,
        newPassword: form.baru,
      });
      // Mengganti sandi memutus seluruh sesi lain, termasuk token yang
      // sedang dipegang tab ini. Server mengirim penggantinya supaya
      // perangkat ini tidak ikut terlempar keluar.
      gantiToken(res.data.token);
      onSelesai(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengubah password.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500/40';
  const labelClass = 'block text-xs font-medium text-muted mb-1.5';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/55 dark:bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={wajib ? undefined : onTutup}
    >
      <div
        className="kaca-pekat border border-line rounded-2xl shadow-glass w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-line">
          <p className="text-sm font-bold text-strong">
            {wajib ? 'Ganti Password Sementara' : 'Ubah Password'}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {wajib
              ? 'Password Anda ditetapkan admin, jadi bukan hanya Anda yang mengetahuinya. Ganti sekarang sebelum melanjutkan.'
              : 'Minimal 8 karakter, bukan nama Anda, dan bukan sandi yang umum dipakai'}
          </p>
        </div>

        <form onSubmit={kirim} className="p-5 space-y-4">
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>Password lama</label>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={form.lama}
              onChange={(e) => setForm({ ...form, lama: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Password baru</label>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={form.baru}
              onChange={(e) => setForm({ ...form, baru: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Ulangi password baru</label>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={form.ulang}
              onChange={(e) => setForm({ ...form, ulang: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-glow transition disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Simpan Password'}
            </button>
            {!wajib && (
              <button
                type="button"
                onClick={onTutup}
                className="text-sm text-muted px-3 hover:text-body transition"
              >
                Batal
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
