// ============================================================
// Preset rentang tanggal untuk halaman riwayat.
//
// Semua tanggal dibentuk dari komponen tahun/bulan/hari waktu lokal, tidak
// lewat toISOString(), supaya tidak bergeser satu hari di perangkat yang
// zona waktunya berbeda dari server.
// ============================================================

export function keTanggal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// Minggu dianggap mulai hari Senin -- itu yang dipakai di kantor,
// berbeda dari getDay() yang menaruh Minggu di indeks 0.
function awalMinggu(acuan) {
  const d = new Date(acuan);
  const geser = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - geser);
  return d;
}

// Kembalikan { start_date, end_date } untuk sebuah preset.
// Nilai kosong berarti "tanpa batas" -- dipakai preset "Semua".
export function rentangPreset(preset, acuan = new Date()) {
  const kini = new Date(acuan.getFullYear(), acuan.getMonth(), acuan.getDate());

  switch (preset) {
    case 'minggu_ini':
      return { start_date: keTanggal(awalMinggu(kini)), end_date: keTanggal(kini) };

    case 'bulan_ini':
      return {
        start_date: keTanggal(new Date(kini.getFullYear(), kini.getMonth(), 1)),
        end_date: keTanggal(kini),
      };

    case 'tahun_ini':
      return {
        start_date: keTanggal(new Date(kini.getFullYear(), 0, 1)),
        end_date: keTanggal(kini),
      };

    default: // 'semua'
      return { start_date: '', end_date: '' };
  }
}

// Rentang untuk satu bulan tertentu (dropdown tahun + bulan).
export function rentangBulan(tahun, bulan) {
  return {
    start_date: keTanggal(new Date(tahun, bulan - 1, 1)),
    end_date: keTanggal(new Date(tahun, bulan, 0)),
  };
}

// Rentang untuk satu tahun penuh.
export function rentangTahun(tahun) {
  return {
    start_date: keTanggal(new Date(tahun, 0, 1)),
    end_date: keTanggal(new Date(tahun, 11, 31)),
  };
}

// Daftar tahun yang masuk akal dipilih: dari tahun berjalan mundur beberapa
// tahun. Sistem ini baru, jadi tidak perlu daftar panjang.
export function daftarTahun(jumlah = 4, acuan = new Date()) {
  const kini = acuan.getFullYear();
  return Array.from({ length: jumlah }, (_, i) => kini - i);
}
