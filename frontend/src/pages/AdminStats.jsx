import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../api/axios';
import AdminHeader from '../components/AdminHeader';

const WARNA = { hadir: '#10b981', terlambat: '#f59e0b', izin: '#3b82f6', alpha: '#ef4444' };
const LABEL = { hadir: 'Hadir', terlambat: 'Terlambat', izin: 'Izin', alpha: 'Alpha' };
const NAMA_BULAN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const TIPE_GRAFIK = [
  { id: 'bar', label: 'Bar per Bulan' },
  { id: 'line', label: 'Tren Garis' },
  { id: 'pie', label: 'Proporsi' },
  { id: 'table', label: 'Tabel' },
];

export default function AdminStats() {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [periode, setPeriode] = useState('bulan'); // 'bulan' | 'semua' -- dipakai utk chart pie & tabel
  const [bulan, setBulan] = useState(new Date().getMonth() + 1);
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [tipeGrafik, setTipeGrafik] = useState('bar');

  const [breakdown, setBreakdown] = useState(null);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(false);

  const butuhSeries = tipeGrafik === 'bar' || tipeGrafik === 'line';

  useEffect(() => {
    api.get('/users').then((res) => setUsers(res.data.filter((u) => u.role !== 'admin'))).catch(console.error);
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, periode, bulan, tahun, tipeGrafik]);

  async function fetchData() {
    setLoading(true);
    try {
      if (butuhSeries) {
        const res = await api.get('/stats/monthly-series', { params: userId ? { user_id: userId } : {} });
        setSeries(res.data);
      } else {
        const params = userId ? { user_id: userId } : {};
        if (periode === 'bulan') {
          params.month = bulan;
          params.year = tahun;
        }
        const res = await api.get('/stats/breakdown', { params });
        setBreakdown(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const seriesChart = useMemo(
    () => series.map((s) => ({ ...s, label: `${NAMA_BULAN[s.month - 1]} '${String(s.year).slice(2)}` })),
    [series]
  );

  const pieData = breakdown
    ? ['hadir', 'terlambat', 'izin', 'alpha']
        .map((key) => ({ key, name: LABEL[key], value: breakdown[key] }))
        .filter((d) => d.value > 0)
    : [];

  const namaTerpilih = userId ? users.find((u) => String(u.id) === String(userId))?.name : 'Semua Pegawai';

  const selectClass =
    'px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/40';

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-5xl mx-auto px-4 py-7">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Statistik &amp; Grafik</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kehadiran keseluruhan atau per pegawai, bulanan atau riwayat lengkap</p>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-4 mb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Pegawai</label>
              <select value={userId} onChange={(e) => setUserId(e.target.value)} className={`${selectClass} w-full`}>
                <option value="">Semua Pegawai</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            {!butuhSeries && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Periode</label>
                  <select value={periode} onChange={(e) => setPeriode(e.target.value)} className={`${selectClass} w-full`}>
                    <option value="bulan">Bulan Tertentu</option>
                    <option value="semua">Riwayat Keseluruhan</option>
                  </select>
                </div>
                {periode === 'bulan' && (
                  <div className="flex gap-2">
                    <select value={bulan} onChange={(e) => setBulan(Number(e.target.value))} className={`${selectClass} flex-1`}>
                      {NAMA_BULAN.map((b, i) => (
                        <option key={b} value={i + 1}>{b}</option>
                      ))}
                    </select>
                    <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))} className={`${selectClass} w-24`}>
                      {[tahun - 1, tahun, tahun + 1].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Selector tipe grafik */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {TIPE_GRAFIK.map((t) => (
              <button
                key={t.id}
                onClick={() => setTipeGrafik(t.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                  tipeGrafik === t.id
                    ? 'bg-primary-600 text-white shadow-glow'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {butuhSeries && (
            <p className="text-xs text-gray-400">
              Grafik tren selalu menampilkan seluruh bulan yang ada datanya — pilih "Proporsi" atau "Tabel" untuk lihat satu bulan/rentang spesifik.
            </p>
          )}
        </div>

        {/* Konten grafik */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
          <p className="text-sm font-semibold text-gray-900 mb-4">
            {namaTerpilih}
            {!butuhSeries && periode === 'bulan' && ` · ${NAMA_BULAN[bulan - 1]} ${tahun}`}
            {!butuhSeries && periode === 'semua' && ' · Riwayat Keseluruhan'}
          </p>

          {loading && <p className="text-sm text-gray-400 text-center py-16">Memuat data...</p>}

          {!loading && butuhSeries && seriesChart.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-16">Belum ada data absensi.</p>
          )}

          {!loading && butuhSeries && seriesChart.length > 0 && tipeGrafik === 'bar' && (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={seriesChart} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="label" fontSize={11} stroke="#9ca3af" tickLine={false} axisLine={false} />
                <YAxis fontSize={11} stroke="#9ca3af" tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => LABEL[v] || v} />
                {Object.keys(WARNA).map((key) => (
                  <Bar key={key} dataKey={key} stackId="a" fill={WARNA[key]} radius={key === 'alpha' ? [4, 4, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}

          {!loading && butuhSeries && seriesChart.length > 0 && tipeGrafik === 'line' && (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={seriesChart} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="label" fontSize={11} stroke="#9ca3af" tickLine={false} axisLine={false} />
                <YAxis fontSize={11} stroke="#9ca3af" tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => LABEL[v] || v} />
                {Object.keys(WARNA).map((key) => (
                  <Line key={key} type="monotone" dataKey={key} stroke={WARNA[key]} strokeWidth={2.5} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}

          {!loading && !butuhSeries && breakdown && tipeGrafik === 'pie' && (
            pieData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-16">Belum ada data absensi untuk periode ini.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={(d) => `${d.name} (${d.value})`}>
                    {pieData.map((d) => (
                      <Cell key={d.key} fill={WARNA[d.key]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )
          )}

          {!loading && !butuhSeries && breakdown && tipeGrafik === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {['hadir', 'terlambat', 'izin', 'alpha'].map((key) => (
                    <tr key={key} className="border-b border-gray-50 last:border-b-0">
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: WARNA[key] }} />
                          {LABEL[key]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">{breakdown[key]}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50/60">
                    <td className="px-4 py-2.5 font-semibold text-gray-900">Total Record</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{breakdown.total_record}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-gray-900">Attendance Rate</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-primary-600">{breakdown.attendance_rate}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
