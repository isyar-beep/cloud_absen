import { useEffect, useState } from 'react';
import api from '../api/axios';
import AdminHeader from '../components/AdminHeader';
import StatusBadge from '../components/StatusBadge';
import {
  UsersIcon, CheckBadgeIcon, ClockIcon, AlertIcon, DownloadIcon, MailIcon,
} from '../components/Icons';
import Avatar from '../components/Avatar';

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [todayAll, setTodayAll] = useState([]);
  const [ranking, setRanking] = useState({ top_performers: [], at_risk: [] });
  const [reportPeriod, setReportPeriod] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [downloading, setDownloading] = useState('');
  const [sendingWarning, setSendingWarning] = useState(false);
  const [warningResult, setWarningResult] = useState('');

  // Penandaan alpha tidak lagi punya tombol di sini. Prosesnya berjalan
  // terjadwal di server tiap dini hari (lihat docs/deployment.md); tombol
  // manualnya justru rawan dipakai untuk tanggal yang harinya belum selesai.
  // Koreksi kasus per kasus sekarang lewat menu Riwayat > Koreksi.
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderResult, setReminderResult] = useState('');

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

  // Download laporan lewat axios supaya header Authorization ikut terkirim,
  // lalu simpan blob sebagai file di browser
  async function downloadReport(format) {
    setDownloading(format);
    try {
      const res = await api.get(`/reports/attendance/${format}`, {
        params: reportPeriod,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      link.href = url;
      link.download = `laporan-absensi-${reportPeriod.year}-${String(reportPeriod.month).padStart(2, '0')}.${ext}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Gagal mengunduh laporan. Coba lagi.');
    } finally {
      setDownloading('');
    }
  }

  async function sendWarningEmails() {
    if (!confirm('Kirim email peringatan ke semua pegawai dengan attendance rendah?')) return;
    setSendingWarning(true);
    setWarningResult('');
    try {
      const res = await api.post('/notifications/low-attendance');
      setWarningResult(res.data.message);
    } catch (err) {
      setWarningResult(err.response?.data?.message || 'Gagal mengirim peringatan.');
    } finally {
      setSendingWarning(false);
    }
  }

  async function sendCheckinReminder() {
    if (!confirm('Kirim notifikasi pengingat ke pegawai yang belum absen masuk hari ini?')) return;
    setSendingReminder(true);
    setReminderResult('');
    try {
      const res = await api.post('/notifications/checkin-reminder');
      setReminderResult(res.data.message);
    } catch (err) {
      setReminderResult(err.response?.data?.message || 'Gagal mengirim pengingat.');
    } finally {
      setSendingReminder(false);
    }
  }

  const namaBulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const kpiCards = overview
    ? [
        { label: 'Total Pegawai', value: overview.total_pegawai, icon: UsersIcon, chip: 'bg-primary-50 text-primary-600' },
        { label: 'Hadir Hari Ini', value: overview.hadir_hari_ini, icon: CheckBadgeIcon, chip: 'bg-emerald-50 text-emerald-600' },
        { label: 'Terlambat', value: overview.terlambat_hari_ini, icon: ClockIcon, chip: 'bg-amber-50 text-amber-600' },
        { label: 'Alpha', value: overview.alpha_hari_ini, icon: AlertIcon, chip: 'bg-red-50 text-red-600' },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-6xl mx-auto px-4 py-7">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* KPI Overview */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {kpiCards.map((card) => (
              <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${card.chip}`}>
                  <card.icon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 truncate">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 leading-tight">{card.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Export laporan */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
              <DownloadIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Export Laporan Bulanan</p>
              <p className="text-xs text-gray-500 truncate">Rekap &amp; detail absensi seluruh pegawai</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={reportPeriod.month}
              onChange={(e) => setReportPeriod({ ...reportPeriod, month: Number(e.target.value) })}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/40"
            >
              {namaBulan.map((nama, i) => (
                <option key={nama} value={i + 1}>{nama}</option>
              ))}
            </select>
            <select
              value={reportPeriod.year}
              onChange={(e) => setReportPeriod({ ...reportPeriod, year: Number(e.target.value) })}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/40"
            >
              {[0, 1, 2].map((offset) => {
                const tahun = new Date().getFullYear() - offset;
                return <option key={tahun} value={tahun}>{tahun}</option>;
              })}
            </select>
            <button
              onClick={() => downloadReport('excel')}
              disabled={!!downloading}
              className="text-sm bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2 rounded-xl font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600 disabled:opacity-50"
            >
              {downloading === 'excel' ? 'Mengunduh…' : 'Excel'}
            </button>
            <button
              onClick={() => downloadReport('pdf')}
              disabled={!!downloading}
              className="text-sm bg-gray-900 text-white px-4 py-2 rounded-xl font-semibold transition hover:bg-gray-800 disabled:opacity-50"
            >
              {downloading === 'pdf' ? 'Mengunduh…' : 'PDF'}
            </button>
          </div>
        </div>

        {/* Tindakan admin: normalnya dijalankan terjadwal lewat cron di server,
            tombol ini untuk menjalankan manual / keperluan demo */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 mb-6">
          <p className="text-sm font-semibold text-gray-900">Tindakan Admin</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Penandaan alpha berjalan otomatis terjadwal di server tiap dini hari.
            Untuk mengoreksi satu catatan absensi, buka menu Riwayat lalu klik Koreksi.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            {/* Pengingat absen */}
            <div className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2.5 mb-1">
                <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <ClockIcon className="w-4 h-4" />
                </span>
                <p className="text-sm font-semibold text-gray-900">Pengingat Absen</p>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Kirim notifikasi ke HP pegawai yang belum absen masuk hari ini.
              </p>
              <button
                onClick={sendCheckinReminder}
                disabled={sendingReminder}
                className="text-sm bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2 rounded-xl font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600 disabled:opacity-50"
              >
                {sendingReminder ? 'Mengirim…' : 'Kirim Pengingat'}
              </button>
              {reminderResult && <p className="text-xs text-gray-600 mt-2.5">{reminderResult}</p>}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Real-time board */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <p className="text-sm font-semibold text-gray-900">Status Absensi Hari Ini</p>
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <span className="relative flex w-2 h-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" />
                </span>
                Live
              </span>
            </div>
            <div className="max-h-[26rem] overflow-y-auto">
              {todayAll.map((item) => (
                <div key={item.user_id} className="flex items-center gap-3 px-5 py-3 border-t border-gray-50 hover:bg-gray-50/60 transition">
                  <Avatar name={item.name} src={item.avatar_url} />
                  <div className="min-w-0 mr-auto">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 truncate">{item.department || '—'}</p>
                  </div>
                  {item.status ? (
                    <StatusBadge status={item.status} />
                  ) : (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
                      Belum absen
                    </span>
                  )}
                </div>
              ))}
              {todayAll.length === 0 && (
                <p className="text-sm text-gray-400 px-5 py-8 text-center">Belum ada pegawai.</p>
              )}
            </div>
          </div>

          {/* Ranking */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
              <p className="text-sm font-semibold text-gray-900 mb-4">Top Performers</p>
              <div className="space-y-3">
                {ranking.top_performers.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-700 mr-auto truncate">{r.name}</span>
                    <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                        style={{ width: `${Math.min(Number(r.attendance_rate), 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-emerald-600 w-14 text-right shrink-0">
                      {r.attendance_rate}%
                    </span>
                  </div>
                ))}
                {ranking.top_performers.length === 0 && (
                  <p className="text-xs text-gray-400">Belum ada data.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
              <p className="text-sm font-semibold text-gray-900 mb-4">Perlu Perhatian</p>
              <div className="space-y-3">
                {ranking.at_risk.map((r) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 mr-auto truncate">{r.name}</span>
                    <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-500"
                        style={{ width: `${Math.min(Number(r.attendance_rate), 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-red-600 w-14 text-right shrink-0">
                      {r.attendance_rate}%
                    </span>
                  </div>
                ))}
                {ranking.at_risk.length === 0 && (
                  <p className="text-xs text-gray-400">Tidak ada pegawai berisiko. 🎉</p>
                )}
              </div>
              {ranking.at_risk.length > 0 && (
                <button
                  onClick={sendWarningEmails}
                  disabled={sendingWarning}
                  className="mt-4 flex items-center gap-2 text-sm bg-red-600 text-white px-4 py-2 rounded-xl font-semibold transition hover:bg-red-500 disabled:opacity-50"
                >
                  <MailIcon className="w-4 h-4" />
                  {sendingWarning ? 'Mengirim...' : 'Kirim Peringatan Email'}
                </button>
              )}
              {warningResult && (
                <p className="text-xs text-gray-500 mt-2">{warningResult}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
