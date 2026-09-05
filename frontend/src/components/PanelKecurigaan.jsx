import { useEffect, useState } from 'react';
import api from '../api/axios';

// ============================================================
// Absensi yang perlu dilihat manusia.
//
// Ditaruh di halaman Riwayat, bukan di halaman tersendiri, dan itu
// disengaja: temuannya selalu berakhir pada satu tindakan yang sama --
// MELIHAT FOTONYA. Halaman inilah yang menampilkan fotonya. Menaruhnya
// di menu terpisah berarti orang harus berpindah halaman untuk
// menindaklanjuti, dan langkah tambahan itu yang membuat daftar
// peringatan berhenti dibuka.
//
// Panelnya TIDAK muncul sama sekali kalau tidak ada temuan. Panel kosong
// yang selalu ada mengajari mata untuk melewatinya, dan pada hari ia
// benar-benar berisi, ia sudah tidak terbaca lagi.
// ============================================================

export default function PanelKecurigaan({ dari, sampai }) {
  const [data, setData] = useState(null);
  const [bukaLemah, setBukaLemah] = useState(false);

  useEffect(() => {
    let batal = false;
    const params = {};
    if (dari) params.dari = dari;
    if (sampai) params.sampai = sampai;

    api.get('/attendance/kecurigaan', { params })
      .then((res) => { if (!batal) setData(res.data); })
      // Sengaja diam saat gagal. Ini keterangan tambahan, bukan isi utama
      // halaman -- memunculkan pesan galat merah untuk sesuatu yang
      // sifatnya sampingan hanya membuat orang mengira halamannya rusak.
      .catch(() => { if (!batal) setData(null); });

    return () => { batal = true; };
  }, [dari, sampai]);

  const kuat = data?.kuat || [];
  const lemah = data?.lemah || [];
  if (kuat.length === 0 && lemah.length === 0) return null;

  return (
    <div className="mb-5">
      {kuat.length > 0 && (
        <div className="kartu-kaca border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 p-4">
          <p className="text-sm font-bold text-strong">
            {kuat.length} hari perlu ditinjau
          </p>
          <p className="text-xs text-body mt-1">
            Satu perangkat dipakai absen oleh lebih dari satu pegawai pada hari yang sama.
            Di lapangan tidak ada HP yang dipakai bergantian, jadi ini perlu ditanyakan.
            {' '}<span className="font-semibold">Buka foto absensinya untuk memastikan.</span>
          </p>

          <div className="mt-3 space-y-2">
            {kuat.map((k) => (
              <div
                key={`${k.tanggal}-${k.pegawai.map((p) => p.user_id).join('-')}`}
                className="text-xs bg-surface/70 border border-line rounded-xl px-3 py-2"
              >
                <span className="font-semibold text-strong">{k.tanggal}</span>
                <span className="text-body">
                  {' — '}
                  {k.pegawai.map((p) => p.nama).join(', ')}
                  {' '}absen dari perangkat yang sama
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sinyal lemah sengaja dipisah dan tertutup.
          Di satu lokasi proyek, dua pegawai memang berdiri berdekatan dan
          bisa absen hampir bersamaan -- itu wajar. Mencampurnya dengan
          yang kuat membuat keduanya sama-sama terbaca sebagai tuduhan, dan
          setelah beberapa kali salah tuduh seluruh panel ini berhenti
          dipercaya. */}
      {lemah.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setBukaLemah(!bukaLemah)}
            className="text-xs text-muted hover:text-body transition"
          >
            {bukaLemah ? '▾' : '▸'} {lemah.length} penunjuk tambahan yang lebih lemah
          </button>

          {bukaLemah && (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs text-faint">
                Dua pegawai absen dari titik yang praktis sama dalam hitungan detik.
                Di satu lokasi proyek hal ini wajar terjadi — gunakan sebagai penunjuk
                tambahan, bukan tuduhan yang berdiri sendiri.
              </p>
              {lemah.map((l) => (
                <div
                  key={`${l.tanggal}-${l.pegawai.map((p) => p.user_id).join('-')}`}
                  className="text-xs text-body bg-surface/70 border border-line rounded-xl px-3 py-2"
                >
                  <span className="font-semibold text-strong">{l.tanggal}</span>
                  {' — '}{l.pegawai.map((p) => p.nama).join(' dan ')}
                  {', selisih '}{l.selisih_detik} detik
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
