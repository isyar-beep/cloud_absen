import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { urlFoto, useTokenFoto } from '../api/fileUrl';
import AdminHeader from '../components/AdminHeader';
import Avatar from '../components/Avatar';
import StatusBadge from '../components/StatusBadge';
import Koordinat from '../components/Koordinat';
import WfaBadge from '../components/WfaBadge';
import { formatTanggalHari, formatJam, formatJamDetik } from '../utils/tanggal';

const LIMIT = 24;

const JENIS = [
  { id: 'semua', label: 'Masuk & pulang' },
  { id: 'masuk', label: 'Hanya masuk' },
  { id: 'pulang', label: 'Hanya pulang' },
];

function tanggalIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Satu sisi foto (masuk / pulang). Slot kosong tampil jelas supaya
// absen pulang yang bolong langsung terlihat, bukan sekadar hilang.
function SlotFoto({ url, jenis, jam, token, status, onClick }) {
  const label = jenis === 'masuk' ? 'MASUK' : 'PULANG';

  if (!url) {
    const alasan = status === 'izin' || status === 'cuti'
      ? 'Izin disetujui\ntidak perlu absen'
      : status === 'alpha'
        ? 'Tidak absen'
        : `Tidak absen ${jenis}`;
    return (
      <div // Garis miring digambar dari token permukaan, bukan warna tetap. Dengan
      // #fafafa mati, slot kosong ini jadi kotak putih menyilaukan di tengah
      // galeri gelap -- justru menarik mata ke tempat yang tidak ada isinya.
      className="aspect-square flex flex-col items-center justify-center gap-1.5 border border-dashed border-line"
      style={{
        backgroundImage:
          'repeating-linear-gradient(45deg, rgb(var(--c-surface-2)), rgb(var(--c-surface-2)) 8px, rgb(var(--c-surface-3)) 8px, rgb(var(--c-surface-3)) 16px)',
      }}>
        <span className="text-faint text-lg">⊘</span>
        <span className="text-[10.5px] text-faint font-medium text-center leading-tight px-2 whitespace-pre-line">
          {alasan}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative aspect-square overflow-hidden group focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
    >
      <img
        src={urlFoto(url, token)}
        alt={`Foto absen ${jenis}`}
        loading="lazy"
        className="w-full h-full object-cover transition group-hover:scale-[1.03]"
      />
      <span className={`absolute top-1.5 left-1.5 text-[9.5px] font-semibold tracking-wide px-2 py-0.5 rounded-full text-white ${
        jenis === 'masuk' ? 'bg-gray-900/70' : 'bg-purple-900/70'
      }`}>
        {label}
      </span>
      {jam && (
        <span className="absolute bottom-1.5 right-1.5 text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-gray-900/65 text-white">
          {jam}
        </span>
      )}
    </button>
  );
}

export default function AdminGallery() {
  const tokenFoto = useTokenFoto();

  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [detail, setDetail] = useState(null); // { row, jenis }

  const [filter, setFilter] = useState(() => {
    const kini = new Date();
    const mulai = new Date();
    mulai.setDate(mulai.getDate() - 6);
    return {
      start_date: tanggalIso(mulai),
      end_date: tanggalIso(kini),
      user_id: '',
      jenis: 'semua',
      status: '',
      sort: 'desc',
    };
  });

  useEffect(() => {
    api.get('/users')
      .then((res) => setUsers(res.data.filter((u) => u.role !== 'admin')))
      .catch(() => {});
  }, []);

  const muat = useCallback(async (offset = 0, tambah = false) => {
    setLoading(true);
    setLoadError('');
    try {
      const params = {
        limit: LIMIT,
        offset,
        with_photo: 'true',
        sort: filter.sort,
      };
      if (filter.start_date) params.start_date = filter.start_date;
      if (filter.end_date) params.end_date = filter.end_date;
      if (filter.user_id) params.user_id = filter.user_id;
      if (filter.status) params.status = filter.status;

      const res = await api.get('/attendance/all', { params });
      setItems((prev) => (tambah ? [...prev, ...res.data] : res.data));
      setHasMore(res.data.length === LIMIT);
    } catch (err) {
      setLoadError(
        err.response?.data?.message ||
        'Gagal memuat foto absensi. Periksa koneksi ke server, lalu muat ulang halaman.'
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { muat(0, false); }, [muat]);

  // Saat hanya satu jenis absen dipilih, kartu menciut jadi satu foto --
  // tidak ada gunanya menampilkan slot yang memang disaring keluar.
  const hanyaSatuJenis = filter.jenis !== 'semua';

  const baris = useMemo(() => {
    if (!hanyaSatuJenis) return items;
    const kolom = filter.jenis === 'masuk' ? 'photo_in_url' : 'photo_out_url';
    return items.filter((r) => r[kolom]);
  }, [items, hanyaSatuJenis, filter.jenis]);

  // Memakai penilaian server, bukan menghitung ulang dari ada-tidaknya foto.
  // Aturan "sudah lewat jam pulang atau belum" itu milik shift, dan
  // menyalinnya ke sini berarti hitungan galeri bisa berselisih dengan
  // riwayat. Efeknya juga memperbaiki: pegawai yang shiftnya masih berjalan
  // tidak lagi terhitung "belum absen pulang".
  const jumlahPulangKosong = useMemo(
    () => items.filter((r) => r.kurang === 'pulang').length,
    [items]
  );

  const chips = useMemo(() => {
    const daftar = [];
    if (filter.user_id) {
      daftar.push({
        teks: users.find((u) => String(u.id) === String(filter.user_id))?.name || 'Pegawai',
        bersih: () => setFilter((f) => ({ ...f, user_id: '' })),
      });
    }
    if (filter.jenis !== 'semua') {
      daftar.push({
        teks: JENIS.find((j) => j.id === filter.jenis).label,
        bersih: () => setFilter((f) => ({ ...f, jenis: 'semua' })),
      });
    }
    if (filter.status) {
      daftar.push({ teks: `Status: ${filter.status}`, bersih: () => setFilter((f) => ({ ...f, status: '' })) });
    }
    return daftar;
  }, [filter, users]);

  function resetFilter() {
    const kini = new Date();
    const mulai = new Date();
    mulai.setDate(mulai.getDate() - 6);
    setFilter({
      start_date: tanggalIso(mulai),
      end_date: tanggalIso(kini),
      user_id: '',
      jenis: 'semua',
      status: '',
      sort: 'desc',
    });
  }

  // Navigasi panah kiri/kanan di jendela detail
  useEffect(() => {
    if (!detail) return;
    function onKey(e) {
      if (e.key === 'Escape') return setDetail(null);
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      const urut = [];
      baris.forEach((r) => {
        if (r.photo_in_url && filter.jenis !== 'pulang') urut.push({ row: r, jenis: 'masuk' });
        if (r.photo_out_url && filter.jenis !== 'masuk') urut.push({ row: r, jenis: 'pulang' });
      });
      const kini = urut.findIndex((x) => x.row.id === detail.row.id && x.jenis === detail.jenis);
      if (kini === -1) return;
      const next = e.key === 'ArrowRight' ? kini + 1 : kini - 1;
      if (urut[next]) setDetail(urut[next]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail, baris, filter.jenis]);

  const inputClass =
    'w-full px-3 py-2 bg-surface-2 border border-line rounded-xl text-sm text-strong transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40';
  const inputAktif = 'bg-primary-50 dark:bg-primary-500/15 border-primary-200 dark:border-primary-500/35 text-primary-700 dark:text-primary-300 font-semibold';
  const labelClass = 'block text-xs font-medium text-muted mb-1.5';

  return (
    <div className="min-h-screen">
      <AdminHeader />

      <div className="max-w-6xl mx-auto px-4 py-7">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-strong tracking-tight">Galeri Foto Absensi</h1>
          <p className="text-sm text-muted mt-0.5">
            Bukti foto masuk dan pulang — satu kartu per pegawai per hari
          </p>
        </div>

        {/* Filter */}
        <div className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft p-5 mb-5">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className={labelClass}>Dari tanggal</label>
              <input type="date" value={filter.start_date}
                onChange={(e) => setFilter({ ...filter, start_date: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Sampai tanggal</label>
              <input type="date" value={filter.end_date}
                onChange={(e) => setFilter({ ...filter, end_date: e.target.value })}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Pegawai</label>
              <select value={filter.user_id}
                onChange={(e) => setFilter({ ...filter, user_id: e.target.value })}
                className={`${inputClass} ${filter.user_id ? inputAktif : ''}`}>
                <option value="">Semua pegawai</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Jenis absen</label>
              <select value={filter.jenis}
                onChange={(e) => setFilter({ ...filter, jenis: e.target.value })}
                className={`${inputClass} ${filter.jenis !== 'semua' ? inputAktif : ''}`}>
                {JENIS.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className={`${inputClass} ${filter.status ? inputAktif : ''}`}>
                <option value="">Semua status</option>
                <option value="hadir">Hadir</option>
                <option value="terlambat">Hadir (Terlambat)</option>
                <option value="izin">Izin</option>
                <option value="alpha">Alpha</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-line">
            <span className="text-xs text-faint">Filter aktif</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-500/30">
              {formatTanggalHari(filter.start_date)} – {formatTanggalHari(filter.end_date)}
            </span>
            {chips.map((c) => (
              <button key={c.teks} onClick={c.bersih}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-500/30 hover:bg-primary-100 dark:bg-primary-500/20 transition">
                {c.teks} <span className="text-primary-400">✕</span>
              </button>
            ))}
            <button onClick={resetFilter} className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-body ml-1">
              Reset semua
            </button>
            <select value={filter.sort}
              onChange={(e) => setFilter({ ...filter, sort: e.target.value })}
              className="ml-auto text-xs bg-surface-2 border border-line rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500/40">
              <option value="desc">Terbaru dulu</option>
              <option value="asc">Terlama dulu</option>
            </select>
          </div>
        </div>

        {/* Ringkasan */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-sm text-muted">
            <b className="text-strong font-semibold">{baris.length} hari</b>
            {jumlahPulangKosong > 0 && !hanyaSatuJenis && (
              <span className="text-red-600 dark:text-red-400"> · {jumlahPulangKosong} absen pulang belum ada</span>
            )}
          </p>
        </div>

        {loadError && (
          <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-3 mb-5">
            {loadError}
          </div>
        )}

        {loading && items.length === 0 && (
          <p className="text-sm text-faint text-center py-20">Memuat foto…</p>
        )}

        {!loading && !loadError && baris.length === 0 && (
          <div className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft py-20 text-center">
            <p className="text-sm font-medium text-body">Belum ada foto absensi</p>
            <p className="text-xs text-faint mt-1">Tidak ada foto pada rentang dan saringan ini.</p>
          </div>
        )}

        {/* Kisi kartu */}
        <div className={`grid gap-4 ${hanyaSatuJenis ? 'sm:grid-cols-3 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {baris.map((r) => (
            <div key={r.id} className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft overflow-hidden">
              {/* Nama di baris sendiri, tanggal & status di bawahnya -- badge
                  "Hadir (Terlambat)" cukup panjang dan akan memotong nama
                  kalau dipaksa sebaris di kartu yang sempit. */}
              <div className="px-3.5 py-3 border-b border-line">
                <div className="flex items-center gap-2.5">
                  <Avatar name={r.name} src={r.avatar_url} size={34} />
                  <p className="text-sm font-semibold text-strong truncate leading-tight min-w-0">{r.name}</p>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="text-[11.5px] text-faint shrink-0">{formatTanggalHari(r.date)}</span>
                  {/* WFA di luar percabangan: hari yang absen pulangnya kosong
                      tetap perlu terlihat WFA-nya, karena justru hari seperti
                      itulah yang biasanya ditelusuri admin. */}
                  <span className="flex items-center gap-1.5 shrink-0">
                    <WfaBadge mode={r.work_mode} />
                    {/* Sebelumnya lencana status DIGANTI oleh tanda "Pulang
                        kosong", sehingga pegawai yang terlambat sekaligus
                        lupa absen pulang kehilangan keterangan terlambatnya.
                        Sekarang keduanya tampil berdampingan.

                        Saat disaring ke satu jenis foto saja, tandanya
                        disembunyikan: admin memang sedang melihat foto masuk
                        saja, jadi "pulang kosong" bukan temuan. */}
                    <StatusBadge status={r.status} kurang={hanyaSatuJenis ? null : r.kurang} />
                  </span>
                </div>
              </div>

              <div className={`grid gap-px bg-surface-3 ${hanyaSatuJenis ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {filter.jenis !== 'pulang' && (
                  <SlotFoto url={r.photo_in_url} jenis="masuk" jam={r.check_in_time ? formatJam(r.check_in_time) : null}
                    token={tokenFoto} status={r.status}
                    onClick={() => setDetail({ row: r, jenis: 'masuk' })} />
                )}
                {filter.jenis !== 'masuk' && (
                  <SlotFoto url={r.photo_out_url} jenis="pulang" jam={r.check_out_time ? formatJam(r.check_out_time) : null}
                    token={tokenFoto} status={r.status}
                    onClick={() => setDetail({ row: r, jenis: 'pulang' })} />
                )}
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <button onClick={() => muat(items.length, true)} disabled={loading}
            className="w-full mt-4 bg-surface/75 backdrop-blur-xl border border-line text-body py-3 rounded-2xl text-sm font-semibold shadow-soft transition hover:border-line-strong disabled:opacity-50">
            {loading ? 'Memuat…' : 'Muat lebih banyak'}
          </button>
        )}
      </div>

      {/* Jendela detail */}
      {detail && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-surface/90 backdrop-blur-2xl border border-line rounded-2xl overflow-hidden w-full max-w-3xl grid md:grid-cols-[1.2fr_1fr] shadow-glass max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tetap gelap di kedua tema: foto absensi paling terbaca
                di atas latar hitam, bukan latar yang ikut berubah terang. */}
            <div className="bg-slate-950 flex items-center justify-center">
              <img
                src={urlFoto(detail.jenis === 'masuk' ? detail.row.photo_in_url : detail.row.photo_out_url, tokenFoto)}
                alt={`Foto absen ${detail.jenis} ${detail.row.name}`}
                className="w-full max-h-[50vh] md:max-h-[90vh] object-contain"
              />
            </div>

            <div className="p-5 flex flex-col overflow-y-auto">
              <div className="flex items-center gap-2.5">
                <Avatar name={detail.row.name} src={detail.row.avatar_url} size={38} />
                <div className="min-w-0">
                  <p className="font-bold text-strong leading-tight">{detail.row.name}</p>
                  <p className="text-xs text-muted">
                    {formatTanggalHari(detail.row.date)} · Absen {detail.jenis}
                  </p>
                </div>
              </div>

              <dl className="mt-4 text-sm">
                {[
                  ['ID pegawai', `#${detail.row.user_id}`],
                  ['Departemen', detail.row.department || '—'],
                  ['Jam masuk', formatJamDetik(detail.row.check_in_time)],
                  ['Jam pulang', formatJamDetik(detail.row.check_out_time)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2 border-b border-line">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-strong font-medium text-right tabular-nums">{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 py-2 border-b border-line">
                  <dt className="text-muted">Koordinat</dt>
                  <dd className="text-right">
                    <Koordinat latitude={detail.row.latitude} longitude={detail.row.longitude} />
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-muted">Status</dt>
                  <dd><StatusBadge status={detail.row.status} kurang={detail.row.kurang} /></dd>
                </div>
              </dl>

              <div className="mt-3 px-3 py-2.5 bg-surface-2 border border-line rounded-xl">
                <p className="text-[10.5px] text-faint mb-1">Nama berkas</p>
                <p className="text-[10.5px] font-mono text-body break-all leading-relaxed">
                  {(detail.jenis === 'masuk' ? detail.row.photo_in_url : detail.row.photo_out_url)?.split('/').pop()}
                </p>
              </div>

              <p className="text-[11px] text-faint mt-3">
                Gunakan panah ← → untuk berpindah foto, Esc untuk menutup.
              </p>

              <div className="mt-auto pt-4 flex gap-2">
                <a
                  href={urlFoto(detail.jenis === 'masuk' ? detail.row.photo_in_url : detail.row.photo_out_url, tokenFoto)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 py-2.5 rounded-xl shadow-glow transition hover:from-primary-500 hover:to-primary-600"
                >
                  Buka ukuran penuh
                </a>
                <button
                  onClick={() => setDetail(null)}
                  className="text-sm font-semibold text-body bg-surface/75 backdrop-blur-xl border border-line px-5 py-2.5 rounded-xl hover:border-line-strong transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
