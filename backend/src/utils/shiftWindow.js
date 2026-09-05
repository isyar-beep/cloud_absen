// ============================================================
// Jendela waktu absen: kapan seorang pegawai boleh absen masuk dan pulang.
//
// Dua hal yang diselesaikan berkas ini:
//
// 1. BATAS WAKTU. Tiap shift punya jendela sendiri, dihitung dalam menit
//    relatif terhadap jam mulai/selesai shift. Jadi aturan yang sama
//    berlaku untuk shift pagi maupun malam tanpa jam ajaib di kode.
//
// 2. SHIFT YANG MELEWATI TENGAH MALAM. Shift 22:00-06:00 mulai di satu
//    tanggal dan selesai di tanggal berikutnya. Sebelumnya absen pulang
//    dicari dengan `date = tanggal hari ini`, sehingga pegawai shift malam
//    yang pulang jam 06:10 keesokan harinya selalu ditolak dengan pesan
//    "belum absen masuk hari ini". Di sini satu absensi diikat ke TANGGAL
//    SHIFT -- tanggal saat shift itu DIMULAI -- bukan tanggal kalender saat
//    tombolnya ditekan.
// ============================================================

const { hariKerjaShift, ringkasHariKerja } = require('./workday');

const MENIT_SEHARI = 1440;

// Nilai cadangan kalau pegawai belum di-assign ke shift manapun.
const SHIFT_DEFAULT = {
  name: 'Reguler',
  start_time: '08:00:00',
  end_time: '17:00:00',
  // 0=Minggu ... 6=Sabtu. Senin-Jumat, sama seperti sebelum hari kerja
  // bisa diatur per shift (migration 009).
  work_days: [1, 2, 3, 4, 5],
  checkin_open_minutes: 30,
  checkin_close_minutes: 240,
  checkout_open_minutes: 15,
  checkout_close_minutes: 360,
};

// "08:30:00" -> 510
function keMenit(jam) {
  const [h, m] = String(jam).split(':').map(Number);
  return h * 60 + m;
}

function tanggalStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "07.30" -- dipakai di pesan penolakan dan di layar pegawai
function jamRingkas(d) {
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;
}

// Shift yang jam selesainya tidak lebih besar dari jam mulai berarti
// menyeberang tengah malam (22:00-06:00). Shift 24 jam penuh
// (08:00-08:00) juga masuk sini dan diperlakukan sepanjang 24 jam.
function lintasTengahMalam(shift) {
  return keMenit(shift.end_time) <= keMenit(shift.start_time);
}

// Lama shift dalam menit; 0 diperlakukan sebagai 24 jam penuh.
function durasiMenit(shift) {
  const selisih = (keMenit(shift.end_time) - keMenit(shift.start_time) + MENIT_SEHARI) % MENIT_SEHARI;
  return selisih === 0 ? MENIT_SEHARI : selisih;
}

// Bentuk satu "kejadian shift" konkret: shift yang dimulai pada tanggal
// tertentu, lengkap dengan seluruh batas waktunya sebagai objek Date.
function kejadianShift(shift, tanggalMulai) {
  const [jam, menit] = String(shift.start_time).split(':').map(Number);
  const mulai = new Date(tanggalMulai);
  mulai.setHours(jam, menit, 0, 0);

  const selesai = new Date(mulai.getTime() + durasiMenit(shift) * 60000);
  const geser = (dasar, m) => new Date(dasar.getTime() + m * 60000);

  return {
    tanggal_shift: tanggalStr(mulai),
    mulai,
    selesai,
    masukBuka: geser(mulai, -shift.checkin_open_minutes),
    masukTutup: geser(mulai, shift.checkin_close_minutes),
    pulangBuka: geser(selesai, -shift.checkout_open_minutes),
    pulangTutup: geser(selesai, shift.checkout_close_minutes),
  };
}

// Pilih kejadian shift yang relevan untuk suatu momen.
//
// Dicoba shift yang mulai kemarin, hari ini, dan besok. Untuk shift biasa
// hanya "hari ini" yang pernah cocok; kandidat kemarin baru berguna untuk
// shift malam (absen pulang jam 06:10 milik shift yang mulai kemarin
// jam 22:00), dan kandidat besok untuk absen masuk lebih awal yang
// kebetulan melewati tengah malam.
//
// Kalau tidak ada yang jendelanya sedang terbuka, dikembalikan kejadian
// yang jam mulainya paling dekat dengan sekarang -- supaya layar pegawai
// tetap bisa memberi tahu "absen masuk dibuka pukul sekian".
function pilihKejadian(shift, sekarang, jenis) {
  const hari = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
  const kandidat = [-1, 0, 1].map((geser) => {
    const t = new Date(hari);
    t.setDate(t.getDate() + geser);
    return kejadianShift(shift, t);
  });

  const cocok = kandidat.find((k) =>
    jenis === 'pulang'
      ? sekarang >= k.pulangBuka && sekarang <= k.pulangTutup
      : sekarang >= k.masukBuka && sekarang <= k.masukTutup
  );
  if (cocok) return cocok;

  const patokan = jenis === 'pulang' ? 'selesai' : 'mulai';
  return kandidat.reduce((a, b) =>
    Math.abs(b[patokan] - sekarang) < Math.abs(a[patokan] - sekarang) ? b : a
  );
}

// Status jendela absen masuk & pulang pada suatu momen.
// Dipakai controller untuk menolak absen di luar jam, sekaligus dipakai
// layar pegawai untuk menampilkan "sudah boleh absen atau belum".
function jendelaAbsen(shiftMentah, sekarang = new Date()) {
  const shift = { ...SHIFT_DEFAULT, ...(shiftMentah || {}) };
  const masuk = pilihKejadian(shift, sekarang, 'masuk');
  const pulang = pilihKejadian(shift, sekarang, 'pulang');

  function nilai(kejadian, buka, tutup, label) {
    if (sekarang < kejadian[buka]) {
      return {
        boleh: false,
        alasan: `Absen ${label} dibuka pukul ${jamRingkas(kejadian[buka])}.`,
        buka: jamRingkas(kejadian[buka]),
        tutup: jamRingkas(kejadian[tutup]),
      };
    }
    if (sekarang > kejadian[tutup]) {
      return {
        boleh: false,
        alasan: `Absen ${label} sudah ditutup pukul ${jamRingkas(kejadian[tutup])}.`,
        buka: jamRingkas(kejadian[buka]),
        tutup: jamRingkas(kejadian[tutup]),
      };
    }
    return {
      boleh: true,
      alasan: null,
      buka: jamRingkas(kejadian[buka]),
      tutup: jamRingkas(kejadian[tutup]),
    };
  }

  return {
    shift: {
      nama: shift.name,
      mulai: String(shift.start_time).slice(0, 5),
      selesai: String(shift.end_time).slice(0, 5),
      lintas_hari: lintasTengahMalam(shift),
      // Hari kerja ikut dikirim supaya layar pegawai bisa menyebutkan
      // "Senin-Jumat" tanpa memanggil endpoint shift terpisah.
      hari_kerja: hariKerjaShift(shift),
      hari_kerja_teks: ringkasHariKerja(shift),
    },
    // Tanggal yang dipakai menyimpan catatan absensi. Untuk shift malam,
    // absen masuk 22:00 dan absen pulang 06:10 keesokan harinya sama-sama
    // jatuh pada tanggal shift yang sama.
    tanggal_shift_masuk: masuk.tanggal_shift,
    tanggal_shift_pulang: pulang.tanggal_shift,
    masuk: nilai(masuk, 'masukBuka', 'masukTutup', 'masuk'),
    pulang: nilai(pulang, 'pulangBuka', 'pulangTutup', 'pulang'),
    // Batas telat: masuk setelah jam shift mulai dihitung terlambat.
    terlambat: sekarang > masuk.mulai,
  };
}

// Apakah jendela absen untuk SATU tanggal shift tertentu sudah tertutup?
//
// Bedanya dengan jendelaAbsen(): di sana tanggal shiftnya masih dicari dari
// jam sekarang, sedangkan di sini tanggalnya sudah diketahui -- dibaca dari
// baris absensi yang tersimpan -- dan yang ditanyakan hanya apakah waktunya
// sudah lewat.
//
// Dipakai untuk membedakan "belum absen pulang karena masih bekerja" dari
// "belum absen pulang karena lupa".
function jendelaTanggal(shiftMentah, tanggalShift, sekarang = new Date()) {
  const cocok = String(tanggalShift ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!cocok) return { masukTutup: false, pulangTutup: false };

  const shift = { ...SHIFT_DEFAULT, ...(shiftMentah || {}) };
  const kejadian = kejadianShift(
    shift,
    new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]))
  );
  return {
    masukTutup: sekarang > kejadian.masukTutup,
    pulangTutup: sekarang > kejadian.pulangTutup,
  };
}

// Ambil shift seorang pegawai berikut pengaturan jendelanya.
async function shiftPegawai(query, userId) {
  const hasil = await query(
    `SELECT s.name, s.start_time, s.end_time, s.work_days,
            s.checkin_open_minutes, s.checkin_close_minutes,
            s.checkout_open_minutes, s.checkout_close_minutes
     FROM users u LEFT JOIN shifts s ON u.shift_id = s.id
     WHERE u.id = $1`,
    [userId]
  );
  // Baris ada tapi kolomnya null berarti pegawai belum di-assign shift.
  const baris = hasil.rows[0];
  return baris && baris.start_time ? baris : null;
}

// Jendela absen SELURUH pegawai aktif sekaligus, untuk papan pantau admin
// dan daftar pengingat.
//
// Dipakai supaya dua layar itu memakai aturan yang sama persis dengan
// controller absen. Sebelumnya keduanya memakai `date = hari ini` begitu
// saja, sehingga pegawai shift malam yang sedang bekerja sejak pukul 22:00
// tadi malam tampil "belum absen" -- catatannya ada, tapi di tanggal shift
// kemarin. Jumlah pegawai selalu kecil (puluhan sampai ratusan), jadi
// menghitung di JavaScript jauh lebih murah daripada menduplikasi aturan
// shift ke dalam SQL.
async function jendelaSemuaPegawai(query, sekarang = new Date()) {
  const hasil = await query(
    `SELECT u.id, u.name, u.avatar_url, u.project_id,
            pj.name AS project_name,
            s.name AS shift_nama, s.start_time, s.end_time, s.work_days,
            s.checkin_open_minutes, s.checkin_close_minutes,
            s.checkout_open_minutes, s.checkout_close_minutes
     FROM users u
     LEFT JOIN shifts s ON u.shift_id = s.id
     LEFT JOIN projects pj ON u.project_id = pj.id
     WHERE u.is_active = TRUE AND u.role = 'staff'
     ORDER BY u.name ASC`
  );

  return hasil.rows.map((baris) => {
    const shift = baris.start_time ? { ...baris, name: baris.shift_nama } : null;
    return { pegawai: baris, jendela: jendelaAbsen(shift, sekarang) };
  });
}

module.exports = {
  jendelaAbsen,
  jendelaTanggal,
  jendelaSemuaPegawai,
  shiftPegawai,
  lintasTengahMalam,
  durasiMenit,
  SHIFT_DEFAULT,
};
