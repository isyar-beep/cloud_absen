import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

// Membungkus halaman yang butuh login. Jika allowedRole diisi,
// hanya role tersebut yang boleh masuk (misal 'admin').
export default function ProtectedRoute({ children, allowedRole }) {
  const { user, token } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
