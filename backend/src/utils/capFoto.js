// ============================================================
// Cap koordinat & waktu yang ditanam ke dalam foto absensi.
//
// Kenapa ditanam ke gambar, bukan sekadar ditampilkan di sebelah foto:
// foto absensi sering diteruskan lewat WhatsApp ke pihak lain (dinas,
// konsultan pengawas). Keterangan yang hanya hidup di halaman web akan
// hilang begitu gambarnya keluar dari aplikasi; yang dibakar ke piksel
// ikut ke mana pun gambarnya pergi.
//
// Kenapa dikerjakan di server, bukan di HP:
//
// 1. Web dan mobile menghasilkan foto yang persis sama bentuknya.
// 2. Jamnya diambil dari jam server -- sumber yang sama dengan yang
//    ditulis ke tabel absensi. Kalau memakai jam perangkat, pegawai yang
//    menggeser jam HP-nya bisa membuat cap dan catatan saling bertentangan.
//
// CATATAN: ini keterangan, BUKAN pembatasan. Tidak ada pemeriksaan jarak
// ke kantor di mana pun -- koordinat hanya direkam dan ditampilkan.
// ============================================================

const sharp = require('sharp');
const { zonaWaktu, labelZona } = require('./date');

// Sisi terpanjang foto absensi setelah diolah. Kamera HP modern
// menghasilkan foto beberapa MB; wajah tetap jelas di 1000px sementara
// ukuran berkas turun jauh -- hemat disk server dan kuota pegawai.
// Angkanya sama dengan yang dipakai kamera web di Attendance.jsx.
const MAKS_PIKSEL = 1000;

const BULAN_SINGKAT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

// "5,10612S 119,52484E" -- gaya yang sama dengan aplikasi kamera GPS yang
// sudah biasa dipakai di lapangan, termasuk koma sebagai pemisah desimal.
function formatKoordinat(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const sisi = (nilai, positif, negatif) =>
    `${Math.abs(nilai).toFixed(5).replace('.', ',')}${nilai < 0 ? negatif : positif}`;

  return `${sisi(lat, 'N', 'S')} ${sisi(lon, 'E', 'W')}`;
}

// "26 Agu 2026 18.06.28 WITA"
//
// Bagian-bagiannya dirakit sendiri, bukan lewat toLocaleString, supaya
// susunannya tidak berubah kalau data locale di server berbeda versi.
function formatWaktu(waktu) {
  const bagian = new Intl.DateTimeFormat('en-GB', {
    timeZone: zonaWaktu(),
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(waktu).reduce((hasil, p) => {
    if (p.type !== 'literal') hasil[p.type] = p.value;
    return hasil;
  }, {});

  const bulan = BULAN_SINGKAT[Number(bagian.month) - 1] || bagian.month;
  // hourCycle h23 sesekali memberi "24" untuk tengah malam.
  const jam = bagian.hour === '24' ? '00' : bagian.hour;

  return `${Number(bagian.day)} ${bulan} ${bagian.year} ${jam}.${bagian.minute}.${bagian.second} ${labelZona()}`;
}

function escapeXml(teks) {
  return String(teks)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Lapisan SVG berisi gradasi gelap di bagian bawah foto plus barisan teks
// rata kanan. Gradasinya bukan hiasan: foto absensi bisa berlatar langit
// terang atau dinding putih, dan teks putih polos akan hilang di situ.
function lapisanSvg({ lebar, tinggi, baris }) {
  const ukuranFont = Math.max(12, Math.round(lebar * 0.028));
  const tinggiBaris = Math.round(ukuranFont * 1.32);
  const jarakTepi = Math.round(lebar * 0.022);
  const tinggiGradasi = Math.round(jarakTepi * 2 + tinggiBaris * baris.length + ukuranFont);

  const teks = baris
    .map((isi, i) => {
      const y = tinggi - jarakTepi - tinggiBaris * (baris.length - 1 - i);
      return `<text x="${lebar - jarakTepi}" y="${y}" class="cap">${escapeXml(isi)}</text>`;
    })
    .join('');

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lebar}" height="${tinggi}">
      <defs>
        <linearGradient id="redup" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.55" />
        </linearGradient>
      </defs>
      <rect x="0" y="${tinggi - tinggiGradasi}" width="${lebar}" height="${tinggiGradasi}" fill="url(#redup)" />
      <style>
        .cap {
          font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif;
          font-size: ${ukuranFont}px;
          font-weight: 600;
          fill: #ffffff;
          text-anchor: end;
        }
      </style>
      ${teks}
    </svg>`
  );
}

// Kecilkan foto, betulkan orientasinya, lalu tanam capnya.
//
// Kalau apa pun gagal di sini, buffer asli dikembalikan apa adanya:
// cap itu keterangan tambahan, dan kegagalan mengolah gambar tidak boleh
// sampai membatalkan absensi seseorang.
async function tanamCap(bufferFoto, { latitude, longitude, waktu = new Date() } = {}) {
  try {
    const gambar = sharp(bufferFoto)
      // Tanpa argumen, rotate() membaca EXIF dan menegakkan foto dari HP.
      // Tanpa ini capnya bisa berakhir di sisi yang salah.
      .rotate()
      .resize({
        width: MAKS_PIKSEL,
        height: MAKS_PIKSEL,
        fit: 'inside',
        withoutEnlargement: true,
      });

    const dasar = await gambar.jpeg({ quality: 85 }).toBuffer();
    const { width, height } = await sharp(dasar).metadata();
    if (!width || !height) return bufferFoto;

    const koordinat = formatKoordinat(latitude, longitude);
    const baris = [
      formatWaktu(waktu),
      // Cap tetap ditulis walau GPS mati. Membiarkannya kosong membuat
      // foto tampak seperti hasil aplikasi yang rusak, padahal pegawainya
      // hanya menolak izin lokasi.
      koordinat || 'Koordinat tidak tersedia',
    ];

    return await sharp(dasar)
      .composite([{ input: lapisanSvg({ lebar: width, tinggi: height, baris }), top: 0, left: 0 }])
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (err) {
    console.error('Gagal menanam cap pada foto absensi:', err.message);
    return bufferFoto;
  }
}

module.exports = { tanamCap, formatKoordinat, formatWaktu, MAKS_PIKSEL };
