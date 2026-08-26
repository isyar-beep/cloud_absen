import { useRef, useState } from 'react';
import api from '../api/axios';
import Avatar from './Avatar';

const MAKS_PIKSEL = 400; // foto profil tidak pernah ditampilkan lebih besar dari ini

// Perkecil di browser sebelum dikirim. Foto kamera HP bisa beberapa MB,
// padahal hanya ditampilkan sebesar beberapa puluh piksel -- mengirim
// aslinya memboroskan kuota pegawai dan disk server.
function perkecil(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const skala = Math.min(1, MAKS_PIKSEL / Math.max(img.width, img.height));
      const w = Math.round(img.width * skala);
      const h = Math.round(img.height * skala);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Gagal memproses gambar'))),
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Berkas bukan gambar yang bisa dibaca'));
    };
    img.src = url;
  });
}

export default function AvatarUploader({ name, src, onChange }) {
  const inputRef = useRef(null);
  const [proses, setProses] = useState(false);
  const [error, setError] = useState('');

  async function pilihFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // supaya memilih berkas yang sama lagi tetap memicu
    if (!file) return;

    setError('');
    setProses(true);
    try {
      const kecil = await perkecil(file);
      const form = new FormData();
      form.append('photo', kecil, 'avatar.jpg');
      const res = await api.put('/auth/avatar', form);
      onChange?.(res.data.avatar_url);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Gagal mengunggah foto.');
    } finally {
      setProses(false);
    }
  }

  async function hapus() {
    if (!confirm('Hapus foto profil? Tampilan kembali memakai inisial nama.')) return;
    setProses(true);
    setError('');
    try {
      await api.delete('/auth/avatar');
      onChange?.(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menghapus foto.');
    } finally {
      setProses(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={proses}
        title="Ganti foto profil"
        className="relative rounded-full ring-2 ring-white/70 transition hover:ring-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-white"
      >
        <Avatar name={name} src={src} size={52} />
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-surface/75 backdrop-blur-xl text-primary-600 dark:text-primary-400 text-[10px] font-bold flex items-center justify-center shadow">
          {proses ? '…' : '+'}
        </span>
      </button>

      <div className="min-w-0">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={proses}
          className="text-xs font-semibold text-white/90 hover:text-white underline underline-offset-2 disabled:opacity-60"
        >
          {proses ? 'Memproses…' : src ? 'Ganti foto' : 'Unggah foto profil'}
        </button>
        {src && !proses && (
          <button
            type="button"
            onClick={hapus}
            className="text-xs text-white/60 hover:text-white/90 ml-3"
          >
            Hapus
          </button>
        )}
        {error && <p className="text-[11px] text-red-100 mt-1">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={pilihFile}
        className="hidden"
      />
    </div>
  );
}
