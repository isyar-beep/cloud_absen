// ============================================================
// Pencatatan kejadian.
//
// Sebelumnya seluruh sistem memakai console.error dengan bentuk yang
// berbeda-beda di 18 tempat, dan errorHandler mencetak tumpukan galat
// mentah. Di komputer pengembang itu terbaca; di server itu berarti:
//
// 1. TIDAK ADA YANG MENGHUBUNGKAN KELUHAN DENGAN CATATAN. Pegawai
//    menelepon "tadi pagi gagal absen, muncul tulisan merah". Di catatan
//    ada 40 galat pagi itu. Tidak ada satu pun cara mengetahui yang mana
//    miliknya. Inilah yang paling sering membuat laporan gangguan
//    berakhir tanpa jawaban -- bukan karena galatnya sulit, tapi karena
//    galatnya tidak pernah ketemu.
//
// 2. TIDAK BISA DISARING. Baris bebas tidak bisa dicari selain dengan
//    menebak kata. Satu baris JSON per kejadian bisa: siapa penggunanya,
//    endpoint mana, berapa lama, berapa sering.
//
// Karena itu: satu baris JSON per kejadian di produksi (NDJSON, bisa
// dibaca jq maupun mata telanjang), dan bentuk berwarna yang ringkas
// saat mengembangkan. Tidak ada pustaka baru -- pino dan winston bagus,
// tapi keduanya membawa perkara versi dan pembaruan yang harus dijaga
// bertahun-tahun untuk sesuatu yang muat dalam satu berkas.
//
// Yang TIDAK dicatat, dan itu disengaja: isi badan permintaan. Di
// dalamnya ada kata sandi, foto wajah, dan koordinat. Catatan yang
// menyimpan itu berubah dari alat bantu menjadi kebocoran yang menunggu
// giliran.
// ============================================================

const KE_LAYAR = process.env.NODE_ENV !== 'production';

// Waktu setempat, bukan UTC. Orang yang membaca catatan ini menyamakannya
// dengan jam di dinding kantor dan dengan jam absensi pegawai; catatan
// ber-UTC memaksa setiap pembacaan dihitung mundur delapan jam dulu, dan
// cepat atau lambat ada yang lupa.
function waktuSetempat(d = new Date()) {
  const p = new Intl.DateTimeFormat('sv-SE', {
    timeZone: process.env.TZ || 'Asia/Makassar',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(d);
  return p.replace(' ', 'T');
}

const WARNA = {
  galat: '\x1b[31m', ingat: '\x1b[33m', info: '\x1b[36m', mati: '\x1b[0m',
};

// Membuang nilai kosong supaya barisnya tetap terbaca. Bidang yang selalu
// muncul walau null membuat mata berhenti membacanya.
function rapikan(obj) {
  const keluar = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') keluar[k] = v;
  }
  return keluar;
}

function tulis(taraf, pesan, konteks = {}) {
  const baris = rapikan({ waktu: waktuSetempat(), taraf, pesan, ...konteks });

  if (!KE_LAYAR) {
    // Satu baris, satu kejadian. Bentuk inilah yang bisa disaring:
    //   grep '"kode":"a3f9c1"' galat.log
    //   jq 'select(.status >= 500)' galat.log
    process.stdout.write(`${JSON.stringify(baris)}\n`);
    return;
  }

  // Saat mengembangkan, yang dibutuhkan justru sebaliknya: terbaca
  // sekilas tanpa dijqkan.
  const { waktu, taraf: _t, pesan: _p, tumpukan, ...sisa } = baris;
  const w = WARNA[taraf] || '';
  const ekor = Object.keys(sisa).length ? ` ${JSON.stringify(sisa)}` : '';
  process.stdout.write(`${w}${waktu} [${taraf}]${WARNA.mati} ${pesan}${ekor}\n`);
  if (tumpukan) process.stdout.write(`${tumpukan}\n`);
}

// Tiga taraf saja. Taraf yang lebih banyak dari ini selalu berakhir
// dipakai sembarangan, lalu tak ada lagi yang bisa disaring.
const catatan = {
  // Ada yang rusak dan seseorang harus melihatnya.
  galat: (pesan, konteks) => tulis('galat', pesan, konteks),
  // Berjalan terus, tapi tidak sebagaimana mestinya -- misalnya push
  // gagal terkirim sementara pemberitahuannya sendiri tersimpan.
  ingat: (pesan, konteks) => tulis('ingat', pesan, konteks),
  // Kejadian biasa yang perlu diketahui: server menyala, mati.
  info: (pesan, konteks) => tulis('info', pesan, konteks),
};

// Meringkas galat menjadi bidang-bidang yang bisa disaring. Tumpukan
// hanya disertakan untuk galat yang sungguh tak terduga; menyertakannya
// pada kegagalan yang sudah dipahami hanya menenggelamkan catatan.
function dariGalat(err, { tumpukan = true } = {}) {
  if (!err) return {};
  return rapikan({
    galat: err.name,
    sebab: err.message,
    // Kode galat PostgreSQL (23505 = duplikat, 23503 = kunci asing, ...).
    // Justru ini yang paling cepat menunjuk penyebabnya.
    kode_pg: err.code,
    tabel: err.table,
    batasan: err.constraint,
    tumpukan: tumpukan ? err.stack : undefined,
  });
}

module.exports = { catatan, dariGalat, waktuSetempat };
