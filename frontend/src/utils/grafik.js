import { useThemeStore } from '../store/themeStore';

// Recharts menerima nilai JavaScript, bukan kelas Tailwind, jadi warnanya
// tidak ikut berubah sendiri saat tema berpindah. Tanpa berkas ini,
// tooltip grafik tetap putih terang di mode gelap -- kotak menyilaukan
// yang muncul tepat di bawah kursor.
//
// Nilainya dihitung ulang setiap kali `gelap` berubah, jadi grafik
// berpindah tema bersamaan dengan sisa halaman.
export function useGrafikTema() {
  const gelap = useThemeStore((s) => s.gelap);

  return gelap
    ? {
        sumbu: '#7c8aa5',
        kisi: '#26324a',
        garisUtama: '#60a5fa',
        isiGradienAtas: '#60a5fa',
        latarTitik: '#192030',
        tooltip: {
          borderRadius: 12,
          border: '1px solid #33415a',
          background: '#192030',
          color: '#e2e8f0',
          boxShadow: '0 8px 24px -8px rgb(0 0 0 / 0.6)',
          fontSize: 12,
          padding: '8px 12px',
        },
        kursor: { fill: 'rgb(255 255 255 / 0.05)' },
      }
    : {
        sumbu: '#94a3b8',
        kisi: '#eef2f7',
        garisUtama: '#2563eb',
        isiGradienAtas: '#2563eb',
        latarTitik: '#ffffff',
        tooltip: {
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          color: '#0f172a',
          boxShadow: '0 8px 24px -8px rgb(15 23 42 / 0.14)',
          fontSize: 12,
          padding: '8px 12px',
        },
        kursor: { fill: 'rgb(15 23 42 / 0.04)' },
      };
}
