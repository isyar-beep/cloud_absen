// ============================================================
// Pemformat tanggal & jam bersama untuk aplikasi mobile.
//
// Kembaran dari frontend/src/utils/tanggal.js. `new Date("2026-08-21")`
// dibaca JavaScript sebagai tengah malam UTC lalu ditampilkan dalam zona
// waktu perangkat, sehingga tanggal absensi bisa tampil mundur satu hari
// di HP yang zonanya lebih barat dari server. Tanggal absensi adalah
// tanggal kalender, jadi dibaca apa adanya tanpa konversi zona waktu.
// ============================================================

// Ubah "2026-08-21" jadi Date tengah malam WAKTU LOKAL, bukan UTC.
export function tanggalLokal(nilai) {
  if (nilai instanceof Date) return nilai;
  if (typeof nilai === 'string') {
    const cocok = nilai.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (cocok) return new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]));
  }
  return new Date(nilai);
}

// "21 Agu 2026"
export function formatTanggal(nilai) {
  if (!nilai) return '-';
  return tanggalLokal(nilai).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// "Jum, 21 Agu 2026"
export function formatTanggalHari(nilai) {
  if (!nilai) return '-';
  return tanggalLokal(nilai).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

// "Kam, 27 Agu" -- untuk penanda kecil yang menempel di tempat sempit,
// tempat tahunnya sudah jelas dari kalimat di sekitarnya.
export function formatTanggalSingkat(nilai) {
  if (!nilai) return '-';
  return tanggalLokal(nilai).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

// Ubah "2026-08-21 07:39:12" (jam dinding kantor, tanpa zona waktu) jadi
// Date lokal. Sama seperti tanggal: jangan pernah dikonversi zona waktu,
// karena jam absen adalah jam yang tertera di kantor, bukan titik waktu
// global yang perlu diterjemahkan ke zona pembacanya.
export function jamLokal(nilai) {
  if (nilai instanceof Date) return nilai;
  if (typeof nilai === 'string') {
    const cocok = nilai.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (cocok) {
      const [, y, b, t, h, m, d] = cocok.map(Number);
      return new Date(y, b - 1, t, h, m, d);
    }
  }
  return new Date(nilai);
}

// "07.58"
export function formatJam(nilai) {
  return nilai
    ? jamLokal(nilai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '-';
}

// Date -> "2026-09-04", memakai bagian tanggal WAKTU LOKAL.
//
// Sengaja tidak memakai toISOString(), yang mengubah ke UTC lebih dulu:
// di WITA (UTC+8) tanggal 4 September pukul 07.00 akan berubah menjadi
// "2026-09-03" -- mundur satu hari. Untuk tanggal kalender seperti
// tanggal pengajuan izin, pergeseran itu salah dan sulit dilacak.
export function tanggalIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
