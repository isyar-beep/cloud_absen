import { useAuthStore } from '../store/authStore';
import AdminSidebar from './AdminSidebar';

// Admin dan konsultan tetap memiliki kebutuhan pribadi yang sama dengan
// pegawai: absen, mengajukan izin, dan membaca riwayatnya sendiri. Kerangka
// navigasi pengelola dipertahankan saat membuka halaman-halaman itu supaya
// perpindahan konteks tidak terasa seperti keluar dari aplikasi admin.
export default function PersonalLayout({ children }) {
  const user = useAuthStore((s) => s.user);
  const pengelola = user?.role === 'admin' || user?.role === 'konsultan';

  if (!pengelola) return children;

  return (
    <div className="min-h-screen transition-[padding] duration-200 lg:pl-[var(--lebar-sidebar)]">
      <AdminSidebar />
      {children}
    </div>
  );
}
