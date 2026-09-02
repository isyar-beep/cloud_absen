import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon, CheckIcon } from './Icons';

// ============================================================
// Daftar pilihan bergaya tema.
//
// Alasannya bukan selera. Daftar yang terbuka pada <select> bawaan
// digambar oleh sistem operasi, bukan oleh halaman -- warna, sudut,
// dan muka hurufnya tidak bisa disentuh CSS sama sekali. Jadi di
// tengah antarmuka kaca, satu-satunya bagian yang tampil sebagai
// kotak abu-abu Windows justru daftar ini. Menyamakannya dengan tema
// hanya mungkin dengan menggambar sendiri.
//
// Yang HARUS ikut dibawa saat mengganti <select> bawaan, karena
// semuanya gratis di sana dan hilang begitu digambar sendiri:
//   - papan ketik: panah atas/bawah, Enter, Escape, Home/End
//   - menutup saat diklik di luar, dan saat halaman digulung
//   - pembaca layar: peran combobox/listbox berikut penanda terpilih
//   - fokus kembali ke tombol setelah memilih
//
// Panelnya digambar lewat portal dengan posisi fixed. Kalau ia ikut
// di dalam kartu, kartu yang ber-overflow tersembunyi akan memotong
// daftarnya -- dan beberapa saringan kita memang duduk di kartu
// seperti itu.
// ============================================================

const TINGGI_PANEL = 288; // maks. tinggi daftar sebelum ia bisa digulung

export default function Pilihan({
  value,
  onChange,
  options = [],
  placeholder = 'Pilih…',
  className = '',
  ariaLabel,
  disabled = false,
  id,
}) {
  const [buka, setBuka] = useState(false);
  const [sorot, setSorotState] = useState(-1);
  const [posisi, setPosisi] = useState(null);
  const tombolRef = useRef(null);
  const panelRef = useRef(null);
  const idPanel = useId();

  // Sorotan disimpan GANDA: state untuk menggambar, ref untuk dibaca.
  // React menggabungkan pembaruan state dalam satu putaran kejadian, jadi
  // menekan panah lalu Enter dengan cepat membuat Enter masih membaca nilai
  // lama dan memilih baris yang salah. Terbukti saat diuji: panah-bawah lalu
  // Enter menghasilkan "September", bukan "Oktober". Ref selalu mutakhir
  // seketika, sehingga pilihannya tidak pernah meleset.
  const sorotRef = useRef(-1);
  const setSorot = useCallback((n) => {
    const nilai = typeof n === 'function' ? n(sorotRef.current) : n;
    sorotRef.current = nilai;
    setSorotState(nilai);
  }, []);

  const terpilih = options.findIndex((o) => String(o.value) === String(value));
  const label = terpilih >= 0 ? options[terpilih].label : placeholder;

  const hitungPosisi = useCallback(() => {
    const el = tombolRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Kalau ruang di bawah tidak cukup, panel dibalik ke atas tombol --
    // supaya pilihan terakhir tidak terpotong tepi layar.
    const ruangBawah = window.innerHeight - r.bottom;
    const keAtas = ruangBawah < Math.min(TINGGI_PANEL, options.length * 40 + 16) && r.top > ruangBawah;
    setPosisi({
      left: r.left,
      width: r.width,
      top: keAtas ? undefined : r.bottom + 6,
      bottom: keAtas ? window.innerHeight - r.top + 6 : undefined,
      maks: Math.min(TINGGI_PANEL, (keAtas ? r.top : ruangBawah) - 16),
      // Panel boleh lebih lebar daripada tombolnya, sampai batas tepi layar.
      // Kalau lebarnya dipaksa sama, pilihan panjang terpotong jadi
      // "Tanpa shift (0..." -- justru pada saat orang perlu membacanya untuk
      // memilih. Tombolnya boleh sempit; daftarnya tidak boleh.
      maksLebar: Math.max(r.width, window.innerWidth - r.left - 16),
    });
  }, [options.length]);

  useLayoutEffect(() => {
    if (buka) hitungPosisi();
  }, [buka, hitungPosisi]);

  // Menutup saat halaman digulung atau jendela diubah ukurannya. Sengaja
  // menutup, bukan mengikuti: panel melayang yang terus mengejar tombolnya
  // saat digulung justru terasa lepas dari halaman.
  useEffect(() => {
    if (!buka) return undefined;
    const gulung = (e) => {
      // Gulungan DI DALAM panel tidak boleh menutupnya. Pendengar ini
      // memakai fase capture supaya gulungan pada wadah mana pun tertangkap
      // (halaman bisa digulung oleh induk, bukan cuma jendela), dan itu
      // membuatnya ikut menangkap gulungan panelnya sendiri saat
      // scrollIntoView menarik sorotan ke dalam pandangan -- akibatnya
      // menelusuri dengan panah justru menutup daftarnya. Terbukti saat
      // diuji: panah-bawah lalu Enter tidak pernah berpindah pilihan.
      if (panelRef.current?.contains(e.target)) return;
      setBuka(false);
    };
    const tutup = () => setBuka(false);
    window.addEventListener('scroll', gulung, true);
    window.addEventListener('resize', tutup);
    return () => {
      window.removeEventListener('scroll', gulung, true);
      window.removeEventListener('resize', tutup);
    };
  }, [buka]);

  // Klik di luar tombol maupun panel menutup daftar.
  useEffect(() => {
    if (!buka) return undefined;
    const klik = (e) => {
      if (tombolRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setBuka(false);
    };
    document.addEventListener('mousedown', klik);
    return () => document.removeEventListener('mousedown', klik);
  }, [buka]);

  function pilih(i) {
    const o = options[i];
    if (!o) return;
    // Bentuk kejadiannya ditiru dari <select> supaya pemanggilnya tidak
    // perlu diubah: onChange((e) => e.target.value) tetap berlaku.
    onChange?.({ target: { value: o.value } });
    setBuka(false);
    tombolRef.current?.focus();
  }

  function tekan(e) {
    if (disabled) return;
    if (!buka) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        setSorot(terpilih >= 0 ? terpilih : 0);
        setBuka(true);
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setBuka(false); tombolRef.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSorot((i) => Math.min(options.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSorot((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setSorot(0); }
    else if (e.key === 'End') { e.preventDefault(); setSorot(options.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pilih(sorotRef.current); }
    else if (e.key === 'Tab') setBuka(false);
  }

  // Pilihan yang sedang disorot selalu ditarik ke dalam pandangan, supaya
  // menelusuri dengan panah tidak berhenti di daftar yang tampak diam.
  useEffect(() => {
    if (!buka || sorot < 0) return;
    panelRef.current?.querySelector(`[data-i="${sorot}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [buka, sorot]);

  return (
    <>
      <button
        type="button"
        id={id}
        ref={tombolRef}
        disabled={disabled}
        onClick={() => { if (!disabled) { setSorot(terpilih >= 0 ? terpilih : 0); setBuka((v) => !v); } }}
        onKeyDown={tekan}
        role="combobox"
        aria-expanded={buka}
        aria-haspopup="listbox"
        aria-controls={buka ? idPanel : undefined}
        aria-label={ariaLabel}
        className={`flex items-center justify-between gap-2 text-left transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <span className={`truncate ${terpilih >= 0 ? '' : 'text-faint'}`}>{label}</span>
        <ChevronDownIcon
          className={`w-4 h-4 shrink-0 text-muted transition-transform duration-200 ${buka ? 'rotate-180' : ''}`}
        />
      </button>

      {buka && posisi && createPortal(
        <div
          ref={panelRef}
          id={idPanel}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          style={{
            position: 'fixed',
            left: posisi.left,
            minWidth: posisi.width,
            width: 'max-content',
            maxWidth: posisi.maksLebar,
            top: posisi.top,
            bottom: posisi.bottom,
            maxHeight: posisi.maks,
            zIndex: 60,
          }}
          className="kaca-pekat border border-line rounded-2xl shadow-glass overflow-y-auto p-1.5 animate-[muncul_140ms_ease-out]"
        >
          {options.map((o, i) => {
            const aktif = String(o.value) === String(value);
            return (
              <div
                key={o.value}
                data-i={i}
                role="option"
                aria-selected={aktif}
                onMouseEnter={() => setSorot(i)}
                onClick={() => pilih(i)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer transition ${
                  i === sorot ? 'bg-primary-50 dark:bg-primary-500/15' : ''
                } ${aktif ? 'font-bold text-primary-700 dark:text-primary-300' : 'text-body'}`}
              >
                <span className="truncate flex-1">{o.label}</span>
                {aktif && <CheckIcon className="w-4 h-4 shrink-0" />}
              </div>
            );
          })}
          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-faint">Tidak ada pilihan.</p>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

// Gaya tombolnya dikumpulkan di sini supaya seluruh saringan di aplikasi
// tampil sama. Sebelumnya rangkaian kelas yang sama diketik ulang di tiap
// halaman, dan sekali ada yang berbeda satu angka, kotaknya tampak tidak
// sejajar tanpa ketahuan sebabnya.
// Lebarnya SENGAJA tidak ditentukan di sini: di petak saringan tiap kotak
// harus w-full, sedangkan di baris ekspor lebarnya ditetapkan per kotak.
// Memaksa w-full di sini membuat baris ekspor berantakan.
export const KELAS_PILIHAN =
  'px-3 py-2 bg-surface-2 border border-line rounded-xl text-sm '
  + 'backdrop-blur-xl hover:border-line-strong '
  + 'focus:outline-none focus:bg-surface/75 focus:ring-2 focus:ring-primary-500/40';
