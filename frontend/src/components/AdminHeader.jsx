import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LogoutIcon } from './Icons';

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
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-gray-200/70">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white text-sm font-bold flex items-center justify-center shadow-glow shrink-0">
            CA
          </div>
          <div className="hidden sm:block min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">Cloud Absen</p>
            <p className="text-xs text-gray-500 truncate">{user?.name}</p>
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
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition shrink-0"
          title="Keluar"
        >
          <LogoutIcon className="w-5 h-5" />
          <span className="hidden md:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}
