import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import ThemeToggle from '../components/ThemeToggle';

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

      if (res.data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white text-2xl font-bold mb-4 shadow-glow">
            AK
          </div>
          <h1 className="text-2xl font-bold text-strong uppercase">Absensi Konsultan</h1>
          <p className="text-sm text-muted mt-1.5">Absensi modern, cukup dari genggaman</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface/80 backdrop-blur-2xl rounded-3xl border border-line shadow-glass p-7 space-y-4"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 rounded-xl text-sm font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className="text-center text-xs text-faint mt-6">
          © {new Date().getFullYear()} by : PERCIPKAR — Sistem Absensi Konsultan
        </p>
      </div>
    </div>
  );
}
