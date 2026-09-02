import { useMemo } from 'react';
import { useThemeStore } from '../store/themeStore';

// ============================================================
// Warna grafik.
//
// Recharts menerima nilai JavaScript, bukan kelas Tailwind, jadi
// warnanya tidak ikut berubah sendiri saat tema berpindah. Tanpa
// berkas ini, tooltip grafik tetap putih terang di mode gelap --
// kotak menyilaukan yang muncul tepat di bawah kursor.
//
// Nilainya DIBACA DARI TOKEN, bukan ditulis ulang sebagai heksadesimal.
// Versi sebelumnya menyalin angka warnanya, dan begitu token diubah
// (muted digelapkan dua kali, kanvas diberi rona biru) grafiknya diam
// saja di warna lama -- melenceng tanpa ada yang menyadari. Dengan
// membaca token, keduanya tidak mungkin berselisih lagi.
// ============================================================

function token(nama, alpha) {
  if (typeof document === 'undefined') return '';
  const v = getComputedStyle(document.documentElement).getPropertyValue(nama).trim();
  if (!v) return '';
  return alpha === undefined ? `rgb(${v})` : `rgb(${v} / ${alpha})`;
}

export function useGrafikTema() {
  const gelap = useThemeStore((s) => s.gelap);

  // Dihitung ulang tiap kali tema berpindah, karena getComputedStyle
  // membaca nilai yang BERLAKU saat itu -- dan itu berubah begitu kelas
  // `dark` dipasang di <html>.
  return useMemo(() => ({
    sumbu: token('--c-faint'),
    kisi: token('--c-line'),
    garisUtama: gelap ? '#60a5fa' : '#2563eb',
    isiGradienAtas: gelap ? '#60a5fa' : '#2563eb',
    latarTitik: token('--c-surface'),

    // Ukuran dan tebal huruf disebut tegas: teks SVG mewarisi muka huruf
    // dari CSS, tapi tidak mewarisi ukuran yang kita pakai di kartu.
    label: { fontSize: 11, fontWeight: 500, fill: token('--c-muted') },

    tooltip: {
      borderRadius: 14,
      border: `1px solid ${token('--c-line')}`,
      background: token('--c-surface', 0.96),
      backdropFilter: 'blur(12px)',
      color: token('--c-strong'),
      boxShadow: 'var(--shadow-lift)',
      fontSize: 12,
      fontWeight: 500,
      padding: '10px 14px',
    },
    labelTooltip: { color: token('--c-strong'), fontWeight: 700, marginBottom: 4 },
    kursor: { fill: token('--c-strong', gelap ? 0.06 : 0.04) },
  }), [gelap]);
}

// Warna per status, dipakai bersama grafik dan lencana supaya "hijau"
// pada grafik adalah hijau yang sama dengan pada lencana status.
export const WARNA_STATUS = {
  hadir: '#10b981',
  terlambat: '#f59e0b',
  izin: '#3b82f6',
  alpha: '#ef4444',
};
