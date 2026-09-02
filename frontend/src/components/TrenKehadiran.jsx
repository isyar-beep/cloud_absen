import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../api/axios';
import { useGrafikTema, WARNA_STATUS } from '../utils/grafik';
import { ChartIcon } from './Icons';
import { Balok } from './Kerangka';

const NAMA_BULAN_PENDEK = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

// Sebuah tren butuh minimal dua titik. Dengan satu titik tidak ada apa pun
// untuk dibandingkan, dan grafiknya hanya memberi kesan seolah ada.
const MIN_TITIK = 2;

// SENGAJA batang, bukan garis atau area. Jumlah kehadiran per bulan adalah
// besaran diskret: garis menyiratkan ada nilai di antara dua bulan --
// "pertengahan Agustus ke September" -- padahal nilai itu tidak ada.
// Batang juga jujur pada jumlah titik berapa pun, sedangkan garis dengan
// dua titik bernilai sama tergambar datar dan terbaca seperti grafik rusak.

const TINGGI = 220;

export default function TrenKehadiran() {
  const grafik = useGrafikTema();
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    let batal = false;
    api.get('/stats/monthly-series')
      .then((res) => {
        if (batal) return;
        setData(res.data.map((r) => ({
          label: `${NAMA_BULAN_PENDEK[r.month - 1]} '${String(r.year).slice(2)}`,
          // Hadir dan terlambat dijumlahkan: keduanya sama-sama MASUK
          // kerja, dan grafik ini menjawab "berapa yang hadir", bukan
          // "berapa yang tepat waktu". Pembedaannya ada di halaman
          // Statistik, tempat orang memang datang untuk merincinya.
          hadir: Number(r.hadir) + Number(r.terlambat),
          alpha: Number(r.alpha),
        })));
      })
      .catch((e) => {
        if (!batal) setGalat(e.response?.data?.message || 'Gagal memuat tren kehadiran.');
      });
    return () => { batal = true; };
  }, []);

  return (
    <div className="kartu-kaca p-5 mb-6">
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <p className="text-[17px] font-bold text-strong tracking-[-0.01em]">Tren Kehadiran</p>
        <span className="text-[11px] text-faint">per bulan, seluruh pegawai</span>
      </div>

      {data === null && !galat && (
        <div style={{ height: TINGGI }} className="flex items-end gap-2 px-1">
          {/* Kerangka berbentuk grafik batang: ruangnya sudah dipesan,
              sehingga isi di bawahnya tidak melompat saat data tiba. */}
          {[45, 70, 55, 85, 60, 75].map((t, i) => (
            <Balok key={i} className="flex-1" style={{ height: `${t}%` }} />
          ))}
        </div>
      )}

      {galat && (
        <div style={{ height: TINGGI }} className="flex items-center justify-center">
          <p className="text-sm text-muted text-center max-w-xs">{galat}</p>
        </div>
      )}

      {data !== null && data.length < MIN_TITIK && (
        <div style={{ height: TINGGI }} className="flex flex-col items-center justify-center text-center px-6">
          <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center mb-3">
            <ChartIcon className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-strong">
            {data.length === 0 ? 'Belum ada data kehadiran' : 'Baru satu bulan tercatat'}
          </p>
          <p className="text-sm text-muted mt-1.5 max-w-sm leading-relaxed">
            {data.length === 0
              ? 'Grafik ini terisi sendiri begitu pegawai mulai absen.'
              : 'Tren membutuhkan sedikitnya dua bulan supaya arah naik-turunnya berarti. '
                + 'Bulan depan grafiknya mulai terbentuk.'}
          </p>
        </div>
      )}

      {data !== null && data.length >= MIN_TITIK && (
        <ResponsiveContainer width="100%" height={TINGGI}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barGap={4}>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={grafik.kisi} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} dy={8} tick={grafik.label} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} tick={grafik.label} />
            <Tooltip
              contentStyle={grafik.tooltip}
              labelStyle={grafik.labelTooltip}
              cursor={grafik.kursor}
              formatter={(v, n) => [v, n === 'hadir' ? 'Hadir' : 'Alpha']}
            />
            {/* Lebar batang dibatasi: dengan dua bulan saja, batang yang
                membagi rata lebar kartu jadi selebar telapak dan terbaca
                sebagai blok warna, bukan sebagai ukuran. */}
            <Bar dataKey="hadir" fill={grafik.garisUtama} radius={[6, 6, 0, 0]} maxBarSize={56} />
            <Bar dataKey="alpha" fill={WARNA_STATUS.alpha} radius={[6, 6, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
