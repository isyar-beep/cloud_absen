import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import AdminSidebar from '../components/AdminSidebar';
import { useDialog } from '../components/Dialog';
import { useAuthStore } from '../store/authStore';
import { BriefcaseIcon, PlusIcon, UsersIcon } from '../components/Icons';
import { formatTanggal } from '../utils/tanggal';

const FORM_KOSONG = {
  name: '', location: '', consultant_id: '', start_date: '', end_date: '', status: 'berjalan',
};

// Satu angka pada kartu proyek. Nol ditampilkan redup supaya mata langsung
// tertuju pada yang berisi -- pada papan pantau, angka nol adalah kabar baik
// yang tidak perlu menarik perhatian.
function Angka({ label, nilai, warna }) {
  const kosong = !nilai;
  return (
    <div className="flex-1 min-w-0 text-center">
      <p className={`text-xl font-bold tabular-nums leading-none ${kosong ? 'text-faint' : warna}`}>
        {nilai}
      </p>
      <p className="text-[10.5px] text-muted mt-1 truncate">{label}</p>
    </div>
  );
}

export default function AdminProjects() {
  const { user } = useAuthStore();
  const { konfirmasi, beritahu } = useDialog();
  const adminPenuh = user?.role === 'admin';

  const [proyek, setProyek] = useState([]);
  const [konsultan, setKonsultan] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [pesan, setPesan] = useState('');
  const [form, setForm] = useState(FORM_KOSONG);
  const [sedangUbah, setSedangUbah] = useState(null);
  const [formTampil, setFormTampil] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat('');
    try {
      const res = await api.get('/projects');
      setProyek(res.data);
    } catch (err) {
      setGalat(err.response?.data?.message || 'Gagal memuat daftar proyek.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  useEffect(() => {
    if (!adminPenuh) return;
    // Hanya akun berperan konsultan yang boleh jadi penanggung jawab --
    // aturan yang sama ditegakkan ulang di server.
    api.get('/users')
      .then((res) => setKonsultan(res.data.filter((u) => u.role === 'konsultan' && u.is_active)))
      .catch(() => {});
  }, [adminPenuh]);

  function bukaTambah() {
    setSedangUbah(null);
    setForm(FORM_KOSONG);
    setFormTampil(true);
  }

  function bukaUbah(p) {
    setSedangUbah(p);
    setForm({
      name: p.name || '',
      location: p.location || '',
      consultant_id: p.consultant_id || '',
      start_date: p.start_date ? String(p.start_date).slice(0, 10) : '',
      end_date: p.end_date ? String(p.end_date).slice(0, 10) : '',
      status: p.status || 'berjalan',
    });
    setFormTampil(true);
  }

  async function simpan(e) {
    e.preventDefault();
    setMenyimpan(true);
    try {
      const isi = {
        ...form,
        consultant_id: form.consultant_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };
      const res = sedangUbah
        ? await api.put(`/projects/${sedangUbah.id}`, isi)
        : await api.post('/projects', isi);
      setPesan(res.data.message);
      setFormTampil(false);
      setForm(FORM_KOSONG);
      setSedangUbah(null);
      muat();
    } catch (err) {
      await beritahu({
        judul: 'Gagal menyimpan proyek',
        pesan: err.response?.data?.message || 'Terjadi kesalahan. Coba lagi.',
      });
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus(p) {
    const setuju = await konfirmasi({
      judul: `Hapus proyek ${p.name}?`,
      pesan: 'Proyek yang sudah memiliki riwayat absensi tidak akan dihapus, '
        + 'melainkan ditandai selesai — supaya laporan lama tidak kehilangan keterangan tempatnya.',
      jenis: 'bahaya',
      tombolYa: 'Hapus',
    });
    if (!setuju) return;
    try {
      const res = await api.delete(`/projects/${p.id}`);
      setPesan(res.data.message);
      muat();
    } catch (err) {
      await beritahu({
        judul: 'Gagal menghapus',
        pesan: err.response?.data?.message || 'Terjadi kesalahan.',
      });
    }
  }

  const ringkasan = useMemo(() => ({
    total: proyek.length,
    berjalan: proyek.filter((p) => p.status === 'berjalan').length,
    pegawai: proyek.reduce((n, p) => n + p.jumlah_pegawai, 0),
    belum: proyek.reduce((n, p) => n + p.belum_absen, 0),
  }), [proyek]);

  return (
    <div className="min-h-screen lg:pl-64">
      <AdminSidebar />

      <div className="max-w-6xl mx-auto px-4 py-7">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold text-strong tracking-tight">Proyek</h1>
            <p className="text-sm text-muted mt-0.5">
              {adminPenuh
                ? 'Setiap proyek punya penanggung jawab dan pegawainya sendiri'
                : 'Proyek yang Anda tangani'}
            </p>
          </div>
          {adminPenuh && (
            <button
              onClick={bukaTambah}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl px-4 h-10 transition shadow-glow"
            >
              <PlusIcon className="w-4 h-4" /> Tambah Proyek
            </button>
          )}
        </div>

        {pesan && (
          <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/30 rounded-xl px-4 py-3 mb-4 font-medium">
            ✓ {pesan}
          </div>
        )}
        {galat && (
          <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-3 mb-4">
            {galat}
          </div>
        )}

        {/* Ringkasan seluruh proyek */}
        {proyek.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Proyek', nilai: ringkasan.total },
              { label: 'Berjalan', nilai: ringkasan.berjalan },
              { label: 'Total Pegawai', nilai: ringkasan.pegawai },
              { label: 'Belum Absen Hari Ini', nilai: ringkasan.belum, tekan: ringkasan.belum > 0 },
            ].map((k) => (
              <div key={k.label} className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft px-4 py-3.5">
                <p className={`text-2xl font-bold tabular-nums leading-none ${
                  k.tekan ? 'text-amber-600 dark:text-amber-400' : 'text-strong'
                }`}>
                  {k.nilai}
                </p>
                <p className="text-[11.5px] text-muted mt-1.5">{k.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Form tambah / ubah */}
        {formTampil && adminPenuh && (
          <form onSubmit={simpan} className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft p-5 mb-6">
            <p className="text-sm font-semibold text-strong mb-4">
              {sedangUbah ? `Ubah proyek: ${sedangUbah.name}` : 'Proyek baru'}
            </p>
            <div className="grid sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted mb-1.5">Nama proyek</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Peningkatan Jalan Ruas Malunda"
                  required
                  className="w-full text-sm bg-surface-2 border border-line rounded-xl px-3 h-10 text-strong outline-none focus:border-primary-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Lokasi</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Kab. Majene"
                  className="w-full text-sm bg-surface-2 border border-line rounded-xl px-3 h-10 text-strong outline-none focus:border-primary-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Konsultan penanggung jawab</label>
                <select
                  value={form.consultant_id}
                  onChange={(e) => setForm({ ...form, consultant_id: e.target.value })}
                  className="w-full text-sm bg-surface-2 border border-line rounded-xl px-3 h-10 text-strong outline-none focus:border-primary-500 transition"
                >
                  <option value="">Belum ditunjuk</option>
                  {konsultan.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
                {konsultan.length === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                    Belum ada akun berperan konsultan. Buat dulu di menu Pengguna.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Mulai</label>
                <input
                  type="date" value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full text-sm bg-surface-2 border border-line rounded-xl px-3 h-10 text-strong outline-none focus:border-primary-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Selesai</label>
                <input
                  type="date" value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full text-sm bg-surface-2 border border-line rounded-xl px-3 h-10 text-strong outline-none focus:border-primary-500 transition"
                />
              </div>
              {sedangUbah && (
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full text-sm bg-surface-2 border border-line rounded-xl px-3 h-10 text-strong outline-none focus:border-primary-500 transition"
                  >
                    <option value="berjalan">Berjalan</option>
                    <option value="selesai">Selesai</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="submit" disabled={menyimpan}
                className="text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60 rounded-xl px-5 h-10 transition"
              >
                {menyimpan ? 'Menyimpan…' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => { setFormTampil(false); setSedangUbah(null); setForm(FORM_KOSONG); }}
                className="text-sm font-medium text-body hover:text-strong bg-surface-2 rounded-xl px-5 h-10 transition"
              >
                Batal
              </button>
            </div>
          </form>
        )}

        {/* Kartu proyek */}
        {memuat && proyek.length === 0 && (
          <p className="text-sm text-faint text-center py-20">Memuat proyek…</p>
        )}

        {!memuat && proyek.length === 0 && !galat && (
          <div className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft py-20 text-center">
            <BriefcaseIcon className="w-9 h-9 mx-auto text-faint mb-3" />
            <p className="text-sm font-medium text-body">Belum ada proyek</p>
            <p className="text-xs text-faint mt-1">
              {adminPenuh
                ? 'Tambahkan proyek, tunjuk konsultannya, lalu tugaskan pegawai lewat menu Pengguna.'
                : 'Anda belum ditunjuk sebagai penanggung jawab proyek mana pun.'}
            </p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {proyek.map((p) => (
            <div key={p.id} className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft overflow-hidden">
              <div className="px-5 pt-4 pb-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-strong leading-snug">{p.name}</p>
                    {p.location && <p className="text-xs text-muted mt-0.5 truncate">{p.location}</p>}
                  </div>
                  <span className={`shrink-0 text-[10.5px] font-medium px-2.5 py-1 rounded-full ring-1 ring-inset ${
                    p.status === 'berjalan'
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-600/20'
                      : 'bg-surface-3 text-muted ring-line-strong/40'
                  }`}>
                    {p.status === 'berjalan' ? 'Berjalan' : 'Selesai'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <BriefcaseIcon className="w-3.5 h-3.5" />
                    {p.consultant_name || <span className="text-amber-600 dark:text-amber-400">Belum ada penanggung jawab</span>}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <UsersIcon className="w-3.5 h-3.5" />
                    {p.jumlah_pegawai} pegawai
                  </span>
                </div>

                {(p.start_date || p.end_date) && (
                  <p className="text-[11px] text-faint mt-1.5">
                    {p.start_date ? formatTanggal(p.start_date) : '—'} s/d {p.end_date ? formatTanggal(p.end_date) : '—'}
                  </p>
                )}
              </div>

              {/* Keadaan hari ini */}
              <div className="flex items-center gap-1 px-4 py-3 border-t border-line bg-surface-2/50">
                <Angka label="Hadir" nilai={p.hadir_hari_ini} warna="text-emerald-600 dark:text-emerald-400" />
                <Angka label="Izin" nilai={p.izin_hari_ini} warna="text-blue-600 dark:text-blue-400" />
                <Angka label="Alpha" nilai={p.alpha_hari_ini} warna="text-red-600 dark:text-red-400" />
                <Angka label="Belum absen" nilai={p.belum_absen} warna="text-amber-600 dark:text-amber-400" />
              </div>

              <div className="flex items-center gap-3 px-5 py-2.5 border-t border-line text-xs font-semibold">
                <a
                  href={`/admin/gallery?project_id=${p.id}`}
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Lihat foto
                </a>
                <a
                  href={`/admin/history?project_id=${p.id}`}
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Riwayat
                </a>
                {adminPenuh && (
                  <>
                    <button onClick={() => bukaUbah(p)} className="text-body hover:text-strong ml-auto">
                      Ubah
                    </button>
                    <button onClick={() => hapus(p)} className="text-red-600 dark:text-red-400 hover:underline">
                      Hapus
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
