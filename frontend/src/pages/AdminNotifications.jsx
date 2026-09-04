import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AdminSidebar from '../components/AdminSidebar';
import KeadaanKosong from '../components/KeadaanKosong';
import { KerangkaBaris } from '../components/Kerangka';
import { useNotifStore } from '../store/notifStore';
import { formatJam, jamLokal, tanggalIso } from '../utils/tanggal';
import {
  DocumentIcon, ClockIcon, CheckIcon, BellIcon,
} from '../components/Icons';

// ============================================================
// Halaman Pemberitahuan.
//
// Semula ini hanya panel kecil yang menggantung dari lonceng. Bentuk itu
// cukup untuk "ada tiga hal baru", tapi tidak untuk menelusuri: satu
// dinas menerima pemberitahuan dari SETIAP pegawai di SEMUA proyek, jadi
// dalam sebulan daftarnya ratusan baris. Panel selebar 19rem yang
// menggantung di atas menu bukan tempat membaca ratusan baris.
//
// Halaman penuh memberi tiga hal yang tidak mungkin ada di panel:
// penyaring, pengelompokan per hari, dan ruang untuk membaca kalimatnya
// tanpa terpotong.
// ============================================================

const SEHALAMAN = 25;

const SARINGAN = [
  { key: 'semua', label: 'Semua' },
  { key: 'belum', label: 'Belum dibaca' },
];

// Rupa per jenis kejadian: ikon plus warnanya. Pengajuan yang MASUK dan
// pengajuan yang sudah DIPUTUS menuntut hal berbeda -- yang satu minta
// dikerjakan, yang satu cuma kabar -- jadi keduanya tidak boleh tampil
// serupa. Jenis yang belum dikenal tetap dapat rupa yang masuk akal,
// supaya halaman ini tidak rusak kalau server lebih baru daripada layar.
const RUPA = {
  pengajuan_baru: { icon: DocumentIcon, kelas: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15' },
  koreksi_baru: { icon: ClockIcon, kelas: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15' },
  pengajuan_diputus: { icon: CheckIcon, kelas: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15' },
  koreksi_diputus: { icon: CheckIcon, kelas: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15' },
};
const RUPA_BAWAAN = { icon: BellIcon, kelas: 'text-muted bg-surface-2' };

// "Hari ini" / "Kemarin" / nama hari lengkap. Tanggal mentah pada tiap
// baris membuat mata bekerja dua kali; kepala kelompok mengerjakannya
// sekali untuk seluruh kelompok.
function kepalaHari(iso) {
  const hariIni = tanggalIso(new Date());
  const kemarin = new Date();
  kemarin.setDate(kemarin.getDate() - 1);
  if (iso === hariIni) return 'Hari ini';
  if (iso === tanggalIso(kemarin)) return 'Kemarin';
  return jamLokal(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// Kelompokkan menurut tanggal, urutannya dipertahankan apa adanya dari
// server (terbaru dulu).
function perHari(items) {
  const keluar = [];
  for (const n of items) {
    const iso = tanggalIso(jamLokal(n.created_at));
    const akhir = keluar[keluar.length - 1];
    if (akhir && akhir.iso === iso) akhir.items.push(n);
    else keluar.push({ iso, items: [n] });
  }
  return keluar;
}

export default function AdminNotifications() {
  const [items, setItems] = useState([]);
  const [adaLagi, setAdaLagi] = useState(false);
  const [saringan, setSaringan] = useState('semua');
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const navigate = useNavigate();
  const belum = useNotifStore((s) => s.belum);
  const setelBelum = useNotifStore((s) => s.setel);
  const kurangiBelum = useNotifStore((s) => s.kurangi);

  const muat = useCallback(async (offset = 0, tambah = false) => {
    if (!tambah) setMemuat(true);
    setGalat('');
    try {
      // Satu baris lebih daripada yang ditampilkan, semata untuk menjawab
      // "masih ada lagi?" -- sama seperti daftar lain di sistem ini.
      const params = { limit: SEHALAMAN + 1, offset };
      if (saringan === 'belum') params.belum = '1';
      const res = await api.get('/notifications/saya', { params });
      const baris = res.data.items.slice(0, SEHALAMAN);
      setItems((d) => (tambah ? [...d, ...baris] : baris));
      setAdaLagi(res.data.items.length > SEHALAMAN);
      setelBelum(res.data.belum_dibaca);
    } catch (err) {
      setGalat(err.response?.data?.message || 'Gagal memuat pemberitahuan.');
    } finally {
      setMemuat(false);
    }
  }, [saringan, setelBelum]);

  useEffect(() => { muat(); }, [muat]);

  function buka(n) {
    if (!n.dibaca) {
      // Ditandai di layar lebih dulu supaya terasa seketika; kalau
      // permintaannya gagal, pemuatan berikutnya mengembalikannya.
      setItems((d) => d.map((x) => (x.id === n.id ? { ...x, dibaca: true } : x)));
      kurangiBelum();
      api.put(`/notifications/${n.id}/baca`).catch(() => {});
    }
    if (n.tautan) navigate(n.tautan);
  }

  async function bacaSemua() {
    setItems((d) => d.map((x) => ({ ...x, dibaca: true })));
    setelBelum(0);
    try {
      await api.put('/notifications/baca-semua');
    } finally {
      // Pada tab "Belum dibaca", menandai semua membuat isinya memang
      // habis. Dimuat ulang supaya daftarnya jujur, bukan menyisakan
      // baris yang sebenarnya sudah tidak masuk saringan.
      if (saringan === 'belum') muat();
    }
  }

  const kelompok = perHari(items);

  return (
    <div className="min-h-screen transition-[padding] duration-200 lg:pl-[var(--lebar-sidebar)]">
      <AdminSidebar />

      {/* Seluruh halaman dibatasi selebar daftarnya, bukan hanya daftarnya
          saja. Kalau hanya daftar yang dibatasi, tombol "Tandai semua
          dibaca" melayang sendirian di ujung kanan layar lebar -- jauh
          dari barang yang ditandainya. */}
      <div className="wadah-petak px-5 lg:px-8 py-7 max-w-4xl">
        <div className="flex justify-between items-center mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-[1.75rem] leading-tight font-extrabold text-strong tracking-[-0.02em]">
              Pemberitahuan
            </h1>
            <p className="text-sm text-body mt-0.5">
              {belum > 0
                ? `${belum} belum dibaca`
                : 'Semua sudah dibaca'}
            </p>
          </div>
          {belum > 0 && (
            <button
              onClick={bacaSemua}
              className="text-sm font-semibold px-4 py-2 rounded-full bg-surface/75 backdrop-blur-xl border border-line text-body transition hover:border-line-strong hover:text-strong"
            >
              Tandai semua dibaca
            </button>
          )}
        </div>

        <div className="flex gap-2 mb-5">
          {SARINGAN.map((f) => (
            <button
              key={f.key}
              onClick={() => setSaringan(f.key)}
              className={`text-sm px-4 py-2 rounded-full font-medium transition ${
                saringan === f.key
                  ? 'bg-primary-600 text-white shadow-glow'
                  : 'bg-surface/75 backdrop-blur-xl border border-line text-body hover:border-line-strong'
              }`}
            >
              {f.label}
              {f.key === 'belum' && belum > 0 && (
                <span className={`ml-2 text-[11px] font-bold ${saringan === f.key ? 'text-white/80' : 'text-primary-600 dark:text-primary-400'}`}>
                  {belum}
                </span>
              )}
            </button>
          ))}
        </div>

        {galat && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-100 dark:border-red-500/30 rounded-xl px-4 py-3 mb-5">
            {galat}
          </div>
        )}

        {memuat ? (
          <KerangkaBaris jumlah={6} />
        ) : items.length === 0 ? (
          <KeadaanKosong
            judul={saringan === 'belum' ? 'Tidak ada yang belum dibaca' : 'Belum ada pemberitahuan'}
            pesan={
              saringan === 'belum'
                ? 'Semua pemberitahuan sudah Anda buka.'
                : 'Pengajuan izin, sakit, cuti, dan koreksi absensi dari pegawai akan muncul di sini.'
            }
            jenis={saringan === 'belum' ? 'saringan' : 'kosong'}
            aksi={saringan === 'belum' ? { label: 'Lihat semua', onClick: () => setSaringan('semua') } : undefined}
          />
        ) : (
          <div className="space-y-6">
            {kelompok.map((hari) => (
              <div key={hari.iso}>
                <p className="px-1 mb-2 text-[11px] font-extrabold uppercase tracking-[0.13em] text-faint">
                  {kepalaHari(hari.iso)}
                </p>
                <div className="daftar-pil">
                  {hari.items.map((n) => {
                    const rupa = RUPA[n.jenis] || RUPA_BAWAAN;
                    return (
                      <button
                        key={n.id}
                        onClick={() => buka(n)}
                        className={`baris-pil w-full text-left flex items-start gap-3.5 transition ${
                          n.dibaca ? '' : 'ring-1 ring-primary-500/25'
                        }`}
                      >
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${rupa.kelas}`}>
                          <rupa.icon className="w-[18px] h-[18px]" />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm leading-snug ${n.dibaca ? 'text-body' : 'font-bold text-strong'}`}>
                            {n.judul}
                          </span>
                          {n.pesan && (
                            <span className="block text-[13px] text-muted mt-0.5 leading-snug">{n.pesan}</span>
                          )}
                        </span>

                        <span className="flex items-center gap-2.5 shrink-0">
                          <span className="text-[11px] text-faint tabular-nums">{formatJam(n.created_at)}</span>
                          {/* Titik biru hanya pada yang belum dibaca. Tanpa
                              penanda, yang sudah dibuka dan yang belum
                              terlihat sama saja. */}
                          <span className={`w-2 h-2 rounded-full ${n.dibaca ? 'bg-transparent' : 'bg-primary-500'}`} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {adaLagi && (
              <button
                onClick={() => muat(items.length, true)}
                className="w-full bg-surface/75 backdrop-blur-xl border border-line text-body py-3 rounded-2xl text-sm font-semibold shadow-soft transition hover:border-line-strong"
              >
                Muat lebih banyak
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
