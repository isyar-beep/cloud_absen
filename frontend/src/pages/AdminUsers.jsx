import { useEffect, useState } from 'react';
import api from '../api/axios';
import AdminSidebar from '../components/AdminSidebar';
import Pilihan, { KELAS_PILIHAN } from '../components/Pilihan';
import { useDialog } from '../components/Dialog';
import { useAuthStore } from '../store/authStore';
import { PlusIcon } from '../components/Icons';
import Avatar from '../components/Avatar';
import { namaPeran, WARNA_PERAN } from '../utils/peran';
import Tombol from '../components/Tombol';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const { konfirmasi } = useDialog();
  const user = useAuthStore((s) => s.user);
  const [shifts, setShifts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', shift_id: '', project_id: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Dibedakan dari `error` (kegagalan form) -- ini kegagalan memuat daftar.
  // Tanpa ini, request yang gagal cuma menampilkan tabel kosong dan terlihat
  // seolah semua akun terhapus.
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchUsers();
    api.get('/shifts').then((res) => setShifts(res.data)).catch(console.error);
    // Proyek yang sudah selesai tidak ditawarkan sebagai penugasan baru,
    // tapi tetap terbaca pada pegawai yang sudah terlanjur di sana.
    api.get('/projects')
      .then((res) => setProjects(res.data.filter((x) => x.status === 'berjalan')))
      .catch(console.error);
  }, []);

  async function fetchUsers() {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
      setLoadError('');
    } catch (err) {
      setLoadError(
        err.response?.data?.message ||
        'Gagal memuat daftar pengguna. Periksa koneksi ke server, lalu muat ulang halaman.'
      );
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/users', {
        ...form,
        shift_id: form.shift_id || null,
        project_id: form.project_id || null,
      });
      setForm({ name: '', email: '', password: '', role: 'staff', shift_id: '', project_id: '' });
      setShowForm(false);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuat pengguna.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(userItem) {
    if (userItem.is_active) {
      const setuju = await konfirmasi({
        judul: `Nonaktifkan akun ${userItem.name}?`,
        pesan: 'Akunnya tidak bisa dipakai login dan tidak ikut dihitung di statistik. '
          + 'Riwayat absensinya tetap tersimpan, dan akun ini bisa diaktifkan lagi kapan saja.',
        tombolYa: 'Nonaktifkan',
      });
      if (!setuju) return;
      await api.delete(`/users/${userItem.id}`);
    } else {
      await api.put(`/users/${userItem.id}`, { is_active: true });
    }
    fetchUsers();
  }

  async function changeShift(userItem, shiftId) {
    await api.put(`/users/${userItem.id}`, { shift_id: shiftId ? Number(shiftId) : null });
    fetchUsers();
  }

  async function changeProject(userItem, projectId) {
    await api.put(`/users/${userItem.id}`, { project_id: projectId ? Number(projectId) : null });
    fetchUsers();
  }

  const inputClass =
    'px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-sm transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40 focus:border-primary-300';
  const labelClass = 'block text-xs font-medium text-muted mb-1.5';
  const pilihanClass =
    'w-full text-xs bg-surface-2 border border-line rounded-lg px-2 py-1.5 text-body focus:outline-none focus:ring-2 focus:ring-primary-500/40';

  return (
    <div className="min-h-screen transition-[padding] duration-200 lg:pl-[var(--lebar-sidebar)]">
      <AdminSidebar />

      <div className="wadah-petak px-5 lg:px-8 py-7">
        <div className="flex justify-between items-center mb-6 gap-3">
          <div>
            <h1 className="text-[1.75rem] leading-tight font-extrabold text-strong tracking-[-0.02em]">Kelola Pengguna</h1>
            <p className="text-sm text-body mt-0.5">{users.length} akun terdaftar</p>
          </div>
          <Tombol ikon={PlusIcon} onClick={() => setShowForm(!showForm)}>
            Tambah Pengguna
          </Tombol>
        </div>

        {loadError && (
          <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-3 mb-5">
            {loadError}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="kartu-kaca max-w-4xl p-5 mb-6 space-y-4">
            <p className="text-[17px] font-bold text-strong tracking-[-0.01em]">Pengguna Baru</p>
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Nama lengkap</label>
                <input
                  required
                  placeholder="mis. Budi Santoso"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  required
                  type="email"
                  placeholder="nama@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div>
                <label className={labelClass}>Password sementara</label>
                <input
                  required
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div>
                <label className={labelClass}>Role</label>
                <Pilihan
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  ariaLabel="Peran"
                  className={`${KELAS_PILIHAN} w-full`}
                  options={[
                    { value: 'staff', label: 'Pegawai' },
                    { value: 'konsultan', label: 'Konsultan' },
                    { value: 'admin', label: 'Admin (Dinas)' },
                  ]}
                />
              </div>
              {form.role === 'staff' && (
                <div className="sm:col-span-2">
                  <label className={labelClass}>Proyek penugasan</label>
                  <Pilihan
                    value={form.project_id}
                    onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                    ariaLabel="Proyek penugasan"
                    className={`${KELAS_PILIHAN} w-full`}
                    options={[
                      { value: '', label: 'Belum ditugaskan' },
                      ...projects.map((p) => ({
                        value: p.id,
                        label: `${p.name}${p.location ? ` — ${p.location}` : ''}`,
                      })),
                    ]}
                  />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className={labelClass}>Shift kerja</label>
                <Pilihan
                  value={form.shift_id}
                  onChange={(e) => setForm({ ...form, shift_id: e.target.value })}
                  ariaLabel="Shift kerja"
                  className={`${KELAS_PILIHAN} w-full`}
                  options={[
                    { value: '', label: 'Tanpa shift (batas telat default 08:00)' },
                    ...shifts.map((sh) => ({
                      value: sh.id,
                      label: `${sh.name} (${sh.start_time}–${sh.end_time})`,
                    })),
                  ]}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-ink text-on-ink px-5 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-ink/90 disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Pengguna'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-muted px-3 hover:text-body transition"
              >
                Batal
              </button>
            </div>
          </form>
        )}

        {/* Daftar akun.
            Dulu tabel enam kolom yang memaksa halaman digeser ke kanan --
            dan kolom paling kanan, yang justru berisi tombol, adalah yang
            paling sering tidak terlihat. Sekarang tiap akun jadi satu baris
            kartu yang melipat sendiri saat layarnya sempit, jadi tidak ada
            lagi isi yang tersembunyi di luar layar. */}
        <div className="kartu-kaca daftar-pil">
          {users.map((u) => (
            <div
              key={u.id}
              className="baris-pil flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5"
            >
              {/* Identitas -- melebar mengisi sisa ruang */}
              <div className="flex items-center gap-3 min-w-[12rem] flex-1">
                <Avatar name={u.name} src={u.avatar_url} />
                <div className="min-w-0">
                  <p className="font-medium text-strong truncate leading-tight">{u.name}</p>
                  <p className="text-xs text-faint truncate">{u.email}</p>
                </div>
              </div>

              {/* Tiap kolom duduk di WADAH berlebar tetap, bukan mengikuti
                  lebar isinya. Lencana peran panjangnya berbeda-beda
                  ("Dinas" jauh lebih pendek daripada "Konsultan"), dan
                  tanpa wadah tetap seluruh kolom sesudahnya ikut bergeser
                  baris demi baris -- yang terbaca sebagai daftar miring. */}
              <div className="w-[5.5rem] shrink-0">
                <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ring-1 ring-inset whitespace-nowrap ${
                  WARNA_PERAN[u.role] || WARNA_PERAN.staff
                }`}>
                  {namaPeran(u.role)}
                </span>
              </div>

              {/* Penugasan proyek hanya bermakna untuk pegawai. Konsultan
                  ditunjuk sebagai penanggung jawab lewat halaman Proyek,
                  dan admin tidak absen sama sekali. */}
              <div className="w-[9.5rem] shrink-0">
              {u.role === 'staff' ? (
                <Pilihan
                  value={u.project_id || ''}
                  onChange={(e) => changeProject(u, e.target.value)}
                  ariaLabel={`Proyek untuk ${u.name}`}
                  className={pilihanClass}
                  options={[
                    { value: '', label: 'Belum ditugaskan' },
                    ...projects.map((pr) => ({ value: pr.id, label: pr.name })),
                    // Proyek yang sudah selesai tidak ada di daftar di atas;
                    // tanpa baris ini, penugasan lama tampil kosong seolah
                    // pegawainya tidak pernah ditugaskan.
                    ...(u.project_id && !projects.some((pr) => pr.id === u.project_id)
                      ? [{ value: u.project_id, label: `${u.project_name} (selesai)` }]
                      : []),
                  ]}
                />
              ) : (
                <span className="text-xs text-faint">Tanpa proyek</span>
              )}
              </div>

              <div className="w-[9.5rem] shrink-0">
              <Pilihan
                value={u.shift_id || ''}
                onChange={(e) => changeShift(u, e.target.value)}
                ariaLabel={`Shift untuk ${u.name}`}
                className={pilihanClass}
                options={[
                  { value: '', label: 'Tanpa shift (08:00)' },
                  ...shifts.map((sh) => ({
                    value: sh.id,
                    label: `${sh.name} (${sh.start_time}-${sh.end_time})`,
                  })),
                ]}
              />
              </div>

              <div className="w-[5.5rem] shrink-0">
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ring-inset whitespace-nowrap ${
                u.is_active
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-600/20'
                  : 'bg-surface-3 text-muted ring-line-strong/40'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-faint'}`} />
                {u.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
              </div>

              {/* Baris akun sendiri tidak menawarkan tombolnya. Server juga
                  menolak, tapi menawarkan tombol yang pasti gagal hanya
                  membuat orang mencoba lalu bingung. */}
              <div className="ml-auto shrink-0 min-w-[6.5rem] text-right">
                {u.id === user?.id ? (
                  <span className="text-xs text-faint">Akun Anda</span>
                ) : (
                  <button
                    onClick={() => toggleActive(u)}
                    className={`text-xs font-semibold transition ${
                      u.is_active
                        ? 'text-red-600 hover:text-red-700 dark:text-red-400'
                        : 'text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300'
                    }`}
                  >
                    {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
