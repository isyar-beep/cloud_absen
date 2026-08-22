import { useEffect, useState } from 'react';
import api from './axios';

// Foto disimpan di database sebagai path relatif (mis. /uploads/absensi/2026-08/x.jpg)
// supaya datanya tidak terikat pada satu domain -- pindah server tidak membuat
// seluruh URL lama rusak.
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
  .replace(/\/api\/?$/, '');

// Foto tidak lagi dilayani terbuka: harus lewat /api/photos yang memeriksa
// token dan kepemilikan. Tag <img> tidak bisa mengirim header Authorization,
// jadi token khusus foto disisipkan di query string.
export function urlFoto(path, tokenFoto) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path; // sudah absolut (data lama)

  const relatif = path.replace(/^\/uploads\//, '').replace(/^\/+/, '');
  const q = tokenFoto ? `?t=${encodeURIComponent(tokenFoto)}` : '';
  return `${API_ORIGIN}/api/photos/${relatif}${q}`;
}

// Token foto berumur 30 menit. Disimpan di memori modul supaya beberapa
// komponen tidak masing-masing meminta token baru, dan diperbarui otomatis
// sebelum kedaluwarsa.
let cache = { token: null, kedaluwarsa: 0 };
let sedangAmbil = null;

async function ambilTokenFoto() {
  if (cache.token && Date.now() < cache.kedaluwarsa) return cache.token;
  if (sedangAmbil) return sedangAmbil;

  sedangAmbil = api
    .get('/photos/token')
    .then((res) => {
      // Diperbarui 5 menit sebelum benar-benar habis, supaya gambar yang
      // sedang dimuat tidak tiba-tiba ditolak di tengah jalan.
      cache = { token: res.data.token, kedaluwarsa: Date.now() + 25 * 60 * 1000 };
      return cache.token;
    })
    .finally(() => { sedangAmbil = null; });

  return sedangAmbil;
}

// Hook untuk halaman yang menampilkan foto
export function useTokenFoto() {
  const [token, setToken] = useState(cache.token);

  useEffect(() => {
    let batal = false;
    ambilTokenFoto()
      .then((t) => { if (!batal) setToken(t); })
      .catch(() => { if (!batal) setToken(null); });
    return () => { batal = true; };
  }, []);

  return token;
}
