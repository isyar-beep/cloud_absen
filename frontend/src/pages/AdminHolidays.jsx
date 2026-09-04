import { useEffect, useState } from 'react';
import api from '../api/axios';
import AdminSidebar from '../components/AdminSidebar';
import KeadaanKosong from '../components/KeadaanKosong';
import { useDialog } from '../components/Dialog';
import { PlusIcon, CalendarIcon } from '../components/Icons';
import Tombol from '../components/Tombol';
import { tanggalLokal } from '../utils/tanggal';

// Tanggal BERURUTAN dengan keterangan yang sama digabung jadi satu baris.
// Rentang disimpan sebagai baris per tanggal (lihat holidayController), dan
// tanpa penggabungan ini "Libur Idulfitri" sepanjang sepuluh hari tampil
// sebagai sepuluh baris yang sama persis -- daftarnya jadi panjang tanpa
// menambah keterangan apa pun.
//
// Yang digabung hanya yang benar-benar bersambung: dua tanggal dengan nama
// sama tapi terpisah seminggu tetap dua baris, karena memang dua kejadian.
function kelompokkan(daftar) {
  const hasil = [];
  for (const h of daftar) {
    const akhir = hasil[hasil.length - 1];
    const besoknya = akhir && new Date(`${akhir.selesai}T00:00:00Z`);
    if (besoknya) besoknya.setUTCDate(besoknya.getUTCDate() + 1);

    if (akhir && akhir.name === h.name && besoknya.toISOString().slice(0, 10) === h.date) {
      akhir.selesai = h.date;
      akhir.ids.push(h.id);
    } else {
      hasil.push({ name: h.name, mulai: h.date, selesai: h.date, ids: [h.id] });
    }
  }
  return hasil;
}

export default function AdminHolidays() {
  const [holidays, setHolidays] = useState([]);
  const { konfirmasi } = useDialog();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', end_date: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHolidays();
  }, []);

  async function fetchHolidays() {
    const res = await api.get('/holidays');
    setHolidays(res.data);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Tanggal selesai kosong berarti libur sehari; server memperlakukan
      // ketiadaannya sebagai "sama dengan tanggal mulai".
      await api.post('/holidays', {
        date: form.date,
        end_date: form.end_date || undefined,
        name: form.name,
      });
      setForm({ date: '', end_date: '', name: '' });
      setShowForm(false);
      fetchHolidays();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menambah hari libur.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(kelompok) {
    const banyak = kelompok.ids.length > 1;
    const setuju = await konfirmasi({
      judul: `Hapus hari libur "${kelompok.name}"?`,
      pesan: banyak
        ? `Seluruh ${kelompok.ids.length} tanggal pada rentang ini dihapus, dan absen di tanggal-tanggal itu terbuka kembali untuk semua pegawai.`
        : 'Absen di tanggal itu akan terbuka kembali untuk semua pegawai.',
      tombolYa: banyak ? `Hapus ${kelompok.ids.length} tanggal` : 'Hapus',
    });
    if (!setuju) return;
    // Satu permintaan untuk seluruh rentang: kalau ditembak satu per satu,
    // kegagalan di tengah menyisakan rentang yang terpotong separuh.
    await api.delete(`/holidays/${kelompok.ids.join(',')}`);
    fetchHolidays();
  }

  function formatTanggal(d) {
    return tanggalLokal(d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  // "8–10 September 2026" bila sebulan sama, jika tidak ditulis lengkap
  // kedua ujungnya.
  function formatRentang(k) {
    if (k.mulai === k.selesai) return formatTanggal(k.mulai);
    const a = tanggalLokal(k.mulai);
    const b = tanggalLokal(k.selesai);
    const opsi = { day: 'numeric', month: 'long', year: 'numeric' };
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
      return `${a.getDate()}–${b.toLocaleDateString('id-ID', opsi)}`;
    }
    return `${a.toLocaleDateString('id-ID', opsi)} – ${b.toLocaleDateString('id-ID', opsi)}`;
  }

  const kelompok = kelompokkan(holidays);

  const inputClass =
    'px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-sm transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40 focus:border-primary-300';
  const labelClass = 'block text-xs font-medium text-muted mb-1.5';

  return (
    <div className="min-h-screen transition-[padding] duration-200 lg:pl-[var(--lebar-sidebar)]">
      <AdminSidebar />

      <div className="wadah-petak px-5 lg:px-8 py-7">
        <div className="flex justify-between items-center mb-6 gap-3">
          <div>
            <h1 className="text-[1.75rem] leading-tight font-extrabold text-strong tracking-[-0.02em]">Hari Libur</h1>
            <p className="text-sm text-body mt-0.5">
              {holidays.length} tanggal terdaftar — Sabtu &amp; Minggu otomatis dianggap bukan hari kerja
            </p>
          </div>
          <Tombol ikon={PlusIcon} onClick={() => { setShowForm(!showForm); setError(''); }}>
            Tambah
          </Tombol>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="kartu-kaca max-w-4xl p-5 mb-6 space-y-4">
            <p className="text-[17px] font-bold text-strong tracking-[-0.01em]">Hari Libur Baru</p>
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Tanggal mulai</label>
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div>
                <label className={labelClass}>Sampai tanggal</label>
                <input
                  type="date"
                  min={form.date}
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className={`${inputClass} w-full`}
                />
                <p className="text-[11px] text-faint mt-1">Kosongkan bila libur sehari</p>
              </div>
              <div>
                <label className={labelClass}>Keterangan</label>
                <input
                  required
                  placeholder="mis. Hari Kemerdekaan"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`${inputClass} w-full`}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Tombol type="submit" rupa="ink" disabled={loading}>
                {loading ? 'Menyimpan…' : 'Simpan'}
              </Tombol>
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

        <div className={holidays.length ? 'kartu-kaca daftar-pil' : 'kartu-kaca'}>
          {kelompok.map((k) => (
            <div key={k.ids[0]} className="baris-pil flex justify-between items-center gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-strong truncate">{k.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  {formatRentang(k)}
                  {k.ids.length > 1 && (
                    <span className="text-faint"> · {k.ids.length} hari</span>
                  )}
                </p>
              </div>
              <button onClick={() => handleDelete(k)} className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 transition shrink-0">
                Hapus
              </button>
            </div>
          ))}
          {holidays.length === 0 && (
            <KeadaanKosong
              ikon={CalendarIcon}
              judul="Belum ada hari libur"
              pesan="Hari libur yang didaftarkan di sini akan dikecualikan dari penandaan alpha otomatis."
            />
          )}
        </div>
      </div>
    </div>
  );
}
