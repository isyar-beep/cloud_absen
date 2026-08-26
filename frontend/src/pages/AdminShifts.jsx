import { useEffect, useState } from 'react';
import api from '../api/axios';
import AdminHeader from '../components/AdminHeader';
import { useDialog } from '../components/Dialog';
import { PlusIcon } from '../components/Icons';
import AdminWfa from './AdminWfa';

// Nilai bawaan jendela absen, sama dengan default di migration 005.
// 0=Minggu ... 6=Sabtu, penomoran yang sama dengan getDay() dan
// EXTRACT(DOW) di Postgres. Ditampilkan mulai Senin karena begitulah
// minggu kerja dibaca orang, bukan karena urutan angkanya.
const HARI = [
  { n: 1, label: 'Sen' },
  { n: 2, label: 'Sel' },
  { n: 3, label: 'Rab' },
  { n: 4, label: 'Kam' },
  { n: 5, label: 'Jum' },
  { n: 6, label: 'Sab' },
  { n: 0, label: 'Min' },
];

const HARI_AWAL = [1, 2, 3, 4, 5];

const JENDELA_AWAL = {
  checkin_open_minutes: 30,
  checkin_close_minutes: 240,
  checkout_open_minutes: 15,
  checkout_close_minutes: 360,
};

const JENDELA_FIELD = [
  { key: 'checkin_open_minutes', label: 'Masuk dibuka', bantu: 'menit sebelum jam masuk' },
  { key: 'checkin_close_minutes', label: 'Masuk ditutup', bantu: 'menit setelah jam masuk' },
  { key: 'checkout_open_minutes', label: 'Pulang dibuka', bantu: 'menit sebelum jam pulang' },
  { key: 'checkout_close_minutes', label: 'Pulang ditutup', bantu: 'menit setelah jam pulang' },
];

// "07.30" dari jam "08:00" dikurangi 30 menit -- dipakai untuk memperlihatkan
// jendela yang akan berlaku, supaya admin tidak perlu berhitung sendiri.
function geserJam(jam, menit) {
  const [h, m] = String(jam).split(':').map(Number);
  if (Number.isNaN(h)) return '—';
  const total = ((h * 60 + m + menit) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}.${String(total % 60).padStart(2, '0')}`;
}

// Shift yang jam pulangnya tidak lebih besar dari jam masuk menyeberang
// tengah malam (mis. 22:00-06:00).
function lintasHari(mulai, selesai) {
  const ke = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  return ke(selesai) <= ke(mulai);
}

export default function AdminShifts() {
  // Shift dan WFA sama-sama "penjadwalan cara kerja pegawai", jadi digabung
  // di satu halaman sebagai tab daripada menambah menu baru di bilah navigasi.
  const [tab, setTab] = useState('shift');
  const { konfirmasi } = useDialog();
  const [shifts, setShifts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', start_time: '08:00', end_time: '17:00', work_days: HARI_AWAL, ...JENDELA_AWAL });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchShifts();
  }, []);

  async function fetchShifts() {
    const res = await api.get('/shifts');
    setShifts(res.data);
  }

  function openCreateForm() {
    setEditingId(null);
    setForm({ name: '', start_time: '08:00', end_time: '17:00', work_days: HARI_AWAL, ...JENDELA_AWAL });
    setError('');
    setShowForm(true);
  }

  function openEditForm(shift) {
    setEditingId(shift.id);
    setForm({
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      work_days: shift.work_days?.length ? shift.work_days : HARI_AWAL,
      checkin_open_minutes: shift.checkin_open_minutes ?? JENDELA_AWAL.checkin_open_minutes,
      checkin_close_minutes: shift.checkin_close_minutes ?? JENDELA_AWAL.checkin_close_minutes,
      checkout_open_minutes: shift.checkout_open_minutes ?? JENDELA_AWAL.checkout_open_minutes,
      checkout_close_minutes: shift.checkout_close_minutes ?? JENDELA_AWAL.checkout_close_minutes,
    });
    setError('');
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/shifts/${editingId}`, form);
      } else {
        await api.post('/shifts', form);
      }
      setShowForm(false);
      fetchShifts();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan shift.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(shift) {
    const setuju = await konfirmasi({
      judul: `Hapus shift "${shift.name}"?`,
      pesan: shift.jumlah_pegawai > 0
        ? `${shift.jumlah_pegawai} pegawai memakai shift ini dan akan menjadi tanpa shift — jam kerjanya kembali ke bawaan 08.00–17.00, Senin–Jumat.`
        : 'Tidak ada pegawai yang memakai shift ini.',
      tombolYa: 'Hapus shift',
    });
    if (!setuju) return;
    await api.delete(`/shifts/${shift.id}`);
    fetchShifts();
  }

  const inputClass =
    'px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-sm transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40 focus:border-primary-300';
  const labelClass = 'block text-xs font-medium text-muted mb-1.5';

  return (
    <div className="min-h-screen">
      <AdminHeader />

      <div className="max-w-4xl mx-auto px-4 py-7">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-strong tracking-tight">Shift &amp; WFA</h1>
          <p className="text-sm text-muted mt-0.5">
            {tab === 'shift'
              ? `${shifts.length} shift terdaftar — menentukan batas jam telat dan jendela waktu absen`
              : 'Tetapkan rentang tanggal pegawai bekerja dari luar kantor'}
          </p>
        </div>

        <div className="flex gap-2 mb-5 border-b border-line">
          {[
            { key: 'shift', label: 'Shift Kerja' },
            { key: 'wfa', label: 'WFA' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
                tab === t.key
                  ? 'border-primary-600 text-primary-700 dark:text-primary-300'
                  : 'border-transparent text-muted hover:text-strong'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'wfa' && <AdminWfa />}

        {tab === 'shift' && (
        <>
        <div className="flex justify-end mb-4">
          <button
            onClick={openCreateForm}
            className="flex items-center gap-1.5 text-sm bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600"
          >
            <PlusIcon className="w-4 h-4" />
            Tambah Shift
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft p-5 mb-6 space-y-4">
            <p className="text-sm font-semibold text-strong">{editingId ? 'Edit Shift' : 'Shift Baru'}</p>
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Nama shift</label>
                <input
                  required
                  placeholder="mis. Shift Pagi"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div>
                <label className={labelClass}>Jam masuk</label>
                <input
                  required
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div>
                <label className={labelClass}>Jam pulang</label>
                <input
                  required
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
            </div>
            {lintasHari(form.start_time, form.end_time) && (
              <p className="text-xs text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/15 border border-violet-100 dark:border-violet-500/30 rounded-xl px-3 py-2">
                Shift ini menyeberang tengah malam. Absen masuk dan absen pulangnya
                tetap dihitung sebagai satu shift yang sama, meski jatuh di dua tanggal.
              </p>
            )}

            <div>
              <p className="text-xs font-semibold text-body mb-1">Hari kerja</p>
              <p className="text-xs text-faint mb-2.5">
                Di hari yang tidak dicentang, absen ditutup untuk pegawai shift ini
                dan penanda alpha tidak berjalan. Hari libur nasional tetap berlaku
                untuk semua shift.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {HARI.map((h) => {
                  const aktif = form.work_days.includes(h.n);
                  return (
                    <button
                      key={h.n}
                      type="button"
                      aria-pressed={aktif}
                      onClick={() => setForm({
                        ...form,
                        work_days: aktif
                          ? form.work_days.filter((x) => x !== h.n)
                          : [...form.work_days, h.n].sort((a, b) => a - b),
                      })}
                      className={`text-xs font-semibold px-3 py-2 rounded-xl border transition ${
                        aktif
                          ? 'bg-primary-600 border-primary-600 text-white shadow-glow'
                          : 'bg-surface-2 border-line text-muted hover:border-line-strong hover:text-body'
                      }`}
                    >
                      {h.label}
                    </button>
                  );
                })}
              </div>
              {form.work_days.length === 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  Pilih minimal satu hari, kalau tidak pegawai shift ini tidak akan pernah bisa absen.
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-body mb-1">Jendela waktu absen</p>
              <p className="text-xs text-faint mb-2.5">
                Di luar jendela ini absen ditolak. Dihitung dalam menit terhadap jam
                shift, jadi aturannya ikut bergeser kalau jam shift diubah.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {JENDELA_FIELD.map((f) => (
                  <div key={f.key}>
                    <label className={labelClass}>{f.label}</label>
                    <input
                      required
                      type="number"
                      min="0"
                      max="1440"
                      value={form[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value === '' ? '' : Number(e.target.value) })}
                      className={`${inputClass} w-full`}
                    />
                    <p className="text-[11px] text-faint mt-1">{f.bantu}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted mt-2.5">
                Absen masuk: <span className="font-semibold tabular-nums">{geserJam(form.start_time, -form.checkin_open_minutes)}–{geserJam(form.start_time, form.checkin_close_minutes)}</span>
                {' · '}
                Absen pulang: <span className="font-semibold tabular-nums">{geserJam(form.end_time, -form.checkout_open_minutes)}–{geserJam(form.end_time, form.checkout_close_minutes)}</span>
              </p>
            </div>

            <p className="text-xs text-faint">
              Pegawai yang check-in setelah jam masuk shift ini otomatis tercatat "terlambat".
            </p>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || form.work_days.length === 0}
                className="bg-ink text-on-ink px-5 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-ink/90 disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Shift'}
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

        <div className="bg-surface/75 backdrop-blur-xl rounded-2xl border border-line shadow-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Shift</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Jam Kerja</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Hari Kerja</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Jendela Absen</th>
                <th className="text-left px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Pegawai</th>
                <th className="text-right px-5 py-3.5 font-semibold text-muted text-xs uppercase tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-b-0 hover:bg-surface-2/60 transition">
                  <td className="px-5 py-3.5 font-medium text-strong">{s.name}</td>
                  <td className="px-5 py-3.5 text-body tabular-nums whitespace-nowrap">
                    {s.start_time} — {s.end_time}
                    {s.lintas_hari && <span className="text-[11px] text-violet-600 dark:text-violet-400 ml-1.5">+1 hari</span>}
                  </td>
                  <td className="px-5 py-3.5 text-body text-xs whitespace-nowrap">{s.hari_kerja_teks}</td>
                  <td className="px-5 py-3.5 text-muted text-xs tabular-nums whitespace-nowrap">
                    <div>Masuk {geserJam(s.start_time, -s.checkin_open_minutes)}–{geserJam(s.start_time, s.checkin_close_minutes)}</div>
                    <div>Pulang {geserJam(s.end_time, -s.checkout_open_minutes)}–{geserJam(s.end_time, s.checkout_close_minutes)}</div>
                  </td>
                  <td className="px-5 py-3.5 text-body">{s.jumlah_pegawai} orang</td>
                  <td className="px-5 py-3.5 text-right space-x-3">
                    <button onClick={() => openEditForm(s)} className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(s)} className="text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400 transition">
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-sm text-faint px-5 py-12">
                    Belum ada shift. Tambahkan shift pertama.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
