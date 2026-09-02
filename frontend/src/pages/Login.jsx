import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import ThemeToggle from '../components/ThemeToggle';
import { BERANDA_PERAN } from '../components/ProtectedRoute';
import Tombol from '../components/Tombol';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.user, res.data.token);

      // Konsultan mendarat di halaman pemantauan, bukan halaman pegawai --
      // ia menyelia, tidak absen. Peta perannya ada di ProtectedRoute
      // supaya tidak ada dua daftar yang bisa berselisih.
      navigate(BERANDA_PERAN[res.data.user.role] || '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal login. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    // Dekorasi latar dulu digambar di sini sebagai tiga lingkaran blur.
    // Sekarang noda cahaya itu milik body (lihat index.css), jadi seluruh
    // halaman memakai latar yang sama dan tidak perlu diulang per halaman.
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      {/* Pemilih tema sudah tersedia sebelum login: pegawai yang membuka
          aplikasi di ruangan gelap tidak perlu disilaukan dulu baru bisa
          mengaturnya. */}
      <div className="absolute top-4 right-4">
        <ThemeToggle ringkas />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-[1.375rem] bg-gradient-to-br from-primary-400 to-primary-600 text-white text-[26px] font-extrabold mb-5 shadow-glow">
            AK
          </div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-400 mb-2">
            PERCIPKAR
          </p>
          <h1 className="text-[1.875rem] leading-tight font-extrabold text-strong tracking-[-0.025em]">
            Absensi Konsultan
          </h1>
          <p className="text-sm text-body mt-2">Absensi lapangan, cukup dari genggaman</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="kartu-kaca p-7 space-y-4"
        >
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-3.5 py-2.5">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-body mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@company.com"
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-sm transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-body mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-sm transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400"
            />
          </div>

          <Tombol type="submit" ukuran="lg" penuh disabled={loading} className="!mt-5">
            {loading ? 'Memproses…' : 'Masuk'}
          </Tombol>
        </form>

        <p className="text-center text-xs text-muted mt-7">
          © {new Date().getFullYear()} PERCIPKAR — Sistem Absensi Konsultan
        </p>
      </div>
    </div>
  );
}
