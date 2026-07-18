import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

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

  const statusBadge = {
    hadir: 'bg-green-50 text-green-700',
    terlambat: 'bg-amber-50 text-amber-700',
    izin: 'bg-blue-50 text-blue-700',
    alpha: 'bg-red-50 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">Selamat datang,</p>
            <p className="font-semibold text-gray-900">{user?.name}</p>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-500">
            Keluar
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Tombol absen utama */}
        <button
          onClick={() => navigate('/attendance')}
          className="w-full bg-primary-600 text-white py-4 rounded-2xl font-medium mb-3 flex items-center justify-center gap-2"
        >
          Absen Sekarang
        </button>
        <button
          onClick={() => navigate('/leaves')}
          className="w-full bg-white border border-gray-300 text-gray-700 py-3 rounded-2xl text-sm font-medium mb-6"
        >
          Ajukan Izin
        </button>

        {/* KPI Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Total Hadir</p>
              <p className="text-xl font-semibold text-gray-900">{stats.total_hadir} hari</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Attendance Rate</p>
              <p className="text-xl font-semibold text-gray-900">{stats.attendance_rate}%</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Terlambat</p>
              <p className="text-xl font-semibold text-gray-900">{stats.total_terlambat} kali</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Rata-rata Jam Kerja</p>
              <p className="text-xl font-semibold text-gray-900">{stats.avg_work_hours} jam</p>
            </div>
          </div>
        )}

        {/* Trend Chart */}
        {trend.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <p className="text-sm font-medium text-gray-900 mb-3">Jam Kerja 30 Hari Terakhir</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trend}>
                <XAxis dataKey="date" fontSize={11} stroke="#9ca3af" />
                <YAxis fontSize={11} stroke="#9ca3af" />
                <Tooltip />
                <Line type="monotone" dataKey="jam" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Riwayat terbaru */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex justify-between items-center px-4 pt-4 pb-2">
            <p className="text-sm font-medium text-gray-900">Riwayat Terbaru</p>
            <button onClick={() => navigate('/history')} className="text-xs text-primary-600 font-medium">
              Lihat Semua
            </button>
          </div>
          {history.map((item) => (
            <div key={item.id} className="flex justify-between items-center px-4 py-3 border-t border-gray-100">
              <div>
                <p className="text-sm text-gray-900">
                  {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </p>
                <p className="text-xs text-gray-500">
                  {item.check_in_time
                    ? new Date(item.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                    : '-'}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${statusBadge[item.status]}`}>
                {item.status}
              </span>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-sm text-gray-400 px-4 py-6 text-center">Belum ada riwayat absensi.</p>
          )}
        </div>
      </div>
    </div>
  );
}
