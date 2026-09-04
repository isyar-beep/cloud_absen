import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { BellIcon } from './Icons';
import { formatTanggalSingkat, jamLokal } from '../utils/tanggal';

// ============================================================
// Lonceng pemberitahuan.
//
// Admin dan konsultan bekerja di web, dan push Expo tidak sampai ke sana.
// Jadi bagi mereka INILAH satu-satunya cara mengetahui ada pengajuan masuk
// tanpa harus membuka menunya satu per satu untuk mengecek.
//
// Disegarkan berkala, bukan lewat sambungan langsung: pemberitahuan di
// sini tidak menuntut ketepatan detik, sementara WebSocket menambah satu
// bagian lagi yang harus dijaga hidup di VPS. Selang 60 detik sudah cukup
// untuk pekerjaan yang satuannya jam.
// ============================================================

const SELANG_SEGARKAN = 60000;
const SEHALAMAN = 20;
const TINGGI_KEPALA = 49; // baris judul "Pemberitahuan" + garis bawahnya

// "3 menit lalu", "2 jam lalu", lalu berganti tanggal. Bentuk relatif hanya
// berguna untuk yang baru; untuk yang lampau, tanggal jauh lebih menolong.
function usia(waktu) {
  const detik = Math.floor((Date.now() - jamLokal(waktu).getTime()) / 1000);
  if (detik < 60) return 'baru saja';
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  return formatTanggalSingkat(waktu);
}

// arah="atas" untuk tombol yang duduk di dasar layar; bawaannya turun.
export default function Lonceng({ arah = 'bawah' }) {
  const [buka, setBuka] = useState(false);
  const [items, setItems] = useState([]);
  const [belum, setBelum] = useState(0);
  const [adaLagi, setAdaLagi] = useState(false);
  const [posisi, setPosisi] = useState(null);
  const navigate = useNavigate();
  const akarRef = useRef(null);
  const panelRef = useRef(null);

  const LEBAR_PANEL = 304; // 19rem
  const SELA = 12;

  // Panelnya digambar lewat portal dengan posisi tetap, bukan sebagai anak
  // tombolnya. Sidebar melayang punya sudut membulat dan lebar terbatas,
  // jadi panel biasa terpotong di tepinya -- terbukti saat diuji: "Tandai
  // semua dibaca" tampil sebagai "Tandai s". Portal melepaskannya dari
  // wadah itu; posisinya dihitung dari letak tombol.
  const hitungPosisi = useCallback(() => {
    const el = akarRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Panelnya digeser MELEWATI sidebar, bukan sekadar disejajarkan dengan
    // tombolnya. Tombol ini duduk di dalam sidebar, jadi panel yang lurus
    // di atasnya akan menutupi menu navigasi -- persis keluhan yang
    // membuat loncengnya dipindah ke sini.
    //
    // Yang dicari adalah <aside> terdekat: baik sidebar melayang di layar
    // lebar maupun laci di layar sempit sama-sama <aside>, jadi satu aturan
    // ini melayani keduanya tanpa perlu tahu sedang di tata letak mana.
    const wadah = el.closest('aside');
    const kiriDiinginkan = wadah ? wadah.getBoundingClientRect().right + SELA : r.left;

    // Tetap dijepit ke dalam layar. Di layar sempit laci hampir selebar
    // jendela, jadi panel tidak mungkin benar-benar lolos darinya -- lebih
    // baik menimpanya sedikit daripada tergunting di tepi jendela.
    const left = Math.max(SELA, Math.min(kiriDiinginkan, window.innerWidth - LEBAR_PANEL - SELA));

    // Ruang yang benar-benar tersedia di tiap arah, diukur bukan dikira.
    // Arah yang diminta hanya dituruti kalau ruangnya memang cukup; kalau
    // tidak, panel dibalik ke sisi yang lebih lapang. Tanpa pemeriksaan
    // ini, sidebar pendek di layar 768px membuat panel ke atas terpotong
    // di tepi jendela.
    const ruangAtas = r.top - SELA * 2;
    const ruangBawah = window.innerHeight - r.bottom - SELA * 2;
    const keAtas = arah === 'atas' ? ruangAtas > 220 || ruangAtas >= ruangBawah : false;

    setPosisi({
      left,
      keAtas,
      top: keAtas ? undefined : r.bottom + 8,
      bawah: keAtas ? window.innerHeight - r.top + 8 : undefined,
      maks: keAtas ? ruangAtas : ruangBawah,
    });
  }, [arah]);

  useLayoutEffect(() => {
    if (buka) hitungPosisi();
  }, [buka, hitungPosisi]);

  const muat = useCallback(async (offset = 0, tambah = false) => {
    try {
      const res = await api.get('/notifications/saya', { params: { limit: SEHALAMAN, offset } });
      setItems((d) => (tambah ? [...d, ...res.data.items] : res.data.items));
      setAdaLagi(res.data.ada_lagi);
      setBelum(res.data.belum_dibaca);
    } catch {
      // Diam saja. Lonceng yang gagal memuat tidak boleh memunculkan pesan
      // galat di layar -- ia bukan isi utama halaman, dan pesan galat untuk
      // sesuatu yang tidak diminta pemakainya hanya mengganggu.
    }
  }, []);

  // Penyegaran berkala DIHENTIKAN selagi panelnya terbuka. Dua sebabnya:
  // penyegaran selalu kembali ke halaman pertama, jadi halaman tambahan
  // yang sudah dimuat akan lenyap di tengah orang membacanya; dan daftar
  // yang berubah sendiri di bawah kursor membuat salah klik.
  const bukaRef = useRef(false);
  bukaRef.current = buka;

  useEffect(() => {
    muat();
    const t = setInterval(() => { if (!bukaRef.current) muat(); }, SELANG_SEGARKAN);
    return () => clearInterval(t);
  }, [muat]);

  // Klik di luar menutup panel. Panelnya kini di portal, jadi "di luar"
  // harus memeriksa panel DAN tombolnya -- kalau hanya tombolnya, mengklik
  // isi panel sendiri langsung menutupnya.
  useEffect(() => {
    if (!buka) return undefined;
    const diDalam = (t) => akarRef.current?.contains(t) || panelRef.current?.contains(t);
    const klik = (e) => { if (!diDalam(e.target)) setBuka(false); };
    const tekan = (e) => { if (e.key === 'Escape') setBuka(false); };
    // Gulungan di dalam daftar pemberitahuan tidak boleh menutup panelnya.
    const gulung = (e) => { if (!panelRef.current?.contains(e.target)) setBuka(false); };
    const tutup = () => setBuka(false);
    document.addEventListener('mousedown', klik);
    window.addEventListener('keydown', tekan);
    window.addEventListener('scroll', gulung, true);
    window.addEventListener('resize', tutup);
    return () => {
      document.removeEventListener('mousedown', klik);
      window.removeEventListener('keydown', tekan);
      window.removeEventListener('scroll', gulung, true);
      window.removeEventListener('resize', tutup);
    };
  }, [buka]);

  async function bukaItem(n) {
    setBuka(false);
    if (!n.dibaca) {
      // Ditandai di layar lebih dulu supaya terasa seketika; kalau
      // permintaannya gagal, penyegaran berikutnya mengembalikannya.
      setItems((d) => d.map((x) => (x.id === n.id ? { ...x, dibaca: true } : x)));
      setBelum((v) => Math.max(0, v - 1));
      api.put(`/notifications/${n.id}/baca`).catch(() => {});
    }
    if (n.tautan) navigate(n.tautan);
  }

  async function bacaSemua() {
    setItems((d) => d.map((x) => ({ ...x, dibaca: true })));
    setBelum(0);
    api.put('/notifications/baca-semua').catch(() => {});
  }

  return (
    <div className="relative" ref={akarRef}>
      <button
        onClick={() => setBuka((v) => !v)}
        aria-label={belum > 0 ? `Pemberitahuan, ${belum} belum dibaca` : 'Pemberitahuan'}
        aria-expanded={buka}
        className="relative w-9 h-9 rounded-xl border border-line bg-surface/70 text-muted transition hover:text-strong hover:border-line-strong flex items-center justify-center"
      >
        <BellIcon className="w-[18px] h-[18px]" />
        {belum > 0 && (
          // Angkanya ikut ditulis, bukan cuma titik: "ada sesuatu" dan "ada
          // tujuh sesuatu" menuntut tindakan yang berbeda.
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-surface">
            {belum > 9 ? '9+' : belum}
          </span>
        )}
      </button>

      {buka && posisi && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            left: posisi.left,
            top: posisi.top,
            bottom: posisi.bawah,
            width: LEBAR_PANEL,
          }}
          className="z-[60] kaca-pekat border border-line rounded-2xl shadow-glass overflow-hidden animate-[muncul_140ms_ease-out]"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line">
            <p className="text-sm font-bold text-strong">Pemberitahuan</p>
            {belum > 0 && (
              <button onClick={bacaSemua} className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* TINGGI_KEPALA dikurangkan karena `maks` mengukur ruang untuk
              SELURUH panel, sementara batas ini hanya mengatur daftarnya.
              Tanpa pengurangan itu, panel setinggi ruang penuh masih
              ditambah kepalanya, lalu menembus tepi jendela. */}
          <div className="overflow-y-auto" style={{ maxHeight: Math.max(120, Math.min(352, posisi.maks - TINGGI_KEPALA)) }}>
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => bukaItem(n)}
                className={`w-full text-left px-4 py-3 border-b border-line/60 last:border-b-0 transition hover:bg-surface-2/70 ${
                  n.dibaca ? '' : 'bg-primary-50/60 dark:bg-primary-500/10'
                }`}
              >
                <div className="flex items-start gap-2">
                  {/* Titik biru hanya pada yang belum dibaca. Tanpa penanda,
                      daftar yang sudah dibuka dan yang belum tampak sama. */}
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.dibaca ? 'bg-transparent' : 'bg-primary-500'}`} />
                  <div className="min-w-0">
                    <p className={`text-[13px] leading-snug ${n.dibaca ? 'text-body' : 'font-semibold text-strong'}`}>
                      {n.judul}
                    </p>
                    {n.pesan && <p className="text-xs text-muted mt-0.5 leading-snug">{n.pesan}</p>}
                    <p className="text-[11px] text-faint mt-1">{usia(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))}

            {items.length === 0 && (
              <p className="text-sm text-muted text-center px-6 py-10">
                Belum ada pemberitahuan.
              </p>
            )}

            {adaLagi && (
              <button
                onClick={() => muat(items.length, true)}
                className="w-full px-4 py-3 text-[12px] font-semibold text-primary-600 dark:text-primary-400 hover:bg-surface-2/70 transition"
              >
                Muat lebih banyak
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
