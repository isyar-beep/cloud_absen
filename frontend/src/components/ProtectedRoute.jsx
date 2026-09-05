import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import UbahPasswordModal from './UbahPasswordModal';

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
  const { user, token, sandiSudahDiganti } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // Sandi sementara yang ditetapkan admin harus diganti sebelum apa pun.
  //
  // Diperiksa DI SINI karena setiap halaman terjaga melewati komponen ini
  // -- sama seperti alasan pemeriksaannya ditaruh di middleware
  // authenticate di server, bukan di tiap rute. Halaman yang ditambahkan
  // kemudian ikut terjaga tanpa perlu ada yang mengingatnya.
  //
  // Server tetap yang menegakkan: seluruh endpoint selain ganti sandi
  // membalas 403 selama tandanya masih menyala. Yang di sini hanya supaya
  // pengguna melihat layar yang benar, bukan dinding penolakan.
  if (user.harus_ganti_sandi) {
    return (
      <UbahPasswordModal
        wajib
        onSelesai={() => sandiSudahDiganti()}
        // Tanpa jalan keluar: menutupnya akan mengembalikan orang ke
        // halaman yang seluruh isinya akan ditolak server.
        onTutup={() => {}}
      />
    );
  }

  if (allowedRole) {
    const boleh = Array.isArray(allowedRole) ? allowedRole : [allowedRole];
    if (!boleh.includes(user.role)) {
      return <Navigate to={BERANDA_PERAN[user.role] || '/dashboard'} replace />;
    }
  }

  return children;
}
