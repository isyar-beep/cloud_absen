import { useThemeStore } from '../store/themeStore';
import { SunIcon, MoonIcon } from './Icons';

const PILIHAN = [
  { key: 'terang', label: 'Terang' },
  { key: 'sistem', label: 'Sistem' },
  { key: 'gelap', label: 'Gelap' },
];

// Pemilih tema tiga posisi.
//
// Sengaja bukan sakelar dua posisi: tanpa opsi "Sistem", pengguna yang
// laptopnya berpindah terang/gelap mengikuti jam tidak punya cara
// menyatakan "ikuti saja setelan saya".
//
// `ringkas` dipakai di bilah admin yang ruangnya sempit -- di situ yang
// tampil hanya satu tombol yang berputar antara ketiga pilihan.
export default function ThemeToggle({ ringkas = false }) {
  const { pilihan, gelap, setTema } = useThemeStore();

  if (ringkas) {
    const berikutnya = PILIHAN[(PILIHAN.findIndex((p) => p.key === pilihan) + 1) % PILIHAN.length];
    return (
      <button
        onClick={() => setTema(berikutnya.key)}
        title={`Tema: ${PILIHAN.find((p) => p.key === pilihan)?.label}. Klik untuk ${berikutnya.label}.`}
        aria-label={`Ganti tema ke ${berikutnya.label}`}
        className="relative w-9 h-9 rounded-xl border border-line bg-surface/70 backdrop-blur text-muted transition hover:text-strong hover:border-line-strong flex items-center justify-center"
      >
        {gelap ? <MoonIcon className="w-[18px] h-[18px]" /> : <SunIcon className="w-[18px] h-[18px]" />}
        {pilihan === 'sistem' && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary-500 ring-2 ring-canvas"
            title="Mengikuti setelan sistem"
          />
        )}
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema tampilan"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-xl border border-line bg-surface/60 backdrop-blur"
    >
      {PILIHAN.map((p) => (
        <button
          key={p.key}
          role="radio"
          aria-checked={pilihan === p.key}
          onClick={() => setTema(p.key)}
          className={`text-xs font-semibold px-2.5 py-1.5 rounded-[10px] transition ${
            pilihan === p.key
              ? 'bg-primary-600 text-white shadow-glow'
              : 'text-muted hover:text-strong'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
