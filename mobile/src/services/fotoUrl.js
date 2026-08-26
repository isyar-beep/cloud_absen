import { useCallback, useEffect, useRef, useState } from 'react';
import api from './api';

// ============================================================
// URL foto yang butuh login.
//
// Foto TIDAK dilayani sebagai berkas publik: server memeriksa siapa yang
// memintanya. Tapi <Image> di React Native -- seperti <img> di browser --
// tidak bisa mengirim header Authorization. Karena itu server menerbitkan
// token khusus berumur pendek yang hanya bisa membaca foto, dan token itu
// ikut sebagai parameter di URL.
//
// Kembaran frontend/src/api/fileUrl.js.
// ============================================================

// Token berlaku 30 menit di server. Diperbarui lebih awal supaya tidak
// pernah ada foto yang gagal dimuat tepat di detik kedaluwarsanya.
const SEGARKAN_TIAP = 20 * 60 * 1000;

export function useTokenFoto() {
  const [token, setToken] = useState(null);
  const hidup = useRef(true);

  const ambil = useCallback(async () => {
    try {
      const res = await api.get('/photos/token');
      if (hidup.current) setToken(res.data.token);
    } catch (err) {
      // Foto tidak tampil, tapi sisa layar tetap berfungsi.
      console.log('Gagal mengambil token foto:', err.message);
    }
  }, []);

  useEffect(() => {
    hidup.current = true;
    ambil();
    const timer = setInterval(ambil, SEGARKAN_TIAP);
    return () => {
      hidup.current = false;
      clearInterval(timer);
    };
  }, [ambil]);

  return token;
}

// "/uploads/avatar/x.jpg" -> "http://host/api/photos/avatar/x.jpg?t=..."
export function urlFoto(pathRelatif, token) {
  if (!pathRelatif || !token) return null;
  const bersih = String(pathRelatif).replace(/^\/uploads\//, '');
  return `${api.defaults.baseURL}/photos/${bersih}?t=${encodeURIComponent(token)}`;
}
