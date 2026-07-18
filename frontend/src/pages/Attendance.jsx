import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeftIcon, CameraIcon, ClockIcon } from '../components/Icons';

export default function Attendance() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const navigate = useNavigate();

  const [cameraReady, setCameraReady] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [mode, setMode] = useState(null); // 'check-in' | 'check-out'
  const [todayStatus, setTodayStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTodayStatus();
    return () => stopCamera();
  }, []);

  async function fetchTodayStatus() {
    try {
      const res = await api.get('/attendance/today');
      setTodayStatus(res.data);
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

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
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

  const sudahCheckIn = !!todayStatus?.check_in_time;
  const sudahCheckOut = !!todayStatus?.check_out_time;

  function formatJam(t) {
    return new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

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
        <p className="text-sm text-gray-500 mb-6">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

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
                {sudahCheckIn ? formatJam(todayStatus.check_in_time) : '—'}
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
                {sudahCheckOut ? formatJam(todayStatus.check_out_time) : '—'}
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
            <button
              onClick={() => startCamera('check-in')}
              disabled={sudahCheckIn}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3.5 rounded-2xl text-sm font-semibold shadow-glow transition hover:from-primary-500 hover:to-primary-600 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <CameraIcon className="w-5 h-5" />
              {sudahCheckIn ? 'Sudah Absen Masuk' : 'Absen Masuk'}
            </button>
            <button
              onClick={() => startCamera('check-out')}
              disabled={!sudahCheckIn || sudahCheckOut}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3.5 rounded-2xl text-sm font-semibold transition hover:bg-gray-800 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CameraIcon className="w-5 h-5" />
              {sudahCheckOut ? 'Sudah Absen Pulang' : 'Absen Pulang'}
            </button>
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
