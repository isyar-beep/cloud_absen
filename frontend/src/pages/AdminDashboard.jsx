import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import AdminSidebar from '../components/AdminSidebar';
import { useDialog } from '../components/Dialog';
import StatusBadge from '../components/StatusBadge';
import {
  UsersIcon, CheckBadgeIcon, ClockIcon, AlertIcon, DownloadIcon, MailIcon,
} from '../components/Icons';
import Avatar from '../components/Avatar';
import PengingatAbsen from '../components/PengingatAbsen';
import Pilihan, { KELAS_PILIHAN } from '../components/Pilihan';
import { tanggalIso } from '../utils/tanggal';

// Batas "Perlu Perhatian", disamakan dengan ambang di server
// (statsController: attendance_rate < 80). Ditulis di sini hanya untuk
// dijelaskan pada layar; kalau nanti dibuat dapat disetel, kedua tempatnya
// harus ikut membaca setelan yang sama.
const AMBANG_BERISIKO = 80;

// Peringkat baru berarti bila orangnya cukup banyak untuk dibedakan.
const MIN_PEGAWAI_PERINGKAT = 5;

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const { konfirmasi, beritahu } = useDialog();
  const [todayAll, setTodayAll] = useState([]);
  const [ranking, setRanking] = useState({ top_performers: [], at_risk: [] });
  const [projects, setProjects] = useState([]);
  // Dibedakan dari pesan galat aksi: ini kegagalan MEMUAT, dan tanpa
  // ditampilkan, layar kosong terlihat seolah memang belum ada datanya.
  const [loadError, setLoadError] = useState('');
  const [reportPeriod, setReportPeriod] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    // Kosong = seluruh proyek. Server sudah menerima penyaring ini pada
    // Excel maupun PDF sejak kluster proyek dibangun.
    project_id: '',
  });
  const [downloading, setDownloading] = useState('');
  const [sendingWarning, setSendingWarning] = useState(false);
  const [warningResult, setWarningResult] = useState('');

  // Penandaan alpha tidak lagi punya tombol di sini. Prosesnya berjalan
  // terjadwal di server tiap dini hari (lihat docs/deployment.md); tombol
  // manualnya justru rawan dipakai untuk tanggal yang harinya belum selesai.
  // Koreksi kasus per kasus sekarang lewat menu Riwayat > Koreksi.
  //
  // Pengingat absen pindah ke komponen PengingatAbsen, yang mengurus
  // daftar pegawai dan pilihannya sendiri.

  useEffect(() => {
    fetchData();
    // Refresh otomatis tiap 30 detik untuk data real-time
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Tiap permintaan berdiri sendiri dengan allSettled, bukan Promise.all.
  // Dengan Promise.all satu kegagalan membatalkan semuanya sekaligus:
  // dashboard tampil kosong melompong, dan satu-satunya jejaknya cuma
  // console.error yang tidak dilihat siapa pun. Persis kejadian "statistik
  // tidak muncul" yang dulu sulit dilacak di aplikasi HP.
  //
  // Sekarang bagian yang berhasil tetap tampil, dan yang gagal diberitahukan
  // di layar -- bukan disembunyikan sebagai halaman kosong.
  async function fetchData() {
    const [overviewRes, todayRes, rankingRes, projectsRes] = await Promise.allSettled([
      api.get('/stats/overview'),
      api.get('/attendance/today-all'),
      api.get('/stats/ranking'),
      api.get('/projects'),
    ]);

    if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data);
    if (todayRes.status === 'fulfilled') setTodayAll(todayRes.value.data);
    if (rankingRes.status === 'fulfilled') setRanking(rankingRes.value.data);
    if (projectsRes.status === 'fulfilled') setProjects(projectsRes.value.data);

    const gagal = [overviewRes, todayRes, rankingRes, projectsRes]
      .find((r) => r.status === 'rejected');
    setLoadError(
      gagal
        ? gagal.reason?.response?.data?.message
          || 'Sebagian data gagal dimuat. Periksa koneksi ke server.'
        : ''
    );
  }

  // Download laporan lewat axios supaya header Authorization ikut terkirim,
  // lalu simpan blob sebagai file di browser
  async function downloadReport(format) {
    setDownloading(format);
    try {
      // project_id kosong tidak dikirim: server memperlakukan ketiadaannya
      // sebagai "seluruh proyek", sedangkan string kosong akan dicoba
      // diubah jadi angka.
      const params = { month: reportPeriod.month, year: reportPeriod.year };
      if (reportPeriod.project_id) params.project_id = reportPeriod.project_id;

      const res = await api.get(`/reports/attendance/${format}`, {
        params,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      // Nama proyek ikut di nama berkas: tanpa itu, laporan tiga proyek
      // untuk bulan yang sama saling menimpa di folder unduhan.
      const namaProyek = projects.find((pr) => String(pr.id) === String(reportPeriod.project_id))?.name;
      const imbuhan = namaProyek ? `-${namaProyek.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '';
      link.href = url;
      link.download = `laporan-absensi-${reportPeriod.year}-${String(reportPeriod.month).padStart(2, '0')}${imbuhan}.${ext}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      beritahu({
        judul: 'Gagal mengunduh laporan',
        pesan: 'Periksa koneksi ke server, lalu coba lagi.',
      });
    } finally {
      setDownloading('');
    }
  }

  async function sendWarningEmails() {
    const setuju = await konfirmasi({
      judul: 'Kirim email peringatan?',
      pesan: 'Email dikirim ke semua pegawai yang attendance rate-nya di bawah batas. '
        + 'Email yang sudah terkirim tidak bisa ditarik kembali.',
      jenis: 'info',
      tombolYa: 'Kirim email',
    });
    if (!setuju) return;
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

  const namaBulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const cukupUntukPeringkat = Number(overview?.total_pegawai || 0) >= MIN_PEGAWAI_PERINGKAT;

  // Tiap angka sebenarnya sebuah pertanyaan, dan jawabannya sudah ada di
  // halaman lain -- jadi angkanya dijadikan pintu ke sana, bukan dibiarkan
  // sebagai bilangan mati yang harus ditelusuri manual.
  const hariIni = tanggalIso(new Date());
  const keRiwayat = (status) =>
    `/admin/history?start_date=${hariIni}&end_date=${hariIni}${status ? `&status=${status}` : ''}`;

  const kpiCards = overview
    ? [
        { label: 'Total Pegawai', value: overview.total_pegawai, icon: UsersIcon,
          chip: 'bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400',
          ke: '/admin/users', keterangan: 'Lihat daftar pegawai' },
        { label: 'Hadir Hari Ini', value: overview.hadir_hari_ini, icon: CheckBadgeIcon,
          chip: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
          // Angka ini menjumlahkan hadir DAN terlambat (lihat statsController),
          // jadi tautannya meminta keduanya -- kalau hanya 'hadir', daftar
          // yang terbuka lebih sedikit daripada angka yang barusan diketuk.
          ke: keRiwayat('hadir,terlambat'), keterangan: 'Lihat yang hadir hari ini' },
        { label: 'Terlambat', value: overview.terlambat_hari_ini, icon: ClockIcon,
          chip: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
          ke: keRiwayat('terlambat'), keterangan: 'Lihat yang terlambat hari ini' },
        { label: 'Alpha', value: overview.alpha_hari_ini, icon: AlertIcon,
          chip: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400',
          ke: keRiwayat('alpha'), keterangan: 'Lihat yang tidak masuk hari ini' },
      ]
    : [];

  return (
    <div className="min-h-screen transition-[padding] duration-200 lg:pl-[var(--lebar-sidebar)]">
      <AdminSidebar />

      <div className="wadah-petak px-5 lg:px-8 py-7">
        <div className="mb-6">
          <h1 className="text-[1.75rem] leading-tight font-extrabold text-strong tracking-[-0.02em]">Dashboard</h1>
          <p className="text-sm text-muted mt-0.5">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {loadError && (
          <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-3 mb-5">
            {loadError}
          </div>
        )}

        {/* KPI Overview. Dua atau empat lajur, tidak pernah tiga -- lihat
            .petak-kpi di index.css. Lajurnya ditentukan oleh ruang yang
            tersedia, bukan lebar jendela, sehingga melipat sidebar pun
            langsung melebarkan petaknya. */}
        {overview && (
          <div className="petak-kpi gap-4 mb-6">
            {kpiCards.map((card) => (
              <Link
                key={card.label}
                to={card.ke}
                title={card.keterangan}
                className="kartu-kaca kartu-naik p-6 flex items-center gap-4 text-left focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${card.chip}`}>
                  <card.icon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-muted truncate">{card.label}</p>
                  <p className="text-[32px] font-extrabold text-strong leading-none tracking-[-0.03em] mt-1">{card.value}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Export laporan */}
        <div className="kartu-kaca p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
              <DownloadIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[17px] font-bold text-strong tracking-[-0.01em]">Ekspor Laporan Bulanan</p>
              <p className="text-xs text-muted truncate">
                {reportPeriod.project_id
                  ? 'Rekap & bukti kehadiran satu proyek'
                  : 'Rekap & detail absensi seluruh pegawai'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Penyaring proyek. Server sudah menerimanya sejak kluster
                dibangun, tapi tombol ini hanya mengirim bulan dan tahun --
                kemampuannya ada, pintunya belum dibuka. Padahal laporan per
                proyek justru berkas pertanggungjawaban ke pemberi kerja. */}
            {projects.length > 0 && (
              <Pilihan
                value={reportPeriod.project_id}
                onChange={(e) => setReportPeriod({ ...reportPeriod, project_id: e.target.value })}
                ariaLabel="Proyek untuk laporan"
                className={`${KELAS_PILIHAN} w-44`}
                options={[
                  { value: '', label: 'Semua proyek' },
                  ...projects.map((pr) => ({ value: pr.id, label: pr.name })),
                ]}
              />
            )}
            <Pilihan
              value={reportPeriod.month}
              onChange={(e) => setReportPeriod({ ...reportPeriod, month: Number(e.target.value) })}
              ariaLabel="Bulan laporan"
              className={`${KELAS_PILIHAN} w-36`}
              options={namaBulan.map((nama, i) => ({ value: i + 1, label: nama }))}
            />
            <Pilihan
              value={reportPeriod.year}
              onChange={(e) => setReportPeriod({ ...reportPeriod, year: Number(e.target.value) })}
              ariaLabel="Tahun laporan"
              className={`${KELAS_PILIHAN} w-24`}
              options={[0, 1, 2].map((o) => {
                const tahun = new Date().getFullYear() - o;
                return { value: tahun, label: String(tahun) };
              })}
            />
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
              className="text-sm bg-ink text-on-ink px-4 py-2 rounded-xl font-semibold transition hover:bg-ink/90 disabled:opacity-50"
            >
              {downloading === 'pdf' ? 'Mengunduh…' : 'PDF'}
            </button>
          </div>
        </div>

        {/* Tindakan admin: normalnya dijalankan terjadwal lewat cron di server,
            tombol ini untuk menjalankan manual / keperluan demo */}
        <div className="kartu-kaca p-5 mb-6">
          <p className="text-[17px] font-bold text-strong tracking-[-0.01em]">Tindakan Admin</p>
          <p className="text-xs text-muted mt-0.5">
            Penandaan alpha berjalan otomatis terjadwal di server tiap dini hari.
            Untuk mengoreksi satu catatan absensi, buka menu Riwayat lalu klik Koreksi.
          </p>

          <div className="mt-4">
            <PengingatAbsen />
          </div>
        </div>

        {/* Ringkasan per proyek.
            Tanpa ini, dashboard hanya menampilkan satu angka gabungan untuk
            semuanya -- dan ketika dinas melihat "Alpha: 3", pertanyaan
            berikutnya pasti "di proyek mana?" yang tidak terjawab tanpa
            berpindah halaman. Justru per paket pekerjaan itulah dinas
            mengawasi konsultannya. */}
        {projects.length > 0 && (
          <div className="kartu-kaca overflow-hidden mb-6">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <p className="text-[17px] font-bold text-strong tracking-[-0.01em]">Keadaan per Proyek</p>
              <Link
                to="/admin/projects"
                className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline"
              >
                Kelola proyek →
              </Link>
            </div>
            <div className="divide-y divide-line border-t border-line">
              {projects.map((pr) => (
                <div key={pr.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <div className="min-w-[11rem] flex-1">
                    <p className="text-sm font-medium text-strong truncate leading-tight">{pr.name}</p>
                    <p className="text-[11.5px] text-muted truncate">
                      {pr.consultant_name || 'Belum ada penanggung jawab'}
                      {pr.location ? ` · ${pr.location}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-3.5 text-xs tabular-nums shrink-0">
                    <span className={pr.hadir_hari_ini ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-muted'}>
                      {pr.hadir_hari_ini} hadir
                    </span>
                    <span className={pr.izin_hari_ini ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-muted'}>
                      {pr.izin_hari_ini} izin
                    </span>
                    <span className={pr.alpha_hari_ini ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted'}>
                      {pr.alpha_hari_ini} alpha
                    </span>
                    {/* Yang belum absen ditonjolkan karena inilah satu-satunya
                        angka yang masih bisa ditindaklanjuti hari ini juga --
                        sisanya sudah terjadi. */}
                    <span className={pr.belum_absen
                      ? 'text-amber-700 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-500/15 px-2 py-0.5 rounded-full'
                      : 'text-muted'}>
                      {pr.belum_absen} belum absen
                    </span>
                  </div>

                  <Link
                    to={`/admin/gallery?project_id=${pr.id}`}
                    className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline shrink-0 ml-auto"
                  >
                    Lihat bukti
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Real-time board */}
          <div className="kartu-kaca overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <p className="text-[17px] font-bold text-strong tracking-[-0.01em]">Status Absensi Hari Ini</p>
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="relative flex w-2 h-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" />
                </span>
                Live
              </span>
            </div>
            <div className="max-h-[26rem] overflow-y-auto">
              {todayAll.map((item) => (
                <div key={item.user_id} className="flex items-center gap-3 px-5 py-3 border-t border-line hover:bg-surface-2/60 transition">
                  <Avatar name={item.name} src={item.avatar_url} />
                  <div className="min-w-0 mr-auto">
                    <p className="text-sm font-medium text-strong truncate">{item.name}</p>
                    <p className="text-xs text-muted truncate">{item.project_name || '—'}</p>
                  </div>
                  {item.status ? (
                    <StatusBadge status={item.status} />
                  ) : (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-surface-3 text-muted font-medium">
                      Belum absen
                    </span>
                  )}
                </div>
              ))}
              {todayAll.length === 0 && (
                <p className="text-sm text-faint px-5 py-8 text-center">Belum ada pegawai.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Peringkat disembunyikan selama pegawainya masih sedikit:
                dengan dua orang yang sama-sama 100%, "peringkat" hanya
                mendaftar semua orang tanpa membedakan apa pun, dan justru
                terlihat seperti fitur yang belum jadi.
                "Perlu Perhatian" di bawahnya TIDAK ikut disembunyikan --
                itu ambang, bukan peringkat, jadi tetap berarti meski
                pegawainya baru dua; menyembunyikannya juga akan ikut
                menghilangkan tombol kirim peringatan. */}
            {cukupUntukPeringkat && (
            <div className="kartu-kaca p-5">
              <p className="text-[17px] font-bold text-strong tracking-[-0.01em] mb-4">Kehadiran Terbaik</p>
              <div className="space-y-3">
                {ranking.top_performers.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                      i === 0 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-surface-3 text-muted'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="text-sm text-body mr-auto truncate">{r.name}</span>
                    <div className="w-24 h-1.5 rounded-full bg-surface-3 overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                        style={{ width: `${Math.min(Number(r.attendance_rate), 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 w-14 text-right shrink-0">
                      {r.attendance_rate}%
                    </span>
                  </div>
                ))}
                {ranking.top_performers.length === 0 && (
                  <p className="text-xs text-faint">Belum ada data.</p>
                )}
              </div>
            </div>
            )}

            <div className="kartu-kaca p-5">
              <div className="flex items-baseline justify-between gap-2 mb-4">
                <p className="text-[17px] font-bold text-strong tracking-[-0.01em]">Perlu Perhatian</p>
                {/* Ambangnya ditulis di layar. Tanpa itu, admin melihat nama
                    muncul di sini tanpa tahu batasnya berapa. */}
                <span className="text-[11px] text-faint">di bawah {AMBANG_BERISIKO}%</span>
              </div>
              <div className="space-y-3">
                {ranking.at_risk.map((r) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className="text-sm text-body mr-auto truncate">{r.name}</span>
                    <div className="w-24 h-1.5 rounded-full bg-surface-3 overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-500"
                        style={{ width: `${Math.min(Number(r.attendance_rate), 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400 w-14 text-right shrink-0">
                      {r.attendance_rate}%
                    </span>
                  </div>
                ))}
                {ranking.at_risk.length === 0 && (
                  <p className="text-xs text-faint">Tidak ada pegawai berisiko. 🎉</p>
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
                <p className="text-xs text-muted mt-2">{warningResult}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
