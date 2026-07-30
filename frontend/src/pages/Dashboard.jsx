import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import StatusBadge from '../components/StatusBadge';
import {
  CameraIcon, CalendarIcon, ClockIcon, ChartIcon, CheckBadgeIcon, LogoutIcon,
} from '../components/Icons';

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [statsRes, trendRes, historyRes] = await Promise.all([
        api.get('/stats/me'),
        api.get('/stats/me/trend'),
        api.get('/attendance/history?limit=5'),
      ]);
      setStats(statsRes.data);
      setTrend(
        trendRes.data.map((d) => ({
          date: new Date(d.date).getDate(),
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
        { label: 'Total Hadir', value: `${stats.total_hadir} hari`, icon: CheckBadgeIcon, chip: 'bg-emerald-50 text-emerald-600' },
        { label: 'Attendance Rate', value: `${stats.attendance_rate}%`, icon: ChartIcon, chip: 'bg-primary-50 text-primary-600' },
        { label: 'Terlambat', value: `${stats.total_terlambat} kali`, icon: ClockIcon, chip: 'bg-amber-50 text-amber-600' },
        { label: 'Rata-rata Kerja', value: `${stats.avg_work_hours} jam`, icon: CalendarIcon, chip: 'bg-violet-50 text-violet-600' },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero header dengan gradien */}
      <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800 pb-20">
        <div className="max-w-2xl mx-auto px-4 pt-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-primary-100">{tanggalHariIni}</p>
              <p className="text-xl font-bold text-white mt-0.5">Halo, {user?.name} 👋</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-primary-100 hover:text-white transition mt-1"
            >
              <LogoutIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-14 pb-10">
        {/* Aksi utama */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => navigate('/attendance')}
            className="col-span-2 flex items-center justify-center gap-2.5 bg-white text-primary-700 py-4 rounded-2xl font-semibold shadow-soft border border-primary-100 transition hover:shadow-glow hover:border-primary-300 active:scale-[0.99]"
          >
            <span className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center">
              <CameraIcon className="w-5 h-5" />
            </span>
            Absen Sekarang
          </button>
          <button
            onClick={() => navigate('/leaves')}
            className="bg-white/90 backdrop-blur border border-gray-200 text-gray-700 py-3 rounded-2xl text-sm font-medium shadow-soft transition hover:bg-white hover:border-gray-300"
          >
            Ajukan Izin
          </button>
          <button
            onClick={() => navigate('/history')}
            className="bg-white/90 backdrop-blur border border-gray-200 text-gray-700 py-3 rounded-2xl text-sm font-medium shadow-soft transition hover:bg-white hover:border-gray-300"
          >
            Riwayat Lengkap
          </button>
        </div>

        {/* KPI Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {statCards.map((card) => (
              <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.chip}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Trend Chart */}
        {trend.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 mb-5">
            <p className="text-sm font-semibold text-gray-900 mb-4">Jam Kerja 30 Hari Terakhir</p>
            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={trend} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="jamKerja" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" fontSize={11} stroke="#9ca3af" tickLine={false} axisLine={false} />
                <YAxis fontSize={11} stroke="#9ca3af" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12, border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 16px -4px rgb(0 0 0 / 0.1)', fontSize: 12,
                  }}
                />
                <Area
                  type="monotone" dataKey="jam" stroke="#2563eb" strokeWidth={2.5}
                  fill="url(#jamKerja)" dot={false} activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Riwayat terbaru */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          <div className="flex justify-between items-center px-5 pt-4 pb-2">
            <p className="text-sm font-semibold text-gray-900">Riwayat Terbaru</p>
            <button
              onClick={() => navigate('/history')}
              className="text-xs text-primary-600 font-semibold hover:text-primary-700 transition"
            >
              Lihat Semua →
            </button>
          </div>
          {history.map((item) => (
            <div key={item.id} className="flex justify-between items-center px-5 py-3.5 border-t border-gray-50 hover:bg-gray-50/60 transition">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(item.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {item.check_in_time
                    ? `Masuk ${new Date(item.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Tidak ada jam masuk'}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-sm text-gray-400 px-5 py-8 text-center">Belum ada riwayat absensi.</p>
          )}
        </div>
      </div>
    </div>
  );
}
