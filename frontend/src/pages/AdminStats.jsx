import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../api/axios';
import AdminHeader from '../components/AdminHeader';

const WARNA = { hadir: '#10b981', terlambat: '#f59e0b', izin: '#3b82f6', alpha: '#ef4444' };
const LABEL = { hadir: 'Hadir', terlambat: 'Terlambat', izin: 'Izin', alpha: 'Alpha' };
const KATEGORI = ['hadir', 'terlambat', 'izin', 'alpha'];
const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const TIPE_GRAFIK = [
  { id: 'bar', label: 'Bar per Bulan' },
  { id: 'line', label: 'Tren Garis' },
  { id: 'pie', label: 'Proporsi' },
  { id: 'table', label: 'Tabel' },
];

const TINGGI_CHART = 320;

// Tooltip seragam untuk semua jenis grafik
const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 8px 24px -8px rgb(0 0 0 / 0.12)',
  fontSize: 12,
  padding: '8px 12px',
};

// Wadah dengan tinggi tetap supaya kartu tidak "kempis" saat data kosong
function AreaKonten({ children }) {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: TINGGI_CHART }}>
      {children}
    </div>
  );
}

function PesanKosong({ judul, detail }) {
  return (
    <div className="text-center px-6">
      <div className="w-11 h-11 rounded-2xl bg-gray-100 mx-auto mb-3 flex items-center justify-center">
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 15l3-3 3 3 5-6" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-600">{judul}</p>
      {detail && <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">{detail}</p>}
    </div>
  );
}

export default function AdminStats() {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [periode, setPeriode] = useState('bulan');
  const [bulan, setBulan] = useState(new Date().getMonth() + 1);
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [tipeGrafik, setTipeGrafik] = useState('bar');

  const [breakdown, setBreakdown] = useState(null);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const butuhSeries = tipeGrafik === 'bar' || tipeGrafik === 'line';

  useEffect(() => {
    api.get('/users')
      .then((res) => setUsers(res.data.filter((u) => u.role !== 'admin')))
      .catch(console.error);
  }, []);

  useEffect(() => {
    let dibatalkan = false;

    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        const params = userId ? { user_id: userId } : {};
        if (butuhSeries) {
          const res = await api.get('/stats/monthly-series', { params });
          if (!dibatalkan) setSeries(res.data);
        } else {
          if (periode === 'bulan') {
            params.month = bulan;
            params.year = tahun;
          }
          const res = await api.get('/stats/breakdown', { params });
          if (!dibatalkan) setBreakdown(res.data);
        }
      } catch (err) {
        if (!dibatalkan) {
          setError(err.response?.data?.message || 'Gagal memuat data statistik. Pastikan server backend berjalan.');
        }
      } finally {
        if (!dibatalkan) setLoading(false);
      }
    }

    fetchData();
    return () => { dibatalkan = true; };
  }, [userId, periode, bulan, tahun, butuhSeries]);

  const seriesChart = useMemo(
    () => series.map((s) => ({ ...s, label: `${NAMA_BULAN[s.month - 1]} '${String(s.year).slice(2)}` })),
    [series]
  );

  const pieData = useMemo(
    () => (breakdown
      ? KATEGORI.map((key) => ({ key, name: LABEL[key], value: breakdown[key] })).filter((d) => d.value > 0)
      : []),
    [breakdown]
  );

  const totalSeries = useMemo(
    () => series.reduce((acc, s) => acc + s.hadir + s.terlambat + s.izin + s.alpha, 0),
    [series]
  );

  // Ringkasan angka di atas grafik -- untuk mode series dihitung dari seluruh bulan
  const ringkasan = useMemo(() => {
    if (butuhSeries) {
      const total = KATEGORI.reduce((acc, k) => ({ ...acc, [k]: series.reduce((s, r) => s + r[k], 0) }), {});
      const record = KATEGORI.reduce((a, k) => a + total[k], 0);
      return {
        ...total,
        total_record: record,
        attendance_rate: record > 0 ? (((total.hadir + total.terlambat) / record) * 100).toFixed(1) : '0.0',
      };
    }
    return breakdown;
  }, [butuhSeries, series, breakdown]);

  const adaData = butuhSeries ? totalSeries > 0 : (breakdown?.total_record ?? 0) > 0;

  const namaTerpilih = userId
    ? users.find((u) => String(u.id) === String(userId))?.name || 'Pegawai'
    : 'Semua Pegawai';

  const keteranganPeriode = butuhSeries
    ? 'Seluruh bulan yang tercatat'
    : periode === 'bulan'
      ? `${NAMA_BULAN[bulan - 1]} ${tahun}`
      : 'Riwayat keseluruhan';

  const selectClass =
    'w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/40 focus:border-primary-300';
  const labelClass = 'block text-xs font-medium text-gray-500 mb-1.5';

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-5xl mx-auto px-4 py-7">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Statistik &amp; Grafik</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kehadiran keseluruhan atau per pegawai, bulanan atau riwayat lengkap
          </p>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={butuhSeries ? 'sm:col-span-2' : ''}>
              <label className={labelClass}>Pegawai</label>
              <select value={userId} onChange={(e) => setUserId(e.target.value)} className={selectClass}>
                <option value="">Semua Pegawai</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            {!butuhSeries && (
              <>
                <div>
                  <label className={labelClass}>Periode</label>
                  <select value={periode} onChange={(e) => setPeriode(e.target.value)} className={selectClass}>
                    <option value="bulan">Bulan tertentu</option>
                    <option value="semua">Riwayat keseluruhan</option>
                  </select>
                </div>
                {periode === 'bulan' && (
                  <>
                    <div>
                      <label className={labelClass}>Bulan</label>
                      <select value={bulan} onChange={(e) => setBulan(Number(e.target.value))} className={selectClass}>
                        {NAMA_BULAN.map((b, i) => (
                          <option key={b} value={i + 1}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Tahun</label>
                      <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))} className={selectClass}>
                        {[tahun - 1, tahun, tahun + 1].map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-4 border-t border-gray-100">
            <span className="text-xs font-medium text-gray-500 mr-1">Tampilan</span>
            {TIPE_GRAFIK.map((t) => (
              <button
                key={t.id}
                onClick={() => setTipeGrafik(t.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                  tipeGrafik === t.id
                    ? 'bg-primary-600 text-white shadow-glow'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Kartu grafik */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-5 pt-5 pb-4">
            <p className="text-sm font-semibold text-gray-900">{namaTerpilih}</p>
            <p className="text-xs text-gray-400">{keteranganPeriode}</p>
          </div>

          {/* Ringkasan angka */}
          {!loading && !error && adaData && ringkasan && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-gray-100 border-y border-gray-100">
              {KATEGORI.map((key) => (
                <div key={key} className="bg-white px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: WARNA[key] }} />
                    <p className="text-xs text-gray-500 truncate">{LABEL[key]}</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900 mt-0.5 tabular-nums">{ringkasan[key]}</p>
                </div>
              ))}
              <div className="bg-white px-4 py-3 col-span-2 sm:col-span-1">
                <p className="text-xs text-gray-500">Attendance Rate</p>
                <p className="text-lg font-bold text-primary-600 mt-0.5 tabular-nums">{ringkasan.attendance_rate}%</p>
              </div>
            </div>
          )}

          <div className="p-5">
            {loading && (
              <AreaKonten>
                <p className="text-sm text-gray-400">Memuat data…</p>
              </AreaKonten>
            )}

            {!loading && error && (
              <AreaKonten>
                <div className="text-center px-6">
                  <p className="text-sm font-medium text-red-600">{error}</p>
                  <p className="text-xs text-gray-400 mt-1">Coba muat ulang halaman setelah server aktif kembali.</p>
                </div>
              </AreaKonten>
            )}

            {!loading && !error && !adaData && (
              <AreaKonten>
                <PesanKosong
                  judul="Belum ada data absensi"
                  detail={
                    butuhSeries || periode === 'semua'
                      ? 'Belum ada catatan absensi untuk pilihan ini.'
                      : `Tidak ada catatan absensi pada ${keteranganPeriode}. Coba pilih periode lain.`
                  }
                />
              </AreaKonten>
            )}

            {!loading && !error && adaData && tipeGrafik === 'bar' && (
              <ResponsiveContainer width="100%" height={TINGGI_CHART}>
                <BarChart data={seriesChart} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={11} stroke="#9ca3af" tickLine={false} axisLine={false} dy={6} />
                  <YAxis fontSize={11} stroke="#9ca3af" tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} formatter={(v, n) => [v, LABEL[n] || n]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v) => LABEL[v] || v} />
                  {KATEGORI.map((key) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="a"
                      fill={WARNA[key]}
                      barSize={34}
                      radius={[2, 2, 0, 0]}
                      animationDuration={600}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}

            {!loading && !error && adaData && tipeGrafik === 'line' && (
              <ResponsiveContainer width="100%" height={TINGGI_CHART}>
                <LineChart data={seriesChart} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={11} stroke="#9ca3af" tickLine={false} axisLine={false} dy={6} />
                  <YAxis fontSize={11} stroke="#9ca3af" tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v, LABEL[n] || n]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v) => LABEL[v] || v} />
                  {KATEGORI.map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={WARNA[key]}
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 0, fill: WARNA[key] }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                      animationDuration={600}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}

            {!loading && !error && adaData && tipeGrafik === 'pie' && (
              <ResponsiveContainer width="100%" height={TINGGI_CHART}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={104}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                    animationDuration={600}
                  >
                    {pieData.map((d) => (
                      <Cell key={d.key} fill={WARNA[d.key]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}

            {!loading && !error && adaData && tipeGrafik === 'table' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Jumlah</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Porsi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KATEGORI.map((key) => {
                      const porsi = breakdown.total_record > 0
                        ? ((breakdown[key] / breakdown.total_record) * 100).toFixed(1)
                        : '0.0';
                      return (
                        <tr key={key} className="border-b border-gray-50">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2 text-gray-700">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: WARNA[key] }} />
                              {LABEL[key]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums">{breakdown[key]}</td>
                          <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{porsi}%</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-50/70">
                      <td className="px-4 py-3 font-semibold text-gray-900">Total Record</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">{breakdown.total_record}</td>
                      <td className="px-4 py-3" />
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-gray-900">Attendance Rate</td>
                      <td className="px-4 py-3 text-right font-semibold text-primary-600 tabular-nums">{breakdown.attendance_rate}%</td>
                      <td className="px-4 py-3" />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
