import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { urlFoto, useTokenFoto } from '../api/fileUrl';
import StatusBadge from '../components/StatusBadge';
import AjukanKoreksiModal from '../components/AjukanKoreksiModal';
import { ArrowLeftIcon } from '../components/Icons';
import { formatTanggalHari, formatJam } from '../utils/tanggal';
import {
  NAMA_BULAN, daftarTahun, rentangBulan, rentangPreset, rentangTahun,
} from '../utils/periode';

const LIMIT = 30;

const TAB = [
  { id: '', label: 'Semua' },
  { id: 'hadir', label: 'Hadir' },
  { id: 'terlambat', label: 'Terlambat' },
  { id: 'izin', label: 'Izin' },
  { id: 'alpha', label: 'Alpha' },
];

const PRESET = [
  { id: 'minggu_ini', label: 'Minggu ini' },
  { id: 'bulan_ini', label: 'Bulan ini' },
  { id: 'bulan_lalu', label: 'Bulan lalu' },
  { id: 'tahun_ini', label: 'Tahun ini' },
  { id: 'semua', label: 'Semua' },
];

// Kartu angka kecil di baris rekap. Angkanya ikut jadi tombol pintas ke
// tab yang bersangkutan -- pegawai yang melihat "3 alpha" biasanya
// langsung ingin tahu tanggal berapa saja.
function KartuRekap({ label, nilai, warna, aktif, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-2 py-2 text-center transition ${
        aktif ? 'border-primary-300 bg-primary-50/60' : 'border-gray-100 bg-white hover:border-gray-200'
      }`}
    >
      <p className={`text-lg font-bold tabular-nums ${warna}`}>{nilai}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </button>
  );
}

export default function History() {
  const tokenFoto = useTokenFoto();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [rekap, setRekap] = useState(null);
  const [status, setStatus] = useState('');
  const [preset, setPreset] = useState('bulan_ini');
  const [pilihan, setPilihan] = useState({ tahun: new Date().getFullYear(), bulan: new Date().getMonth() + 1 });
  const [khusus, setKhusus] = useState({ start_date: '', end_date: '' });
  const [modePeriode, setModePeriode] = useState('preset'); // 'preset' | 'bulan' | 'tahun' | 'khusus'
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [koreksi, setKoreksi] = useState(null);
  const [pesan, setPesan] = useState('');
  const [ajuan, setAjuan] = useState([]);

  // Satu sumber kebenaran rentang tanggal: apa pun cara pegawai memilihnya,
  // yang dikirim ke server selalu pasangan start_date/end_date yang sama.
  const rentang = useMemo(() => {
    if (modePeriode === 'bulan') return rentangBulan(pilihan.tahun, pilihan.bulan);
    if (modePeriode === 'tahun') return rentangTahun(pilihan.tahun);
    if (modePeriode === 'khusus') return khusus;
    return rentangPreset(preset);
  }, [modePeriode, preset, pilihan, khusus]);

  const fetchHistory = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset };
      if (rentang.start_date) params.start_date = rentang.start_date;
      if (rentang.end_date) params.end_date = rentang.end_date;
      if (status) params.status = status;

      const res = await api.get('/attendance/history', { params });
      setItems((prev) => (append ? [...prev, ...res.data] : res.data));
      setHasMore(res.data.length === LIMIT);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [rentang, status]);

  // Rekap sengaja tidak ikut filter status: justru rekap inilah yang
  // memberi tahu ada berapa banyak tiap status di rentang ini.
  const fetchRekap = useCallback(async () => {
    try {
      const params = {};
      if (rentang.start_date) params.start_date = rentang.start_date;
      if (rentang.end_date) params.end_date = rentang.end_date;
      const res = await api.get('/attendance/history/summary', { params });
      setRekap(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [rentang]);

  // Status pengajuan koreksi milik sendiri, supaya baris yang sudah pernah
  // diajukan tidak menawarkan tombol "Ajukan koreksi" lagi.
  const fetchAjuan = useCallback(async () => {
    try {
      const res = await api.get('/corrections/me');
      setAjuan(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  useEffect(() => { fetchRekap(); }, [fetchRekap]);
  useEffect(() => { fetchAjuan(); }, [fetchAjuan]);

  const ajuanPerTanggal = useMemo(() => {
    const peta = {};
    for (const a of ajuan) {
      // Pengajuan diurutkan terbaru dulu, jadi yang pertama ditemui menang.
      if (!peta[a.date]) peta[a.date] = a;
    }
    return peta;
  }, [ajuan]);

  function pilihPreset(id) {
    setModePeriode('preset');
    setPreset(id);
  }

  const inputClass =
    'w-full px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm transition focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/40';

  const chipClass = (aktif) =>
    `px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
      aktif ? 'bg-primary-600 text-white shadow-glow' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-5"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Kembali
        </button>

        <h1 className="text-xl font-bold text-gray-900 tracking-tight mb-4">Riwayat Absensi</h1>

        {pesan && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-3 font-medium">
            ✓ {pesan}
          </div>
        )}

        {/* Pilih periode */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-4 mb-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Periode</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET.map((p) => (
              <button
                key={p.id}
                onClick={() => pilihPreset(p.id)}
                className={chipClass(modePeriode === 'preset' && preset === p.id)}
              >
                {p.label}
              </button>
            ))}
            <button onClick={() => setModePeriode('bulan')} className={chipClass(modePeriode === 'bulan')}>
              Per bulan
            </button>
            <button onClick={() => setModePeriode('tahun')} className={chipClass(modePeriode === 'tahun')}>
              Per tahun
            </button>
            <button onClick={() => setModePeriode('khusus')} className={chipClass(modePeriode === 'khusus')}>
              Rentang khusus
            </button>
          </div>

          {(modePeriode === 'bulan' || modePeriode === 'tahun') && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              {modePeriode === 'bulan' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Bulan</label>
                  <select
                    value={pilihan.bulan}
                    onChange={(e) => setPilihan({ ...pilihan, bulan: Number(e.target.value) })}
                    className={inputClass}
                  >
                    {NAMA_BULAN.map((nama, i) => (
                      <option key={nama} value={i + 1}>{nama}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className={modePeriode === 'tahun' ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Tahun</label>
                <select
                  value={pilihan.tahun}
                  onChange={(e) => setPilihan({ ...pilihan, tahun: Number(e.target.value) })}
                  className={inputClass}
                >
                  {daftarTahun().map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {modePeriode === 'khusus' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Dari</label>
                <input
                  type="date"
                  value={khusus.start_date}
                  onChange={(e) => setKhusus({ ...khusus, start_date: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Sampai</label>
                <input
                  type="date"
                  value={khusus.end_date}
                  onChange={(e) => setKhusus({ ...khusus, end_date: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {(rentang.start_date || rentang.end_date) && (
            <p className="text-[11px] text-gray-400 mt-2.5">
              {rentang.start_date ? formatTanggalHari(rentang.start_date) : 'awal'} —{' '}
              {rentang.end_date ? formatTanggalHari(rentang.end_date) : 'sekarang'}
            </p>
          )}
        </div>

        {/* Rekap periode terpilih */}
        {rekap && (
          <div className="mb-3">
            <div className="grid grid-cols-4 gap-2">
              <KartuRekap label="Hadir" nilai={rekap.hadir} warna="text-emerald-600"
                aktif={status === 'hadir'} onClick={() => setStatus(status === 'hadir' ? '' : 'hadir')} />
              <KartuRekap label="Terlambat" nilai={rekap.terlambat} warna="text-amber-600"
                aktif={status === 'terlambat'} onClick={() => setStatus(status === 'terlambat' ? '' : 'terlambat')} />
              <KartuRekap label="Izin" nilai={rekap.izin} warna="text-blue-600"
                aktif={status === 'izin'} onClick={() => setStatus(status === 'izin' ? '' : 'izin')} />
              <KartuRekap label="Alpha" nilai={rekap.alpha} warna="text-red-500"
                aktif={status === 'alpha'} onClick={() => setStatus(status === 'alpha' ? '' : 'alpha')} />
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Kehadiran {rekap.rate}% dari {rekap.hari_efektif} hari efektif.
              {' '}Izin tidak mengurangi angka ini.
            </p>
          </div>
        )}

        {/* Tab status */}
        <div className="flex gap-1.5 overflow-x-auto mb-3 pb-0.5">
          {TAB.map((t) => (
            <button key={t.id} onClick={() => setStatus(t.id)} className={chipClass(status === t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Daftar riwayat */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
          {items.map((item) => (
            <div key={item.id} className="px-5 py-4 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition">
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-sm font-semibold text-gray-900">{formatTanggalHari(item.date)}</p>
                <StatusBadge status={item.status} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>Masuk: <span className="font-medium text-gray-700">{formatJam(item.check_in_time)}</span></span>
                <span>Pulang: <span className="font-medium text-gray-700">{formatJam(item.check_out_time)}</span></span>
                {item.photo_in_url && (
                  <a href={urlFoto(item.photo_in_url, tokenFoto)} target="_blank" rel="noreferrer" className="text-primary-600 font-medium hover:underline">
                    Foto masuk
                  </a>
                )}
                {item.photo_out_url && (
                  <a href={urlFoto(item.photo_out_url, tokenFoto)} target="_blank" rel="noreferrer" className="text-primary-600 font-medium hover:underline">
                    Foto pulang
                  </a>
                )}
              </div>
              {item.reason && <p className="text-xs text-gray-400 mt-1 italic">{item.reason}</p>}

              {/* Jalur resmi untuk jam yang keliru atau lupa absen pulang.
                  Hari yang berstatus izin tidak menawarkan koreksi jam --
                  itu ranah pengajuan izin, bukan koreksi absen. */}
              {item.status !== 'izin' && (
                ajuanPerTanggal[item.date] ? (
                  <p className="text-[11px] mt-1.5">
                    <span className={
                      ajuanPerTanggal[item.date].status === 'pending' ? 'text-amber-600'
                        : ajuanPerTanggal[item.date].status === 'approved' ? 'text-emerald-600'
                        : 'text-red-500'
                    }>
                      Koreksi {
                        ajuanPerTanggal[item.date].status === 'pending' ? 'menunggu keputusan admin'
                          : ajuanPerTanggal[item.date].status === 'approved' ? 'disetujui'
                          : 'ditolak'
                      }
                    </span>
                    {ajuanPerTanggal[item.date].admin_note && (
                      <span className="text-gray-400"> — {ajuanPerTanggal[item.date].admin_note}</span>
                    )}
                  </p>
                ) : (
                  <button
                    onClick={() => setKoreksi(item)}
                    className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 transition mt-1.5"
                  >
                    Ajukan koreksi
                  </button>
                )
              )}
            </div>
          ))}

          {items.length === 0 && !loading && (
            <p className="text-sm text-gray-400 px-5 py-10 text-center">
              Tidak ada catatan absensi pada periode dan saringan ini.
            </p>
          )}
        </div>

        {hasMore && (
          <button
            onClick={() => fetchHistory(items.length, true)}
            disabled={loading}
            className="w-full mt-4 bg-white border border-gray-200 text-gray-700 py-3 rounded-2xl text-sm font-semibold shadow-soft transition hover:border-gray-300 disabled:opacity-50"
          >
            {loading ? 'Memuat...' : 'Muat Lebih Banyak'}
          </button>
        )}
      </div>

      {koreksi && (
        <AjukanKoreksiModal
          baris={koreksi}
          onTutup={() => setKoreksi(null)}
          onKirim={(msg) => {
            setKoreksi(null);
            setPesan(msg);
            fetchAjuan();
          }}
        />
      )}
    </div>
  );
}
