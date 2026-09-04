import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// Versi diambil dari package.json dan ditanam saat build.
//
// Satu sumber, bukan angka yang ditulis ulang di layar. Nomor versi yang
// disalin ke dua tempat pasti berselisih cepat atau lambat -- dan versi
// yang salah lebih menyesatkan daripada tidak ada versi sama sekali,
// karena laporan masalah jadi menunjuk kode yang keliru.
const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  plugins: [react()],
  define: {
    __VERSI_APLIKASI__: JSON.stringify(version),
  },
  server: {
    port: 5173,
  },
});
