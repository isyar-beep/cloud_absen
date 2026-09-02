import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { AlertIcon } from './Icons';

// ============================================================
// Dialog konfirmasi & pemberitahuan bergaya aplikasi.
//
// Menggantikan window.confirm() dan window.alert(). Keduanya tidak bisa
// diberi gaya sama sekali -- browser menggambarnya sendiri, lengkap dengan
// baris "localhost:5173 says" di atasnya. Di tengah aplikasi yang sudah
// punya tema terang/gelap, kotak itu tampak seperti bagian dari program
// lain, dan justru muncul tepat pada saat yang paling penting: sebelum
// sesuatu dihapus.
//
// Dipasang sebagai provider, bukan komponen per halaman. Kalau tiap
// halaman harus mengingat untuk merender <Dialog />, cepat atau lambat
// ada halaman yang lupa -- dan kegagalannya baru terlihat saat tombolnya
// ditekan.
//
// Bentuk pemanggilannya sengaja dibuat menyerupai confirm() supaya sisi
// pemanggil hampir tidak berubah:
//
//   if (!await konfirmasi({ pesan: 'Hapus?' })) return;
// ============================================================

const KonteksDialog = createContext(null);

export function useDialog() {
  const konteks = useContext(KonteksDialog);
  if (!konteks) {
    throw new Error('useDialog dipakai di luar <PenyediaDialog>.');
  }
  return konteks;
}

function IsiDialog({ isi, onJawab }) {
  const tombolUtama = useRef(null);
  const bahaya = isi.jenis === 'bahaya';
  const konfirmasi = isi.mode === 'konfirmasi';

  useEffect(() => {
    // Fokus ke tombol utama supaya Enter langsung bekerja dan pembaca
    // layar mengumumkan pilihannya.
    tombolUtama.current?.focus();

    const tekan = (e) => {
      if (e.key === 'Escape') onJawab(false);
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [onJawab]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/55 dark:bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => onJawab(false)}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-judul"
        className="kaca-pekat border border-line rounded-2xl shadow-glass w-full max-w-sm overflow-hidden animate-[muncul_140ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start gap-3.5">
            <span
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                bahaya
                  ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400'
                  : 'bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400'
              }`}
            >
              <AlertIcon className="w-5 h-5" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p id="dialog-judul" className="text-sm font-bold text-strong">
                {isi.judul}
              </p>
              {isi.pesan && (
                // whitespace-pre-line supaya pesan berbaris ganda tetap
                // terbaca seperti saat ditulis, tanpa perlu markup.
                <p className="text-sm text-muted mt-1.5 whitespace-pre-line leading-relaxed">
                  {isi.pesan}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 bg-surface-2/70 border-t border-line">
          {konfirmasi && (
            <button
              type="button"
              onClick={() => onJawab(false)}
              className="text-sm font-semibold text-body px-4 py-2 rounded-xl border border-line transition hover:border-line-strong hover:text-strong"
            >
              {isi.tombolBatal}
            </button>
          )}
          <button
            ref={tombolUtama}
            type="button"
            onClick={() => onJawab(true)}
            className={`text-sm font-semibold px-4 py-2 rounded-xl text-white transition ${
              bahaya
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-primary-600 hover:bg-primary-700 shadow-glow'
            }`}
          >
            {isi.tombolYa}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PenyediaDialog({ children }) {
  const [isi, setIsi] = useState(null);
  const jawabRef = useRef(null);

  const buka = useCallback((opsi, mode) => new Promise((selesai) => {
    jawabRef.current = selesai;
    setIsi({
      mode,
      jenis: opsi.jenis || (mode === 'konfirmasi' ? 'bahaya' : 'info'),
      judul: opsi.judul || (mode === 'konfirmasi' ? 'Konfirmasi' : 'Pemberitahuan'),
      pesan: opsi.pesan || '',
      tombolYa: opsi.tombolYa || (mode === 'konfirmasi' ? 'Ya, lanjutkan' : 'Mengerti'),
      tombolBatal: opsi.tombolBatal || 'Batal',
    });
  }), []);

  const jawab = useCallback((hasil) => {
    setIsi(null);
    jawabRef.current?.(hasil);
    jawabRef.current = null;
  }, []);

  // Pengganti confirm(): mengembalikan Promise<boolean>.
  const konfirmasi = useCallback((opsi) => buka(opsi, 'konfirmasi'), [buka]);

  // Pengganti alert(): mengembalikan Promise yang selesai saat ditutup.
  const beritahu = useCallback((opsi) => buka(opsi, 'beritahu'), [buka]);

  return (
    <KonteksDialog.Provider value={{ konfirmasi, beritahu }}>
      {children}
      {isi && <IsiDialog isi={isi} onJawab={jawab} />}
    </KonteksDialog.Provider>
  );
}
