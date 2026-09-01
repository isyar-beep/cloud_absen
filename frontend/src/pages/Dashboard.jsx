import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import StatusBadge from '../components/StatusBadge';
import AvatarUploader from '../components/AvatarUploader';
import {
  CameraIcon, CalendarIcon, ClockIcon, ChartIcon, CheckBadgeIcon, LogoutIcon,
  SunIcon, MoonIcon,
} from '../components/Icons';
import { useThemeStore } from '../store/themeStore';
import UbahPasswordModal from '../components/UbahPasswordModal';
import { tanggalLokal, formatJam } from '../utils/tanggal';
import { useGrafikTema } from '../utils/grafik';

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const { gelap, setTema } = useThemeStore();
  const grafik = useGrafikTema();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [history, setHistory] = useState([]);
  const [profile, setProfile] = useState(null);
  const [ubahPassword, setUbahPassword] = useState(false);
  const [pesan, setPesan] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [statsRes, trendRes, historyRes, profileRes] = await Promise.all([
        api.get('/stats/me'),
        api.get('/stats/me/trend'),
        api.get('/attendance/history?limit=5'),
        api.get('/auth/me'),
      ]);
      setStats(statsRes.data);
      setProfile(profileRes.data);
      setTrend(
        trendRes.data.map((d) => ({
          date: tanggalLokal(d.date).getDate(),
          jam: d.work_hours ? Number(d.work_hours).toFixed(1) : 0,
        }))
      );
      setHistory(historyRes.data);
    } catch (err) {
      console.error(err);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const tanggalHariIni = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const statCards = stats
    ? [
        { label: 'Total Hadir', value: `${stats.total_hadir} hari`, icon: CheckBadgeIcon, chip: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
        { label: 'Tingkat Kehadiran', value: `${stats.attendance_rate}%`, icon: ChartIcon, chip: 'bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400' },
        { label: 'Terlambat', value: `${stats.total_terlambat} kali`, icon: ClockIcon, chip: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400' },
        { label: 'Rata-rata Kerja', value: `${stats.avg_work_hours} jam`, icon: CalendarIcon, chip: 'bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400' },
      ]
    : [];

  return (
    <div className="min-h-screen">
      {/* Hero header dengan gradien */}
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800 pb-20">
        <div className="max-w-2xl mx-auto px-4 pt-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-primary-100">{tanggalHariIni}</p>
              <p className="text-xl font-bold text-white mt-0.5">Halo, {user?.name} 👋</p>
              {profile?.shift_name && (
                <p className="text-xs text-primary-100/90 mt-1">
                  {profile.shift_name} · {profile.shift_start}–{profile.shift_end}
                </p>
              )}
              {/* Satu pegawai hanya aktif di satu proyek, jadi tidak ada yang
                  perlu dipilih saat absen — namanya cukup ditampilkan supaya
                  pegawai tahu kehadirannya tercatat untuk pekerjaan yang mana. */}
              {profile?.project_name && (
                <p className="text-xs text-primary-100/75 mt-0.5">
                  {profile.project_name}
                  {profile.project_location ? ` · ${profile.project_location}` : ''}
                </p>
              )}
              <div className="mt-4">
                <AvatarUploader
                  name={user?.name}
                  src={profile?.avatar_url}
                  onChange={(url) => setProfile((p) => ({ ...p, avatar_url: url }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1 shrink-0">
              {/* Gaya sendiri, bukan komponen ThemeToggle: di atas hero biru,
                  token permukaan terang/gelap sama-sama tidak terbaca. */}
              <button
                onClick={() => setTema(gelap ? 'terang' : 'gelap')}
                title={gelap ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
                aria-label={gelap ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
                className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white transition flex items-center justify-center"
              >
                {gelap ? <SunIcon className="w-[18px] h-[18px]" /> : <MoonIcon className="w-[18px] h-[18px]" />}
              </button>
              <button
                onClick={handleLogout}
                title="Keluar"
                className="w-9 h-9 rounded-xl text-primary-100 hover:text-white hover:bg-white/15 transition flex items-center justify-center"
              >
                <LogoutIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-14 pb-10">
        {/* Aksi utama */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => navigate('/attendance')}
            className="col-span-2 flex items-center justify-center gap-2.5 bg-surface/75 backdrop-blur-xl text-primary-700 dark:text-primary-300 py-4 rounded-2xl font-semibold shadow-soft border border-primary-100 dark:border-primary-500/30 transition hover:shadow-glow hover:border-primary-300 active:scale-[0.99]"
          >
            <span className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center">
              <CameraIcon className="w-5 h-5" />
            </span>
            Absen Sekarang
          </button>
          <button
            onClick={() => navigate('/leaves')}
            className="bg-surface/80 backdrop-blur-xl border border-line text-body py-3 rounded-2xl text-sm font-medium shadow-soft transition hover:bg-surface/90 hover:border-line-strong"
          >
            Ajukan Izin
          </button>
          <button
            onClick={() => navigate('/history')}
            className="bg-surface/80 backdrop-blur-xl border border-line text-body py-3 rounded-2xl text-sm font-medium shadow-soft transition hover:bg-surface/90 hover:border-line-strong"
          >
            Riwayat Lengkap
          </button>
          <button
            onClick={() => setUbahPassword(true)}
            className="col-span-2 bg-surface/80 backdrop-blur-xl border border-line text-body py-3 rounded-2xl text-sm font-medium shadow-soft transition hover:bg-surface/90 hover:border-line-strong"
          >
            Ubah Password
          </button>
        </div>

        {pesan && (
          <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/30 rounded-xl px-4 py-3 mb-5 font-medium">
            ✓ {pesan}
          </div>
        )}

        {/* KPI Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {statCards.map((card) => (
              <div key={card.label} className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft p-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.chip}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <p className="text-xs text-muted">{card.label}</p>
                <p className="text-lg font-bold text-strong mt-0.5">{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Absen pulang yang tidak pernah terisi.
            Muncul hanya kalau ada -- kotak yang selamanya menampilkan angka 0
            cuma memakan ruang tanpa memberi tahu apa pun. Sengaja di luar
            kisi statistik: ini bukan capaian yang diukur, melainkan pekerjaan
            yang menunggu diselesaikan, jadi diberi jalan keluarnya sekalian. */}
        {stats?.total_tidak_lengkap > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl px-4 py-3.5 mb-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {stats.total_tidak_lengkap} hari tanpa absen pulang
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                Kehadiran Anda tetap terhitung. Ajukan koreksi bila jam pulangnya perlu dilengkapi.
              </p>
            </div>
            <button
              onClick={() => navigate('/history')}
              className="text-xs font-semibold text-amber-800 dark:text-amber-200 underline underline-offset-2 shrink-0"
            >
              Lihat riwayat
            </button>
          </div>
        )}

        {/* Trend Chart */}
        {trend.length > 0 && (
          <div className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft p-5 mb-5">
            <p className="text-sm font-semibold text-strong mb-4">Jam Kerja 30 Hari Terakhir</p>
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={trend} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="jamKerja" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={grafik.isiGradienAtas} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={grafik.isiGradienAtas} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" fontSize={11} stroke={grafik.sumbu} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} stroke={grafik.sumbu} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={grafik.tooltip} cursor={grafik.kursor} />
                <Area
                  type="monotone" dataKey="jam" stroke={grafik.garisUtama} strokeWidth={2.5}
                  fill="url(#jamKerja)" dot={false} activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Riwayat terbaru */}
        <div className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft overflow-hidden">
          <div className="flex justify-between items-center px-5 pt-4 pb-2">
            <p className="text-sm font-semibold text-strong">Riwayat Terbaru</p>
            <button
              onClick={() => navigate('/history')}
              className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-700 dark:hover:text-primary-300 dark:text-primary-300 transition"
            >
              Lihat Semua →
            </button>
          </div>
          {history.map((item) => (
            <div key={item.id} className="flex justify-between items-center px-5 py-3.5 border-t border-line hover:bg-surface-2/60 transition">
              <div>
                <p className="text-sm font-medium text-strong">
                  {tanggalLokal(item.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <p className="text-xs text-faint mt-0.5">
                  {item.check_in_time
                    ? `Masuk ${formatJam(item.check_in_time)}`
                    : 'Tidak ada jam masuk'}
                </p>
              </div>
              <StatusBadge status={item.status} kurang={item.kurang} />
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-sm text-faint px-5 py-8 text-center">Belum ada riwayat absensi.</p>
          )}
        </div>
      </div>

      {ubahPassword && (
        <UbahPasswordModal
          onTutup={() => setUbahPassword(false)}
          onSelesai={(msg) => {
            setUbahPassword(false);
            setPesan(msg);
          }}
        />
      )}
    </div>
  );
}
