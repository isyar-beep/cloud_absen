import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

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

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <button onClick={() => navigate(-1)} className="text-sm text-gray-500 mb-4">
          ← Kembali
        </button>

        <h1 className="text-xl font-semibold text-gray-900 mb-1">Absensi Hari Ini</h1>
        <p className="text-sm text-gray-500 mb-6">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        {message && (
          <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-4">
            {message}
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}

        {/* Status ringkas hari ini */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 flex justify-between text-sm">
          <div>
            <p className="text-gray-500">Jam masuk</p>
            <p className="font-medium text-gray-900">
              {sudahCheckIn ? new Date(todayStatus.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Jam pulang</p>
            <p className="font-medium text-gray-900">
              {sudahCheckOut ? new Date(todayStatus.check_out_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
            </p>
          </div>
        </div>

        {/* Area kamera / hasil foto */}
        {!capturedPhoto && mode && (
          <div className="bg-black rounded-2xl overflow-hidden mb-4 relative">
            <video ref={videoRef} autoPlay playsInline className="w-full aspect-[4/3] object-cover" />
            {cameraReady && (
              <button
                onClick={capturePhoto}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white border-4 border-gray-300 active:scale-95 transition"
                aria-label="Ambil foto"
              />
            )}
          </div>
        )}

        {capturedPhoto && (
          <div className="rounded-2xl overflow-hidden mb-4">
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
              className="w-full bg-primary-600 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sudahCheckIn ? 'Sudah Absen Masuk' : 'Absen Masuk'}
            </button>
            <button
              onClick={() => startCamera('check-out')}
              disabled={!sudahCheckIn || sudahCheckOut}
              className="w-full bg-gray-900 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sudahCheckOut ? 'Sudah Absen Pulang' : 'Absen Pulang'}
            </button>
          </div>
        )}

        {capturedPhoto && (
          <div className="flex gap-3">
            <button
              onClick={retakePhoto}
              className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-xl text-sm font-medium"
            >
              Ambil Ulang
            </button>
            <button
              onClick={submitAttendance}
              disabled={loading}
              className="flex-1 bg-primary-600 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Mengirim...' : 'Kirim Absensi'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
