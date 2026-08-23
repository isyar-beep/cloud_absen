import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeftIcon, CameraIcon, ClockIcon } from '../components/Icons';
import { formatJam, formatTanggalHari } from '../utils/tanggal';

// Satu baris "kapan boleh absen": rentang jamnya, plus titik warna yang
// langsung terbaca -- hijau berarti sedang dibuka, abu berarti belum/sudah
// lewat, biru berarti absennya memang sudah selesai dilakukan.
function JendelaBaris({ label, info, selesai }) {
  const warna = selesai ? 'bg-primary-500' : info?.boleh ? 'bg-emerald-500' : 'bg-gray-300';
  const keterangan = selesai ? 'Sudah dilakukan' : info?.boleh ? 'Dibuka sekarang' : 'Belum dibuka';

  return (
    <div>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-800">
        {info ? `${info.buka}–${info.tutup}` : '—'}
      </p>
      <p className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
        <span className={`w-1.5 h-1.5 rounded-full ${warna}`} />
        {selesai || info?.boleh ? keterangan : info?.alasan?.replace(/^Absen \w+ /, '') || keterangan}
      </p>
    </div>
  );
}

export default function Attendance() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const navigate = useNavigate();

  const [cameraReady, setCameraReady] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [mode, setMode] = useState(null); // 'check-in' | 'check-out'
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTodayStatus();
    // Jendela absen bergerak mengikuti jam. Tanpa penyegaran berkala,
    // pegawai yang membuka halaman ini pukul 07.28 akan terus melihat
    // "belum dibuka" walau sudah lewat pukul 07.30.
    const timer = setInterval(fetchTodayStatus, 30000);
    return () => {
      clearInterval(timer);
      stopCamera();
    };
  }, []);

  async function fetchTodayStatus() {
    try {
      const res = await api.get('/attendance/today');
      setInfo(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  const startCamera = useCallback(async (selectedMode) => {
    setError('');
    setMode(selectedMode);
    setCapturedPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraReady(true);
      }
    } catch (err) {
      setError('Tidak bisa mengakses kamera. Pastikan izin kamera diaktifkan.');
    }
  }, []);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }

  // Batas sisi terpanjang foto absensi. Kamera HP modern menghasilkan foto
  // beberapa MB; wajah tetap jelas di 1000px, sementara ukuran berkas turun
  // sekitar tiga kali lipat -- hemat kuota pegawai dan disk server.
  const MAKS_PIKSEL = 1000;

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const skala = Math.min(1, MAKS_PIKSEL / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * skala);
    canvas.height = Math.round(video.videoHeight * skala);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(dataUrl);
    stopCamera();
  }

  function retakePhoto() {
    startCamera(mode);
  }

  async function submitAttendance() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const blob = await (await fetch(capturedPhoto)).blob();
      const formData = new FormData();
      formData.append('photo', blob, 'attendance.jpg');

      if (navigator.geolocation) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              formData.append('latitude', pos.coords.latitude);
              formData.append('longitude', pos.coords.longitude);
              resolve();
            },
            () => resolve(), // lanjut walau lokasi ditolak
            { timeout: 3000 }
          );
        });
      }

      const endpoint = mode === 'check-in' ? '/attendance/check-in' : '/attendance/check-out';
      const res = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setMessage(res.data.message);
      setCapturedPhoto(null);
      setMode(null);
      fetchTodayStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengirim absensi.');
    } finally {
      setLoading(false);
    }
  }

  const absensi = info?.absensi;
  const sudahCheckIn = !!absensi?.check_in_time;
  const sudahCheckOut = !!absensi?.check_out_time;

  // Tombol hidup hanya kalau server bilang jendelanya terbuka. Ini salinan
  // dari aturan yang sama di server -- server tetap yang menolak, ini
  // supaya pegawai tahu duluan tanpa harus memotret dulu lalu ditolak.
  const bolehMasuk = !sudahCheckIn && !!info?.masuk?.boleh;
  const bolehPulang = sudahCheckIn && !sudahCheckOut && !!info?.pulang?.boleh;

  // Alasan yang ditampilkan di bawah tombol saat tombolnya mati.
  const catatanMasuk = sudahCheckIn ? null : info?.masuk?.alasan;
  const catatanPulang = !sudahCheckIn
    ? 'Absen masuk dulu sebelum absen pulang.'
    : sudahCheckOut
      ? null
      : info?.pulang?.alasan;

  const shift = info?.shift;
  const tanggalShiftBeda = info?.tanggal_shift && info.tanggal_shift !== info.hari_ini;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-5"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Kembali
        </button>

        <h1 className="text-xl font-bold text-gray-900 tracking-tight mb-1">Absensi Hari Ini</h1>
        <p className="text-sm text-gray-500 mb-4">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        {/* Kartu shift: pegawai perlu tahu jam kerjanya dan kapan absen dibuka,
            sebelum menekan tombol. Untuk shift malam, tanggal shift bisa
            berbeda dari tanggal hari ini -- itu disebut terang-terangan. */}
        {shift && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-4 mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Shift Anda</p>
                <p className="text-base font-bold text-gray-900 truncate">{shift.nama}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500">Jam kerja</p>
                <p className="text-base font-bold text-gray-900">
                  {shift.mulai}–{shift.selesai}
                  {shift.lintas_hari && <span className="text-xs font-medium text-violet-600 ml-1">+1 hari</span>}
                </p>
              </div>
            </div>

            {tanggalShiftBeda && (
              <p className="text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-1.5 mt-3">
                Absen ini tercatat untuk shift tanggal {formatTanggalHari(info.tanggal_shift)}.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-50">
              <JendelaBaris label="Absen masuk" info={info.masuk} selesai={sudahCheckIn} />
              <JendelaBaris label="Absen pulang" info={info.pulang} selesai={sudahCheckOut} />
            </div>
          </div>
        )}

        {message && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-4 font-medium">
            ✓ {message}
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Status ringkas hari ini */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 mb-5 grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <ClockIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Jam masuk</p>
              <p className="text-base font-bold text-gray-900">
                {sudahCheckIn ? formatJam(absensi.check_in_time) : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <ClockIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Jam pulang</p>
              <p className="text-base font-bold text-gray-900">
                {sudahCheckOut ? formatJam(absensi.check_out_time) : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Area kamera / hasil foto */}
        {!capturedPhoto && mode && (
          <div className="rounded-3xl overflow-hidden mb-5 relative ring-4 ring-primary-500/20 shadow-soft bg-black">
            <video ref={videoRef} autoPlay playsInline className="w-full aspect-[4/3] object-cover" />
            {cameraReady && (
              <button
                onClick={capturePhoto}
                className="absolute bottom-5 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white/90 backdrop-blur border-4 border-white shadow-lg active:scale-90 transition"
                aria-label="Ambil foto"
              />
            )}
          </div>
        )}

        {capturedPhoto && (
          <div className="rounded-3xl overflow-hidden mb-5 ring-4 ring-emerald-500/20 shadow-soft">
            <img src={capturedPhoto} alt="Preview absensi" className="w-full aspect-[4/3] object-cover" />
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />

        {/* Tombol aksi */}
        {!mode && (
          <div className="space-y-3">
            <div>
              <button
                onClick={() => startCamera('check-in')}
                disabled={!bolehMasuk}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3.5 rounded-2xl text-sm font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <CameraIcon className="w-5 h-5" />
                {sudahCheckIn ? 'Sudah Absen Masuk' : 'Absen Masuk'}
              </button>
              {catatanMasuk && (
                <p className="text-xs text-gray-500 text-center mt-1.5">{catatanMasuk}</p>
              )}
            </div>
            <div>
              <button
                onClick={() => startCamera('check-out')}
                disabled={!bolehPulang}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3.5 rounded-2xl text-sm font-semibold transition hover:bg-gray-800 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CameraIcon className="w-5 h-5" />
                {sudahCheckOut ? 'Sudah Absen Pulang' : 'Absen Pulang'}
              </button>
              {catatanPulang && (
                <p className="text-xs text-gray-500 text-center mt-1.5">{catatanPulang}</p>
              )}
            </div>
          </div>
        )}

        {capturedPhoto && (
          <div className="flex gap-3">
            <button
              onClick={retakePhoto}
              className="flex-1 bg-white border border-gray-200 text-gray-700 py-3.5 rounded-2xl text-sm font-semibold shadow-soft transition hover:border-gray-300"
            >
              Ambil Ulang
            </button>
            <button
              onClick={submitAttendance}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3.5 rounded-2xl text-sm font-semibold shadow-glow transition active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? 'Mengirim...' : 'Kirim Absensi'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
