import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

export default function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [todayAll, setTodayAll] = useState([]);
  const [ranking, setRanking] = useState({ top_performers: [], at_risk: [] });

  useEffect(() => {
    fetchData();
    // Refresh otomatis tiap 30 detik untuk data real-time
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      const [overviewRes, todayRes, rankingRes] = await Promise.all([
        api.get('/stats/overview'),
        api.get('/attendance/today-all'),
        api.get('/stats/ranking'),
      ]);
      setOverview(overviewRes.data);
      setTodayAll(todayRes.data);
      setRanking(rankingRes.data);
    } catch (err) {
      console.error(err);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const statusLabel = {
    hadir: { text: 'Hadir', class: 'bg-green-50 text-green-700' },
    terlambat: { text: 'Terlambat', class: 'bg-amber-50 text-amber-700' },
    izin: { text: 'Izin', class: 'bg-blue-50 text-blue-700' },
    alpha: { text: 'Alpha', class: 'bg-red-50 text-red-700' },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">Admin Panel</p>
            <p className="font-semibold text-gray-900">{user?.name}</p>
          </div>
          <div className="flex gap-4 items-center">
            <Link to="/admin/users" className="text-sm text-primary-600 font-medium">
              Kelola Pengguna
            </Link>
            <button onClick={handleLogout} className="text-sm text-gray-500">
              Keluar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* KPI Overview */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Total Pegawai</p>
              <p className="text-xl font-semibold text-gray-900">{overview.total_pegawai}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Hadir Hari Ini</p>
              <p className="text-xl font-semibold text-green-600">{overview.hadir_hari_ini}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Terlambat</p>
              <p className="text-xl font-semibold text-amber-600">{overview.terlambat_hari_ini}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Alpha</p>
              <p className="text-xl font-semibold text-red-600">{overview.alpha_hari_ini}</p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Real-time board */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <p className="text-sm font-medium text-gray-900 px-4 pt-4 pb-2">
              Status Absensi Hari Ini (real-time)
            </p>
            <div className="max-h-96 overflow-y-auto">
              {todayAll.map((item) => (
                <div key={item.user_id} className="flex justify-between items-center px-4 py-3 border-t border-gray-100">
                  <div>
                    <p className="text-sm text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.department || '-'}</p>
                  </div>
                  {item.status ? (
                    <span className={`text-xs px-2 py-1 rounded-full ${statusLabel[item.status]?.class}`}>
                      {statusLabel[item.status]?.text}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                      Belum absen
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Ranking */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-900 mb-3">Top Performers</p>
              {ranking.top_performers.map((r, i) => (
                <div key={r.id} className="flex justify-between items-center py-1.5 text-sm">
                  <span className="text-gray-700">{i + 1}. {r.name}</span>
                  <span className="text-green-600 font-medium">{r.attendance_rate}%</span>
                </div>
              ))}
              {ranking.top_performers.length === 0 && (
                <p className="text-xs text-gray-400">Belum ada data.</p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-900 mb-3">Perlu Perhatian (Attendance rendah)</p>
              {ranking.at_risk.map((r) => (
                <div key={r.id} className="flex justify-between items-center py-1.5 text-sm">
                  <span className="text-gray-700">{r.name}</span>
                  <span className="text-red-600 font-medium">{r.attendance_rate}%</span>
                </div>
              ))}
              {ranking.at_risk.length === 0 && (
                <p className="text-xs text-gray-400">Tidak ada pegawai berisiko.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
