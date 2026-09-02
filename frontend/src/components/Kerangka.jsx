// ============================================================
// Kerangka pemuatan.
//
// Sebelumnya halaman menampilkan ruang kosong sampai data tiba, lalu
// isinya meloncat masuk sekaligus. Dua kerugiannya: menunggu terasa
// lebih lama daripada sebenarnya, dan tata letaknya melompat begitu
// isi datang.
//
// Kerangka menyelesaikan keduanya dengan cara yang sama: bentuknya
// dibuat SEUKURAN isi yang akan menggantikannya, sehingga ruangnya
// sudah dipesan sejak awal dan tidak ada yang bergeser. Karena itu
// tiap kerangka di sini menyalin tinggi dan jarak komponen aslinya,
// bukan sekadar kotak abu-abu asal.
// ============================================================

// Satu balok. Gerakannya denyut halus, bukan kilau yang menyapu:
// kilau menarik mata ke dirinya sendiri, padahal ini justru bagian
// yang seharusnya diabaikan.
export function Balok({ className = '', style }) {
  return (
    <div
      className={`bg-surface-3/80 dark:bg-surface-3/60 rounded-lg animate-pulse ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// Kartu KPI: cakram ikon + dua baris teks, sama seperti aslinya.
export function KerangkaKpi({ jumlah = 4 }) {
  return (
    <>
      {Array.from({ length: jumlah }).map((_, i) => (
        <div key={i} className="kartu-kaca p-6 flex items-center gap-4">
          <Balok className="w-12 h-12 rounded-2xl shrink-0" />
          <div className="min-w-0 flex-1">
            <Balok className="h-3 w-20" />
            <Balok className="h-7 w-12 mt-2" />
          </div>
        </div>
      ))}
    </>
  );
}

// Baris daftar dengan avatar: dipakai papan kehadiran dan daftar pengguna.
export function KerangkaBaris({ jumlah = 4, avatar = true }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: jumlah }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          {avatar && <Balok className="w-9 h-9 rounded-full shrink-0" />}
          <div className="min-w-0 flex-1">
            <Balok className="h-3.5 w-32" />
            <Balok className="h-2.5 w-20 mt-2" />
          </div>
          <Balok className="h-6 w-24 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

// Baris tabel bergaya pil, seukuran .tabel-pil td (padding 0.9rem).
export function KerangkaTabel({ baris = 5, kolom = 6 }) {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: baris }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 bg-surface/40 rounded-xl px-4 py-3.5">
          {Array.from({ length: kolom }).map((__, k) => (
            <Balok
              key={k}
              // Lebar dibuat berbeda-beda supaya terbaca sebagai baris
              // data, bukan deretan balok seragam yang justru terlihat
              // seperti kerusakan tampilan.
              className={`h-3.5 ${k === 0 ? 'w-24' : k === 1 ? 'w-32' : 'w-16'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Kartu isi bebas dengan judul, untuk panel yang belum punya bentuk tetap.
export function KerangkaKartu({ tinggi = 'h-40', judul = true }) {
  return (
    <div className="kartu-kaca p-5">
      {judul && <Balok className="h-4 w-40 mb-4" />}
      <Balok className={`w-full ${tinggi}`} />
    </div>
  );
}
