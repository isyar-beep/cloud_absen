import { create } from 'zustand';

const KUNCI = 'cloud_absen_tema';

// Tiga pilihan, bukan dua. "sistem" berarti mengikuti setelan OS dan ikut
// berubah kalau pengguna mengganti setelan itu di tengah pemakaian --
// perilaku yang hilang kalau kita hanya menyimpan 'terang' atau 'gelap'.
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function bacaTersimpan() {
  try {
    const nilai = localStorage.getItem(KUNCI);
    return nilai === 'terang' || nilai === 'gelap' || nilai === 'sistem' ? nilai : 'sistem';
  } catch {
    // Mode penyamaran atau localStorage diblokir: jangan sampai seluruh
    // aplikasi gagal dimuat hanya karena preferensi tampilan.
    return 'sistem';
  }
}

function gelapEfektif(pilihan) {
  return pilihan === 'gelap' || (pilihan === 'sistem' && media().matches);
}

function terapkan(pilihan, { animasi = true } = {}) {
  const akar = document.documentElement;
  const gelap = gelapEfektif(pilihan);

  if (animasi) {
    akar.classList.add('ganti-tema');
    window.setTimeout(() => akar.classList.remove('ganti-tema'), 260);
  }
  akar.classList.toggle('dark', gelap);
}

export const useThemeStore = create((set, get) => ({
  pilihan: bacaTersimpan(),
  gelap: gelapEfektif(bacaTersimpan()),

  setTema: (pilihan) => {
    try {
      localStorage.setItem(KUNCI, pilihan);
    } catch {
      // Preferensi tidak tersimpan, tapi tampilannya tetap berubah.
    }
    terapkan(pilihan);
    set({ pilihan, gelap: gelapEfektif(pilihan) });
  },

  // Dipanggil sekali dari App. Mengembalikan fungsi pembersih supaya
  // pendengar perubahan setelan OS ikut dilepas saat komponen dilepas.
  mulai: () => {
    terapkan(get().pilihan, { animasi: false });

    const mq = media();
    const dengar = () => {
      if (get().pilihan !== 'sistem') return;
      terapkan('sistem');
      set({ gelap: gelapEfektif('sistem') });
    };
    mq.addEventListener('change', dengar);
    return () => mq.removeEventListener('change', dengar);
  },
}));
