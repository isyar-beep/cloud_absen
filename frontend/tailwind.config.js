/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Mode gelap dikendalikan kelas `dark` di <html>, bukan preferensi sistem
  // langsung. Pilihan pengguna harus bisa menang atas setelan OS -- lihat
  // src/store/themeStore.js.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },

        // Warna semantik: nilainya datang dari CSS variable di index.css,
        // jadi satu nama kelas berlaku untuk terang maupun gelap. Ditulis
        // sebagai kanal RGB terpisah supaya penanda opacity Tailwind
        // (mis. bg-surface/75) tetap bekerja.
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--c-surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--c-surface-3) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        'line-strong': 'rgb(var(--c-line-strong) / <alpha-value>)',
        strong: 'rgb(var(--c-strong) / <alpha-value>)',
        body: 'rgb(var(--c-body) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',

        // Tombol berkontras tinggi. Di mode terang hampir hitam, di mode
        // gelap justru terang -- kalau dibiarkan gray-900, tombolnya lenyap
        // ke latar begitu mode gelap dinyalakan.
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        'on-ink': 'rgb(var(--c-on-ink) / <alpha-value>)',
      },
      fontFamily: {
        // Inter, disamakan dengan berkas rancangan yang jadi rujukan.
        // Dirancang khusus untuk antarmuka layar: tinggi-x besar sehingga
        // teks kecil tetap terbaca, dan angkanya rapat sehingga kolom jam
        // terbaca tenang.
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        glow: 'var(--shadow-glow)',
        glass: 'var(--shadow-glass)',
      },
    },
  },
  plugins: [],
};
