import { useColorScheme } from 'react-native';

// ============================================================
// Warna aplikasi mobile, terang & gelap.
//
// React Native tidak punya CSS variable, jadi tidak ada cara memakai satu
// nama kelas untuk dua tema seperti di web. Sebagai gantinya, warna dibaca
// dari satu tempat ini lewat useWarna(), dan StyleSheet yang bergantung
// tema dibangun di dalam komponen.
//
// Temanya mengikuti setelan sistem HP dan tidak punya sakelar sendiri.
// Alasannya: aplikasi ini dibuka sebentar-sebentar untuk absen, bukan
// ditunggui berjam-jam. Menyediakan sakelar berarti pengguna harus
// mengatur dua tempat (HP dan aplikasi) untuk satu keinginan yang sama.
// Web memang punya sakelar, karena di sana browser tidak selalu
// meneruskan setelan sistem dengan andal.
// ============================================================

const TERANG = {
  gelap: false,

  latar: '#f4f6fb',
  permukaan: '#ffffff',
  permukaan2: '#f6f8fc',
  permukaan3: '#edf1f8',
  garis: '#e2e8f0',
  garisTebal: '#cbd5e1',

  teks: '#0f172a',
  teksBadan: '#334155',
  teksRedup: '#64748b',
  teksSamar: '#94a3b8',

  utama: '#2563eb',
  utamaTeks: '#ffffff',
  heroAwal: '#2563eb',

  kontras: '#111827',
  kontrasTeks: '#ffffff',

  // Warna status. Pasangan latar/teks, bukan satu warna: pil status harus
  // tetap terbaca di kedua tema, dan latar pucat khas mode terang berubah
  // jadi warna transparan berpendar di mode gelap.
  status: {
    hadir: { teks: '#15803d', latar: '#f0fdf4' },
    terlambat: { teks: '#b45309', latar: '#fffbeb' },
    izin: { teks: '#1d4ed8', latar: '#eff6ff' },
    alpha: { teks: '#b91c1c', latar: '#fef2f2' },
    sakit: { teks: '#be123c', latar: '#fff1f2' },
    cuti: { teks: '#0f766e', latar: '#f0fdfa' },
    pending: { teks: '#b45309', latar: '#fffbeb' },
    approved: { teks: '#15803d', latar: '#f0fdf4' },
    rejected: { teks: '#b91c1c', latar: '#fef2f2' },
  },

  aksen: {
    hijau: '#15803d',
    kuning: '#b45309',
    biru: '#2563eb',
    merah: '#b91c1c',
    ungu: '#7c3aed',
  },

  ungu: { teks: '#6d28d9', latar: '#f5f3ff', garis: '#ddd6fe' },
  kuning: { teks: '#92400e', latar: '#fffbeb', garis: '#fde68a' },
  merah: { teks: '#b91c1c', latar: '#fef2f2', garis: '#fecaca' },
  hijau: { teks: '#15803d', latar: '#f0fdf4', garis: '#bbf7d0' },

  titikHidup: '#22c55e',
  titikMati: '#d1d5db',
  titikSelesai: '#2563eb',
};

const GELAP = {
  gelap: true,

  latar: '#090d18',
  permukaan: '#192030',
  permukaan2: '#20293b',
  permukaan3: '#2a354a',
  garis: '#334158',
  garisTebal: '#475873',

  teks: '#f1f5f9',
  teksBadan: '#cbd5e1',
  teksRedup: '#94a3b8',
  teksSamar: '#718096',

  utama: '#2563eb',
  utamaTeks: '#ffffff',
  heroAwal: '#1e40af',

  kontras: '#f1f5f9',
  kontrasTeks: '#0f172a',

  status: {
    hadir: { teks: '#4ade80', latar: 'rgba(34,197,94,0.16)' },
    terlambat: { teks: '#fbbf24', latar: 'rgba(245,158,11,0.16)' },
    izin: { teks: '#60a5fa', latar: 'rgba(59,130,246,0.16)' },
    alpha: { teks: '#f87171', latar: 'rgba(239,68,68,0.16)' },
    sakit: { teks: '#fb7185', latar: 'rgba(244,63,94,0.16)' },
    cuti: { teks: '#2dd4bf', latar: 'rgba(20,184,166,0.16)' },
    pending: { teks: '#fbbf24', latar: 'rgba(245,158,11,0.16)' },
    approved: { teks: '#4ade80', latar: 'rgba(34,197,94,0.16)' },
    rejected: { teks: '#f87171', latar: 'rgba(239,68,68,0.16)' },
  },

  aksen: {
    hijau: '#4ade80',
    kuning: '#fbbf24',
    biru: '#60a5fa',
    merah: '#f87171',
    ungu: '#a78bfa',
  },

  ungu: { teks: '#c4b5fd', latar: 'rgba(139,92,246,0.16)', garis: 'rgba(139,92,246,0.35)' },
  kuning: { teks: '#fcd34d', latar: 'rgba(245,158,11,0.14)', garis: 'rgba(245,158,11,0.35)' },
  merah: { teks: '#fca5a5', latar: 'rgba(239,68,68,0.14)', garis: 'rgba(239,68,68,0.35)' },
  hijau: { teks: '#86efac', latar: 'rgba(34,197,94,0.14)', garis: 'rgba(34,197,94,0.35)' },

  titikHidup: '#22c55e',
  titikMati: '#475873',
  titikSelesai: '#60a5fa',
};

export function useWarna() {
  return useColorScheme() === 'dark' ? GELAP : TERANG;
}

export { TERANG, GELAP };
