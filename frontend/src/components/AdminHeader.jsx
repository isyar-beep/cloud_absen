import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LogoutIcon } from './Icons';
import ThemeToggle from './ThemeToggle';

const navItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/stats', label: 'Statistik' },
  { to: '/admin/history', label: 'Riwayat' },
  { to: '/admin/gallery', label: 'Galeri Foto' },
  { to: '/admin/leaves', label: 'Pengajuan' },
  { to: '/admin/users', label: 'Pengguna' },
  { to: '/admin/shifts', label: 'Shift & WFA' },
  { to: '/admin/holidays', label: 'Hari Libur' },
];

// Header admin: sticky dengan efek blur, menandai menu yang sedang aktif
export default function AdminHeader() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur-lg border-b border-line/70">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white text-sm font-bold flex items-center justify-center shadow-glow shrink-0">
            AK
          </div>
          <div className="hidden sm:block min-w-0">
            <p className="text-sm font-semibold text-strong truncate">Absensi Konsultan</p>
            <p className="text-xs text-muted truncate">{user?.name}</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  active
                    ? 'bg-primary-600 text-white shadow-glow'
                    : 'text-body hover:bg-surface-3 hover:text-strong'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <ThemeToggle ringkas />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-red-600 dark:text-red-400 transition"
            title="Keluar"
          >
            <LogoutIcon className="w-5 h-5" />
            <span className="hidden md:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
}
