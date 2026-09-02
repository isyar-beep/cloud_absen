import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import Avatar from './Avatar';
import ThemeToggle from './ThemeToggle';
import {
  HomeIcon, BriefcaseIcon, ChartIcon, ClockIcon, PhotoIcon, DocumentIcon,
  UsersIcon, ClipboardIcon, CalendarIcon, LogoutIcon, MenuIcon, CloseIcon,
  PanelIcon,
} from './Icons';
import { namaPeran } from '../utils/peran';

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
    ],
  },
  {
    judul: 'Pengaturan',
    item: [
      { to: '/admin/users', label: 'Pengguna', icon: UsersIcon },
      { to: '/admin/shifts', label: 'Shift & WFA', icon: ClipboardIcon, admin: true },
      { to: '/admin/holidays', label: 'Hari Libur', icon: CalendarIcon, admin: true },
    ],
  },
];

function Isi({ user, aktifKah, onPindah, onKeluar, lipat = false, onLipat }) {
  return (
    <div className="flex flex-col h-full">
      {/* Identitas aplikasi + kendali tampilan.
          Tema dan lipat ditaruh di atas, sejajar logo: keduanya mengatur
          kerangka layar, bukan akun -- jadi tempatnya di kepala, bukan
          berdesakan di kartu pengguna paling bawah. */}
      <div className={`shrink-0 border-b border-line/70 ${lipat ? 'px-2 py-3' : 'px-4 py-3'}`}>
        {/* Identitas dan kendali diberi baris masing-masing. Dijejalkan
            sebaris, dua tombol ikon menyisakan ruang terlalu sempit dan
            nama aplikasinya terpotong jadi "Absensi Ko...". */}
        <div className={`flex items-center ${lipat ? 'justify-center' : 'gap-2.5'}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white text-sm font-bold flex items-center justify-center shadow-glow shrink-0">
            AK
          </div>
          {!lipat && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-strong truncate leading-tight">Absensi Konsultan</p>
              <p className="text-[11px] text-faint truncate">PERCIPKAR</p>
            </div>
          )}
        </div>

        <div className={`flex items-center gap-1.5 mt-2.5 ${lipat ? 'flex-col' : 'justify-end'}`}>
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
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
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
                <p className="px-2.5 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-faint">
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
                      className={`flex items-center h-10 rounded-xl text-sm transition ${
                        lipat ? 'justify-center px-0' : 'gap-3 px-2.5'
                      } ${
                        aktif
                          ? 'bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 font-semibold'
                          : 'text-body hover:bg-surface-2 hover:text-strong font-medium'
                      }`}
                    >
                      <item.icon className={`w-[18px] h-[18px] shrink-0 ${aktif ? '' : 'text-muted'}`} />
                      {!lipat && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Kartu pengguna: siapa yang sedang masuk, dan cara keluar. */}
      <div className="shrink-0 border-t border-line/70 p-3">
        <div className={`flex px-1.5 py-1.5 ${lipat ? 'flex-col items-center gap-2' : 'items-center gap-2.5'}`}>
          <Avatar name={user?.name} src={user?.avatar_url} size={34} />
          {!lipat && (
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-strong truncate leading-tight">{user?.name}</p>
              <p className="text-[11px] text-faint truncate">{namaPeran(user?.role)}</p>
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
      </div>
    </div>
  );
}

export default function AdminSidebar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [buka, setBuka] = useState(false);

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
    document.documentElement.style.setProperty('--lebar-sidebar', lipat ? '4.5rem' : '16rem');
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
      {/* Layar lebar: sidebar tetap */}
      <aside
        className="hidden lg:block fixed inset-y-0 left-0 kaca-pekat border-r border-line/70 z-30 transition-[width] duration-200"
        style={{ width: 'var(--lebar-sidebar)' }}
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
          <p className="text-sm font-semibold text-strong truncate">Absensi Konsultan</p>
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
