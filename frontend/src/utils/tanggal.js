// ============================================================
// Pemformat tanggal & jam yang dipakai bersama seluruh halaman.
//
// Dulu tiap halaman punya salinan formatTanggal sendiri, dan semuanya
// memakai `new Date("2026-08-21")`. Bentuk itu ditafsirkan JavaScript
// sebagai tengah malam UTC, lalu ditampilkan dalam zona waktu browser --
// jadi di perangkat yang zonanya lebih barat, tanggal absensi tampil
// mundur satu hari. Tanggal absensi adalah tanggal kalender, jadi harus
// dibaca apa adanya tanpa konversi zona waktu.
// ============================================================

// Ubah "2026-08-21" jadi Date tengah malam WAKTU LOKAL, bukan UTC.
// Nilai selain format itu (mis. timestamp lengkap) diteruskan apa adanya.
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
  if (!nilai) return '—';
  return tanggalLokal(nilai).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// "Jum, 21 Agu 2026"
export function formatTanggalHari(nilai) {
  if (!nilai) return '—';
  return tanggalLokal(nilai).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

// "Kam, 27 Agu" -- untuk penanda kecil yang menempel di tempat sempit,
// tempat tahunnya sudah jelas dari kalimat di sekitarnya.
export function formatTanggalSingkat(nilai) {
  if (!nilai) return '—';
  return tanggalLokal(nilai).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

// "21/08/2026"
export function formatTanggalPendek(nilai) {
  if (!nilai) return '—';
  return tanggalLokal(nilai).toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
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
    : '—';
}

// "07.58.13"
export function formatJamDetik(nilai) {
  return nilai
    ? jamLokal(nilai).toLocaleTimeString('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : '—';
}
