import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import Avatar from './Avatar';
import { ClockIcon } from './Icons';

// Panel pengingat absen.
//
// Sebelumnya pengingat hanya bisa ditembak ke semua pegawai yang belum absen
// sekaligus. Di lapangan yang dibutuhkan biasanya lebih sempit: satu-dua orang
// yang memang perlu ditegur, bukan seluruh kantor. Jadi daftarnya ditampilkan
// dan admin memilih sendiri.
//
// Pegawai yang belum pernah login di aplikasi mobile tetap ditampilkan tapi
// tidak bisa dipilih -- kalau disembunyikan, admin akan mengira orang itu
// sudah absen.
export default function PengingatAbsen() {
  const [daftar, setDaftar] = useState([]);
  const [terpilih, setTerpilih] = useState(new Set());
  const [pesanKustom, setPesanKustom] = useState('');
  const [pakaiPesan, setPakaiPesan] = useState(false);
  const [hasil, setHasil] = useState('');
  const [loading, setLoading] = useState(false);
  const [memuat, setMemuat] = useState(true);

  const ambil = useCallback(async () => {
    setMemuat(true);
    try {
      const res = await api.get('/notifications/pending-checkin');
      setDaftar(res.data);
      // Buang pilihan yang orangnya sudah absen sejak muat terakhir.
      setTerpilih((lama) => new Set([...lama].filter((id) => res.data.some((r) => r.id === id))));
    } catch (err) {
      console.error(err);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { ambil(); }, [ambil]);

  const bisaDikirimi = daftar.filter((r) => r.bisa_dikirimi);
  const tanpaAplikasi = daftar.length - bisaDikirimi.length;
  const semuaTerpilih = bisaDikirimi.length > 0 && terpilih.size === bisaDikirimi.length;

  function toggle(id) {
    setTerpilih((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id); else baru.add(id);
      return baru;
    });
  }

  function toggleSemua() {
    setTerpilih(semuaTerpilih ? new Set() : new Set(bisaDikirimi.map((r) => r.id)));
  }

  async function kirim() {
    const jumlah = terpilih.size;
    const kepada = jumlah === 1
      ? daftar.find((r) => r.id === [...terpilih][0])?.name
      : `${jumlah} pegawai`;
    if (!confirm(`Kirim pengingat absen ke ${kepada}?`)) return;

    setLoading(true);
    setHasil('');
    try {
      const res = await api.post('/notifications/checkin-reminder', {
        user_ids: [...terpilih],
        ...(pakaiPesan && pesanKustom.trim() ? { message: pesanKustom.trim() } : {}),
      });
      setHasil(res.data.message);
      setTerpilih(new Set());
      ambil();
    } catch (err) {
      setHasil(err.response?.data?.message || 'Gagal mengirim pengingat.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-line rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ClockIcon className="w-4 h-4" />
          </span>
          <p className="text-sm font-semibold text-strong">Pengingat Absen</p>
        </div>
        <button
          onClick={ambil}
          className="text-xs text-faint hover:text-body transition"
        >
          Muat ulang
        </button>
      </div>

      {memuat && <p className="text-xs text-faint mt-3">Memuat daftar…</p>}

      {!memuat && daftar.length === 0 && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-3">
          Tidak ada yang perlu diingatkan. Pegawai yang jam kerjanya belum
          dibuka tidak ikut didaftar di sini.
        </p>
      )}

      {!memuat && daftar.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2 mt-3 mb-2">
            <p className="text-xs text-muted">
              {daftar.length} pegawai belum absen &mdash; jam kerjanya sudah dibuka
            </p>
            {bisaDikirimi.length > 0 && (
              <button
                onClick={toggleSemua}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 dark:text-primary-300 transition"
              >
                {semuaTerpilih ? 'Kosongkan pilihan' : 'Pilih semua'}
              </button>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1 pr-0.5">
            {daftar.map((r) => (
              <label
                key={r.id}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition ${
                  !r.bisa_dikirimi
                    ? 'border-line bg-surface-2/60 cursor-not-allowed'
                    : terpilih.has(r.id)
                      ? 'border-primary-200 dark:border-primary-500/35 bg-primary-50/60 dark:bg-primary-500/15 cursor-pointer'
                      : 'border-line hover:border-line-strong cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!r.bisa_dikirimi}
                  checked={terpilih.has(r.id)}
                  onChange={() => toggle(r.id)}
                  className="w-4 h-4 rounded border-line-strong text-primary-600 dark:text-primary-400 focus:ring-primary-500/40 disabled:opacity-40"
                />
                <Avatar name={r.name} src={r.avatar_url} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-strong truncate">{r.name}</p>
                  <p className="text-[11px] text-faint truncate">
                    {r.department || 'Tanpa departemen'}
                    {r.shift_name && ` · ${r.shift_name} ${String(r.shift_start).slice(0, 5)}`}
                  </p>
                </div>
                {!r.bisa_dikirimi && (
                  <span className="text-[10px] text-faint shrink-0">belum pakai aplikasi</span>
                )}
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 mt-3 text-xs text-body cursor-pointer">
            <input
              type="checkbox"
              checked={pakaiPesan}
              onChange={(e) => setPakaiPesan(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-line-strong text-primary-600 dark:text-primary-400 focus:ring-primary-500/40"
            />
            Tulis pesan sendiri
          </label>
          {pakaiPesan && (
            <textarea
              rows={2}
              maxLength={300}
              value={pesanKustom}
              onChange={(e) => setPesanKustom(e.target.value)}
              placeholder="mis. Mohon segera absen, rapat pagi dimulai pukul 09.00"
              className="w-full mt-2 px-3 py-2 bg-surface-2 border border-line rounded-xl text-xs resize-none transition focus:outline-none focus:bg-surface/75 backdrop-blur-xl focus:ring-2 focus:ring-primary-500/40"
            />
          )}

          <button
            onClick={kirim}
            disabled={loading || terpilih.size === 0}
            className="w-full mt-3 text-sm bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-2 rounded-xl font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600 disabled:opacity-40 disabled:shadow-none"
          >
            {loading
              ? 'Mengirim…'
              : terpilih.size === 0
                ? 'Pilih pegawai dulu'
                : `Kirim Pengingat (${terpilih.size})`}
          </button>

          {tanpaAplikasi > 0 && (
            <p className="text-[11px] text-faint mt-2">
              {tanpaAplikasi} pegawai belum bisa dikirimi notifikasi — perlu login dulu di aplikasi mobile.
            </p>
          )}
        </>
      )}

      {hasil && <p className="text-xs text-body mt-2.5">{hasil}</p>}
    </div>
  );
}
