import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// Halaman awal tiap peran. Dipakai saat seseorang membuka halaman yang
// bukan haknya: dipulangkan ke rumahnya sendiri, bukan ke halaman pegawai
// yang tidak berarti apa-apa bagi dinas maupun konsultan.
export const BERANDA_PERAN = {
  admin: '/admin',
  konsultan: '/admin',
  staff: '/dashboard',
};

// Membungkus halaman yang butuh login. `allowedRole` boleh satu peran
// atau daftar peran; kalau kosong, semua yang sudah masuk diizinkan.
export default function ProtectedRoute({ children, allowedRole }) {
  const { user, token } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole) {
    const boleh = Array.isArray(allowedRole) ? allowedRole : [allowedRole];
    if (!boleh.includes(user.role)) {
      return <Navigate to={BERANDA_PERAN[user.role] || '/dashboard'} replace />;
    }
  }

  return children;
}
