import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Avatar from './Avatar';
import ThemeToggle from './ThemeToggle';
import {
  HomeIcon, BriefcaseIcon, ChartIcon, ClockIcon, PhotoIcon, DocumentIcon,
  UsersIcon, ClipboardIcon, CalendarIcon, LogoutIcon, MenuIcon, CloseIcon,
  PanelIcon, BellIcon, BookIcon,
} from './Icons';
import { namaPeran } from '../utils/peran';
import { useNotifStore, SELANG_SEGARKAN } from '../store/notifStore';

// Menu dikelompokkan menurut cara orang memakainya, bukan menurut urutan
// pembuatannya: yang dilihat tiap hari di atas, yang disiapkan sesekali di
// bawah. Tanpa pengelompokan, sepuluh baris menu jadi daftar datar yang
// harus dibaca satu per satu setiap kali.
//
// `admin: true` menandai menu yang hanya boleh dilihat dinas. Konsultan
// memantau dan menyetujui, tapi tidak menyusun proyek, shift, hari libur,
// maupun daftar personel -- itu bagian dari kontrak, bukan operasional.
const KELOMPOK = [
  {
    judul: 'Pemantauan',
    item: [
      { to: '/admin', label: 'Dashboard', icon: HomeIcon, tepat: true },
      { to: '/admin/projects', label: 'Proyek', icon: BriefcaseIcon },
      { to: '/admin/stats', label: 'Statistik', icon: ChartIcon },
    ],
  },
  {
    judul: 'Bukti & Pengajuan',
    item: [
      { to: '/admin/history', label: 'Riwayat', icon: ClockIcon },
      { to: '/admin/gallery', label: 'Galeri Foto', icon: PhotoIcon },
      { to: '/admin/leaves', label: 'Pengajuan', icon: DocumentIcon },
      // Ditempatkan sekelompok dengan Pengajuan, karena hampir seluruh
      // pemberitahuan memang mengabarkan pengajuan yang masuk atau
      // diputus. `lencana` menandai menu yang menampilkan angka.
      { to: '/admin/notifications', label: 'Pemberitahuan', icon: BellIcon, lencana: true },
    ],
  },
  {
    judul: 'Pengaturan',
    item: [
      { to: '/admin/users', label: 'Pengguna', icon: UsersIcon },
      { to: '/admin/shifts', label: 'Shift & WFA', icon: ClipboardIcon, admin: true },
      { to: '/admin/holidays', label: 'Hari Libur', icon: CalendarIcon, admin: true },
      { to: '/panduan', label: 'Petunjuk', icon: BookIcon },
    ],
  },
];

// Ditanam saat build dari package.json -- lihat vite.config.js.
const VERSI = typeof __VERSI_APLIKASI__ !== 'undefined' ? __VERSI_APLIKASI__ : '';

function Isi({ user, aktifKah, onPindah, onKeluar, lipat = false, onLipat }) {
  const belum = useNotifStore((s) => s.belum);

  return (
    <div className="flex flex-col h-full">
      {/* Identitas aplikasi + kendali tampilan.
          Tema dan lipat ditaruh di atas, sejajar logo: keduanya mengatur
          kerangka layar, bukan akun -- jadi tempatnya di kepala, bukan
          berdesakan di kartu pengguna paling bawah. */}
      <div className={`shrink-0 ${lipat ? 'px-2 pt-4 pb-3' : 'px-5 pt-5 pb-3'}`}>
        {/* Identitas dan kendali diberi baris masing-masing. Dijejalkan
            sebaris, dua tombol ikon menyisakan ruang terlalu sempit dan
            nama aplikasinya terpotong jadi "Absensi Ko...". */}
        <div className={`flex items-center ${lipat ? 'justify-center' : 'gap-3'}`}>
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 text-white text-base font-extrabold flex items-center justify-center shadow-glow shrink-0">
            AK
          </div>
          {!lipat && (
            <div className="min-w-0">
              <p className="text-[17px] font-extrabold text-strong truncate leading-tight tracking-[-0.02em]">Absensi Konsultan</p>
              <p className="text-[11px] text-faint truncate tracking-[0.1em] mt-0.5">PERCIPKAR</p>
            </div>
          )}
        </div>

        {/* Hanya kendali TAMPILAN di sini: tema dan lipat. Pemberitahuan
            sempat ikut sebagai lonceng, tapi keliru dua kali -- ia bukan
            pengatur tampilan, dan panel gantungnya menimpa menu di
            bawahnya. Sekarang ia menjadi menu tersendiri. */}
        <div className={`flex items-center gap-1.5 mt-2.5 ${lipat ? 'flex-col' : 'justify-start'}`}>
          <ThemeToggle ringkas />
          {onLipat && (
            <button
              onClick={onLipat}
              title={lipat ? 'Tampilkan menu' : 'Sembunyikan menu'}
              aria-label={lipat ? 'Tampilkan menu' : 'Sembunyikan menu'}
              aria-expanded={!lipat}
              className="hidden lg:flex w-9 h-9 rounded-xl border border-line bg-surface/70 text-muted transition hover:text-strong hover:border-line-strong items-center justify-center"
            >
              <PanelIcon className="w-[18px] h-[18px]" />
            </button>
          )}
        </div>
      </div>

      {/* Menu */}
      {/* Jaraknya dirapatkan saat terlipat. Dengan 9 menu dalam 3 kelompok,
          setelan longgar membuat menu terakhir terpotong di layar laptop
          1366x768 -- masih bisa digulir, tapi yang terpotong terbaca sebagai
          cacat, bukan sebagai daftar panjang. Diukur, bukan dikira-kira. */}
      <nav className={`flex-1 overflow-y-auto px-3 py-3 ${lipat ? 'space-y-3' : 'space-y-4'}`}>
        {KELOMPOK.map((kelompok) => {
          const terlihat = kelompok.item.filter((i) => !i.admin || user?.role === 'admin');
          if (terlihat.length === 0) return null;
          return (
            <div key={kelompok.judul}>
              {lipat ? (
                // Saat terlipat, judul kelompok diganti garis pemisah: ruangnya
                // tidak cukup untuk teks, tapi pengelompokannya tetap terbaca.
                <div className="h-px bg-line/70 mx-2 mb-2" aria-hidden="true" />
              ) : (
                <p className="px-3.5 mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.13em] text-faint">
                  {kelompok.judul}
                </p>
              )}
              <div className="space-y-0.5">
                {terlihat.map((item) => {
                  const aktif = aktifKah(item);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={onPindah}
                      aria-current={aktif ? 'page' : undefined}
                      title={lipat ? item.label : undefined}
                      className={`flex items-center rounded-2xl text-[15px] transition duration-200 ${
                        lipat ? 'h-10 justify-center px-0' : 'h-11 gap-3 px-3.5'
                      } ${
                        aktif
                          // Putih pekat, bukan biru muda. Di atas sidebar
                          // kaca, permukaan putihlah yang terbaca "terangkat";
                          // blok biru justru menempel rata seperti stiker.
                          ? 'bg-white/75 dark:bg-white/10 text-primary-700 dark:text-primary-300 font-bold shadow-soft'
                          : 'text-body hover:bg-white/45 dark:hover:bg-white/[0.06] hover:text-strong font-semibold lg:hover:translate-x-1'
                      }`}
                    >
                      {/* Saat terlipat, angkanya menempel di sudut ikon --
                          satu-satunya tempat yang tersisa. Saat terbentang,
                          ia berdiri sendiri di ujung kanan baris supaya
                          tidak menindih label menunya. */}
                      <span className="relative shrink-0">
                        <item.icon className={`w-[18px] h-[18px] ${aktif ? '' : 'text-muted'}`} />
                        {item.lencana && belum > 0 && lipat && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center">
                            {belum > 9 ? '9+' : belum}
                          </span>
                        )}
                      </span>
                      {!lipat && <span className="truncate">{item.label}</span>}
                      {item.lencana && belum > 0 && !lipat && (
                        <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                          {belum > 99 ? '99+' : belum}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Kartu pengguna: siapa yang sedang masuk, dan cara keluar.
          Diberi permukaan sendiri supaya terbaca sebagai satu kesatuan yang
          menetap di dasar, bukan baris terakhir yang menggantung. */}
      <div className={`shrink-0 ${lipat ? 'p-2' : 'p-3'}`}>
        <div className={`flex rounded-2xl bg-white/45 dark:bg-white/[0.06] border border-white/50 dark:border-white/10 ${
          lipat ? 'flex-col items-center gap-2 p-2' : 'items-center gap-2.5 p-2.5'
        }`}>
          <Avatar name={user?.name} src={user?.avatar_url} size={34} />
          {!lipat && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-strong truncate leading-tight">{user?.name}</p>
              <p className="text-xs text-faint truncate">{namaPeran(user?.role)}</p>
            </div>
          )}
          <button
            onClick={onKeluar}
            title="Keluar"
            aria-label="Keluar"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-red-600 dark:hover:text-red-400 hover:bg-surface-2 transition shrink-0"
          >
            <LogoutIcon className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Versi ditampilkan supaya laporan masalah bisa menyebut versi
            mana yang sedang dipakai. Tanpa itu, "sudah saya coba dan
            tetap begitu" tidak bisa dipastikan menunjuk kode yang sama. */}
        {!lipat && VERSI && (
          <p className="text-[10px] text-faint text-center mt-2 tracking-wide">v{VERSI}</p>
        )}
      </div>
    </div>
  );
}

export default function AdminSidebar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [buka, setBuka] = useState(false);
  const segarkanNotif = useNotifStore((s) => s.segarkan);

  // Angka di menu disegarkan dari SINI, bukan dari <Isi>. Isi digambar dua
  // kali -- sekali untuk sidebar layar lebar, sekali untuk laci layar
  // sempit -- jadi memasang selangnya di sana berarti dua penghitung
  // waktu dan dua kali permintaan tiap menit untuk satu angka yang sama.
  useEffect(() => {
    segarkanNotif();
    const t = setInterval(segarkanNotif, SELANG_SEGARKAN);
    return () => clearInterval(t);
  }, [segarkanNotif]);

  // Pilihan melipat diingat per perangkat: orang yang bekerja di layar
  // sempit biasanya ingin menu tetap ringkas setiap kali membuka aplikasi,
  // dan memintanya melipat ulang tiap kali terasa seperti aplikasi lupa.
  const [lipat, setLipat] = useState(() => {
    try {
      return localStorage.getItem('sidebar_lipat') === '1';
    } catch {
      return false;
    }
  });

  // Lebar diumumkan lewat variabel CSS supaya isi halaman ikut bergeser.
  // Sidebar yang menentukan angkanya, halaman tinggal mengikuti -- tanpa
  // satu sumber, keduanya bisa berselisih dan menyisakan lajur kosong.
  useEffect(() => {
    // Angka ini ruang TOTAL yang dipesan, sudah termasuk sela melayangnya.
    // Kartu sidebar sendiri selebar angka ini dikurangi --sela-sidebar.
    document.documentElement.style.setProperty('--lebar-sidebar', lipat ? '5.25rem' : '18rem');
    try {
      localStorage.setItem('sidebar_lipat', lipat ? '1' : '0');
    } catch {
      // Penyimpanan diblokir (mode privat): pilihannya tetap berlaku
      // sepanjang sesi ini, cuma tidak diingat lain kali.
    }
  }, [lipat]);

  const toggleLipat = useCallback(() => setLipat((v) => !v), []);

  // Laci ditutup tiap kali halaman berpindah. Tanpa ini, di HP laci tetap
  // menutupi halaman yang baru saja dibuka.
  useEffect(() => { setBuka(false); }, [location.pathname]);

  // Esc menutup laci: kebiasaan yang diharapkan dari panel yang menimpa layar.
  useEffect(() => {
    if (!buka) return undefined;
    const tekan = (e) => { if (e.key === 'Escape') setBuka(false); };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [buka]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // Dashboard cocok persis; menu lain cocok berikut sub-halamannya.
  // Tanpa `tepat`, "/admin" akan tampak aktif di semua halaman admin.
  const aktifKah = (item) =>
    item.tepat ? location.pathname === item.to : location.pathname.startsWith(item.to);

  // Laci di layar sempit selalu tampil penuh: di sana ruangnya memang
  // sedang dipinjam seluruh layar, jadi melipatnya tidak ada gunanya.
  const isiLebar = (
    <Isi
      user={user} aktifKah={aktifKah} onPindah={() => setBuka(false)}
      onKeluar={handleLogout} lipat={lipat} onLipat={toggleLipat}
    />
  );
  const isiLaci = (
    <Isi user={user} aktifKah={aktifKah} onPindah={() => setBuka(false)} onKeluar={handleLogout} />
  );

  return (
    <>
      {/* Layar lebar: sidebar melayang.
          Kartunya sengaja lebih sempit daripada --lebar-sidebar, dan
          selisihnya persis --sela-sidebar. Dengan begitu ruang yang
          dipesan tetap --lebar-sidebar bulat, dan seluruh halaman yang
          memakai lg:pl-[var(--lebar-sidebar)] tetap sejajar tanpa perlu
          diubah satu per satu. */}
      <aside
        className="hidden lg:block fixed z-30 top-[var(--sela-sidebar)] bottom-[var(--sela-sidebar)] left-[var(--sela-sidebar)] kaca-samping rounded-[1.75rem] border border-white/60 dark:border-white/10 shadow-soft overflow-hidden transition-[width] duration-200"
        style={{ width: 'calc(var(--lebar-sidebar) - var(--sela-sidebar))' }}
      >
        {isiLebar}
      </aside>

      {/* Layar sempit: bilah atas + laci geser */}
      <header className="lg:hidden sticky top-0 z-30 kaca-pekat border-b border-line/70">
        <div className="h-14 px-3 flex items-center gap-3">
          <button
            onClick={() => setBuka(true)}
            aria-label="Buka menu"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-body hover:bg-surface-2 transition"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-white text-xs font-bold flex items-center justify-center">
            AK
          </div>
          <p className="text-[17px] font-bold text-strong tracking-[-0.01em] truncate">Absensi Konsultan</p>
        </div>
      </header>

      {buka && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            onClick={() => setBuka(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-[17rem] kaca-pekat border-r border-line shadow-2xl">
            <button
              onClick={() => setBuka(false)}
              aria-label="Tutup menu"
              className="absolute top-3.5 right-3 w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:bg-surface-2 transition z-10"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
            {isiLaci}
          </aside>
        </div>
      )}
    </>
  );
}
