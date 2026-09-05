import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Sisipkan token JWT otomatis ke setiap request jika sudah login
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Jika token kedaluwarsa (401), otomatis logout & redirect ke login.
// Pengecualian: 401 dari endpoint login itu sendiri (password salah) --
// biarkan halaman login menampilkan pesan errornya, jangan reload halaman.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Server menolak karena sandi sementara belum diganti.
    //
    // Jaring pengaman untuk sesi yang sudah terbuka SEBELUM keadaan itu
    // muncul -- misalnya tab yang dibiarkan terbuka sejak sebelum
    // pembaruan ini dipasang. Tanpa ini, layarnya hanya menampilkan
    // penolakan di mana-mana tanpa memberi tahu apa yang harus dilakukan.
    if (error.response?.status === 403 && error.response.data?.harus_ganti_sandi) {
      try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user && !user.harus_ganti_sandi) {
          localStorage.setItem('user', JSON.stringify({ ...user, harus_ganti_sandi: true }));
          window.location.reload();
        }
      } catch {
        // Isi localStorage rusak. Dibiarkan -- 401 berikutnya yang akan
        // memulangkannya ke halaman login.
      }
    }

    const dariLogin = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !dariLogin) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
