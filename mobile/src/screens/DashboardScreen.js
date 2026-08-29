import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWarna } from '../theme';
import Avatar from '../components/Avatar';
import { useTokenFoto } from '../services/fotoUrl';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { formatJam, formatTanggalHari, formatTanggalSingkat, tanggalLokal } from '../utils/tanggal';

const LABEL_STATUS = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  izin: 'Izin',
  alpha: 'Alpha',
};

// Satu baris "kapan boleh absen": rentang jamnya plus titik warna --
// hijau berarti sedang dibuka, abu berarti belum atau sudah lewat, biru
// berarti absennya memang sudah dilakukan. Kembaran JendelaBaris di
// frontend/src/pages/Attendance.jsx.
//
// `tanggal` diberi penanda hanya kalau bukan hari ini. Kedua jendela bisa
// jatuh pada tanggal yang BERBEDA -- misalnya pada malam hari setelah jam
// kerja usai, absen pulang masih menunjuk shift hari ini yang sudah
// ditutup sementara absen masuk sudah bergeser ke shift besok pagi. Tanpa
// penanda ini keduanya terbaca seolah milik satu tanggal yang sama.
function JendelaBaris({ label, info, tanggal, hariIni, selesai, tutup, styles, w }) {
  const warna = selesai ? w.titikSelesai : info?.boleh ? w.titikHidup : w.titikMati;
  const keterangan = tutup
    ? 'Kantor tutup'
    : selesai ? 'Sudah dilakukan' : info?.boleh ? 'Dibuka sekarang' : 'Belum dibuka';
  const bedaTanggal = tanggal && hariIni && tanggal !== hariIni;

  return (
    <View style={styles.jendelaKolom}>
      <Text style={styles.jendelaLabel}>{label}</Text>
      {bedaTanggal ? (
        <Text style={styles.jendelaTanggal}>{formatTanggalSingkat(tanggal)}</Text>
      ) : null}
      <Text style={styles.jendelaJam}>{info ? `${info.buka}–${info.tutup}` : '—'}</Text>
      <View style={styles.jendelaStatusRow}>
        <View style={[styles.titik, { backgroundColor: warna }]} />
        <Text style={styles.jendelaStatus}>
          {tutup || selesai || info?.boleh
            ? keterangan
            : info?.alasan?.replace(/^Absen \w+ /, '') || keterangan}
        </Text>
      </View>
    </View>
  );
}

function KartuAngka({ label, nilai, warna, styles }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, warna ? { color: warna } : null]}>{nilai}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user } = useAuthStore();
  const [info, setInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [memuat, setMemuat] = useState(false);
  const w = useWarna();
  const insets = useSafeAreaInsets();
  const tokenFoto = useTokenFoto();
  const styles = useMemo(() => buatGaya(w), [w]);

  // Ketiga permintaan dijalankan terpisah dengan allSettled, bukan
  // Promise.all. Dengan Promise.all satu kegagalan membatalkan semuanya
  // sekaligus, dan layar kehilangan statistik tanpa memberi tahu apa pun
  // -- persis kejadian "statistik tidak muncul di HP" yang sulit dilacak.
  const ambilData = useCallback(async () => {
    setMemuat(true);
    const [todayRes, statsRes, historyRes] = await Promise.allSettled([
      api.get('/attendance/today'),
      api.get('/stats/me'),
      api.get('/attendance/history?limit=5'),
    ]);

    if (todayRes.status === 'fulfilled') setInfo(todayRes.value.data);
    if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
    if (historyRes.status === 'fulfilled') setHistory(historyRes.value.data);

    const gagal = [todayRes, statsRes, historyRes].find((r) => r.status === 'rejected');
    setError(
      gagal
        ? gagal.reason?.response?.data?.message
          || 'Sebagian data gagal dimuat. Periksa koneksi Anda.'
        : ''
    );
    setMemuat(false);
  }, []);

  useEffect(() => {
    ambilData();
    const lepas = navigation.addListener('focus', ambilData);
    // Jendela absen bergerak mengikuti jam. Tanpa penyegaran berkala,
    // pegawai yang membuka layar ini pukul 07.28 akan terus melihat
    // "belum dibuka" walau sudah lewat pukul 07.30.
    const timer = setInterval(ambilData, 30000);
    return () => {
      lepas();
      clearInterval(timer);
    };
  }, [navigation, ambilData]);

  const absensi = info?.absensi;
  const sudahCheckIn = !!absensi?.check_in_time;
  const sudahCheckOut = !!absensi?.check_out_time;
  const shift = info?.shift;
  const kantorTutup = !!info?.hari_kerja && !info.hari_kerja.kerja;
  // Catatan tunggal "tercatat untuk tanggal X" hanya jujur kalau KEDUA
  // jendela memang menunjuk tanggal shift yang sama -- misalnya shift
  // malam yang sedang berjalan, tempat absen masuk tadi malam dan absen
  // pulang pagi ini sama-sama milik tanggal kemarin.
  //
  // Kalau keduanya berbeda tanggal, satu kalimat tidak bisa mewakili
  // keduanya; yang menjelaskan adalah penanda tanggal di tiap jendela.
  const tanggalSatu = info?.tanggal_shift_masuk === info?.tanggal_shift_pulang
    ? info?.tanggal_shift_masuk
    : null;
  const tanggalShiftBeda = tanggalSatu && tanggalSatu !== info.hari_ini;

  // Salinan aturan server, supaya pegawai tahu duluan tanpa harus memotret
  // dulu lalu ditolak. Server tetap yang memutuskan.
  const bolehMasuk = !sudahCheckIn && !!info?.masuk?.boleh;
  const bolehPulang = sudahCheckIn && !sudahCheckOut && !!info?.pulang?.boleh;

  const catatanMasuk = sudahCheckIn ? null : info?.masuk?.alasan;
  const catatanPulang = kantorTutup
    ? info?.pulang?.alasan
    : !sudahCheckIn
      ? 'Absen masuk dulu sebelum absen pulang.'
      : sudahCheckOut
        ? null
        : info?.pulang?.alasan;

  const tanggalHariIni = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={memuat} onRefresh={ambilData} />}
    >
      {/* Kepala berwarna, sejajar dengan tampilan web.
          paddingTop mengikuti tinggi bilah status HP. Tanpa itu isinya
          menyelinap ke bawah jam dan ikon sinyal, dan tombol di pojok
          berhimpitan dengan area tarik-turun notifikasi -- menekannya
          justru membuka panel notifikasi HP. */}
      <View style={[styles.hero, { paddingTop: insets.top + 14 }]}>
        <View style={styles.heroRow}>
          <View style={styles.heroTeks}>
            <Text style={styles.heroTanggal}>{tanggalHariIni}</Text>
            <Text style={styles.heroNama} numberOfLines={1}>Halo, {user?.name} 👋</Text>
            {shift ? (
              <Text style={styles.heroShift}>
                {shift.nama} · {shift.mulai}–{shift.selesai}
                {shift.lintas_hari ? ' (+1 hari)' : ''}
              </Text>
            ) : null}
          </View>

          {/* Satu pintu ke seluruh pengaturan akun: foto profil, tema,
              ubah password, keluar. Avatar dipilih daripada ikon roda gigi
              karena sekaligus memberi tahu pegawai sedang masuk sebagai
              siapa -- penting di HP yang kadang dipakai bergantian. */}
          <TouchableOpacity
            style={styles.tombolProfil}
            onPress={() => navigation.navigate('Profil')}
            accessibilityLabel="Profil dan pengaturan"
          >
            <Avatar nama={user?.name} url={user?.avatar_url} token={tokenFoto} ukuran={40} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.isi}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Kartu shift: jam kerja dan kapan absen dibuka, sebelum menekan
            tombol apa pun. */}
        {shift ? (
          <View style={styles.card}>
            <View style={styles.shiftHeader}>
              <View style={styles.shiftKolom}>
                <Text style={styles.kecil}>Shift Anda</Text>
                <Text style={styles.besar} numberOfLines={1}>{shift.nama}</Text>
              </View>
              <View style={[styles.shiftKolom, { alignItems: 'flex-end' }]}>
                <Text style={styles.kecil}>Jam kerja</Text>
                <Text style={styles.besar}>
                  {shift.mulai}–{shift.selesai}
                  {shift.lintas_hari ? <Text style={styles.plusHari}> +1 hari</Text> : null}
                </Text>
              </View>
            </View>

            {shift.hari_kerja_teks ? (
              <Text style={styles.hariKerja}>Hari kerja: {shift.hari_kerja_teks}</Text>
            ) : null}

            {info?.wfa?.aktif ? (
              <Text style={[styles.catatan, styles.catatanUngu]}>
                Hari ini Anda terdaftar WFA.{' '}
                {info.wfa.catatan || 'Absen tetap seperti biasa, berfoto.'}
              </Text>
            ) : null}

            {kantorTutup ? (
              <Text style={[styles.catatan, styles.catatanKuning]}>
                {info.hari_kerja.libur
                  ? `Hari libur: ${info.hari_kerja.libur}. Absen ditutup hari ini.`
                  : `${info.hari_kerja.nama_hari} bukan hari kerja. Absen ditutup hari ini.`}
              </Text>
            ) : null}

            {tanggalShiftBeda ? (
              <Text style={[styles.catatan, styles.catatanUngu]}>
                Absen ini tercatat untuk shift tanggal {formatTanggalHari(tanggalSatu)}.
              </Text>
            ) : null}

            <View style={styles.jendelaRow}>
              <JendelaBaris
                label="Absen masuk" info={info.masuk}
                tanggal={info.tanggal_shift_masuk} hariIni={info.hari_ini}
                selesai={sudahCheckIn} tutup={kantorTutup} styles={styles} w={w}
              />
              <JendelaBaris
                label="Absen pulang" info={info.pulang}
                tanggal={info.tanggal_shift_pulang} hariIni={info.hari_ini}
                selesai={sudahCheckOut} tutup={kantorTutup} styles={styles} w={w}
              />
            </View>
          </View>
        ) : null}

        {/* Jam masuk & pulang hari ini */}
        <View style={[styles.card, styles.jamRow]}>
          <View style={styles.jamKolom}>
            <Text style={styles.kecil}>Jam masuk</Text>
            <Text style={styles.jamNilai}>{sudahCheckIn ? formatJam(absensi.check_in_time) : '—'}</Text>
          </View>
          <View style={styles.pemisah} />
          <View style={styles.jamKolom}>
            <Text style={styles.kecil}>Jam pulang</Text>
            <Text style={styles.jamNilai}>{sudahCheckOut ? formatJam(absensi.check_out_time) : '—'}</Text>
          </View>
        </View>

        {/* Tombol absen */}
        <View>
          <TouchableOpacity
            style={[styles.tombolUtama, !bolehMasuk && styles.tombolMati]}
            disabled={!bolehMasuk}
            onPress={() => navigation.navigate('Camera', { mode: 'check-in' })}
          >
            <Text style={styles.tombolTeks}>
              {sudahCheckIn ? 'Sudah Absen Masuk' : 'Absen Masuk'}
            </Text>
          </TouchableOpacity>
          {catatanMasuk ? <Text style={styles.tombolCatatan}>{catatanMasuk}</Text> : null}
        </View>

        <View style={{ marginTop: 10 }}>
          <TouchableOpacity
            style={[styles.tombolGelap, !bolehPulang && styles.tombolMati]}
            disabled={!bolehPulang}
            onPress={() => navigation.navigate('Camera', { mode: 'check-out' })}
          >
            <Text style={styles.tombolTeks}>
              {sudahCheckOut ? 'Sudah Absen Pulang' : 'Absen Pulang'}
            </Text>
          </TouchableOpacity>
          {catatanPulang ? <Text style={styles.tombolCatatan}>{catatanPulang}</Text> : null}
        </View>

        {/* Statistik bulan berjalan */}
        <Text style={styles.judulBagian}>Statistik Bulan Ini</Text>
        {stats ? (
          <View style={styles.statGrid}>
            <KartuAngka label="Total Hadir" nilai={`${stats.total_hadir} hari`} warna={w.status.hadir.teks} styles={styles} />
            <KartuAngka label="Tingkat Kehadiran" nilai={`${stats.attendance_rate}%`} warna={w.aksen.biru} styles={styles} />
            <KartuAngka label="Terlambat" nilai={`${stats.total_terlambat} kali`} warna={w.status.terlambat.teks} styles={styles} />
            <KartuAngka label="Rata-rata Kerja" nilai={`${stats.avg_work_hours} jam`} warna={w.aksen.ungu} styles={styles} />
          </View>
        ) : (
          // Kalau statistik gagal dimuat, katakan begitu. Sebelumnya blok
          // ini hilang diam-diam dan layar tampak memang tidak punya
          // statistik sama sekali.
          <View style={styles.card}>
            <Text style={styles.kosong}>
              {memuat ? 'Memuat statistik...' : 'Statistik belum bisa dimuat. Tarik layar ke bawah untuk mencoba lagi.'}
            </Text>
          </View>
        )}

        {/* Absen pulang yang tidak pernah terisi. Muncul hanya kalau ada --
            kotak yang selamanya menampilkan angka 0 cuma memakan ruang.
            Sengaja di luar kisi statistik: ini bukan capaian yang diukur,
            melainkan pekerjaan yang menunggu diselesaikan. */}
        {stats?.total_tidak_lengkap > 0 ? (
          <TouchableOpacity
            style={styles.peringatanKurang}
            onPress={() => navigation.navigate('History')}
          >
            <Text style={styles.peringatanJudul}>
              {stats.total_tidak_lengkap} hari tanpa absen pulang
            </Text>
            <Text style={styles.peringatanTeks}>
              Kehadiran Anda tetap terhitung. Ketuk untuk mengajukan koreksi.
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Riwayat terbaru */}
        <View style={styles.judulRow}>
          <Text style={styles.judulBagian}>Riwayat Terbaru</Text>
          <TouchableOpacity onPress={() => navigation.navigate('History')}>
            <Text style={styles.tautan}>Lihat semua →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {history.map((item, i) => {
            // Ikut menguning kalau catatannya tidak lengkap, sama seperti di
            // layar Riwayat dan di web. Rinciannya ada di sana; di sini
            // warnanya saja yang memberi tahu ada yang perlu dilihat.
            const s = item.kurang
              ? w.status.terlambat
              : (w.status[item.status] || w.status.hadir);
            return (
              <View key={item.id} style={[styles.riwayatBaris, i > 0 && styles.riwayatGaris]}>
                <View>
                  <Text style={styles.riwayatTanggal}>
                    {tanggalLokal(item.date).toLocaleDateString('id-ID', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                  </Text>
                  <Text style={styles.riwayatJam}>
                    {item.check_in_time ? `Masuk ${formatJam(item.check_in_time)}` : 'Tidak ada jam masuk'}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: s.latar }]}>
                  <Text style={[styles.badgeText, { color: s.teks }]}>
                    {LABEL_STATUS[item.status] || LABEL_STATUS.hadir}
                  </Text>
                </View>
              </View>
            );
          })}
          {history.length === 0 ? (
            <Text style={styles.kosong}>Belum ada riwayat absensi.</Text>
          ) : null}
        </View>

        {/* Menu lain */}
        <View style={styles.menuRow}>
          <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Leaves')}>
            <Text style={styles.menuButtonText}>Ajukan Izin</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('History')}>
            <Text style={styles.menuButtonText}>Riwayat Absensi</Text>
          </TouchableOpacity>
        </View>


      </View>
    </ScrollView>
  );
}

const buatGaya = (w) => StyleSheet.create({
  container: { flex: 1, backgroundColor: w.latar },

  hero: { backgroundColor: w.utama, paddingBottom: 56, paddingHorizontal: 16 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  heroTeks: { flex: 1 },
  heroTanggal: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  heroNama: { fontSize: 19, fontWeight: '700', color: w.teksDiWarna, marginTop: 2 },
  heroShift: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 },

  // Avatar diberi cincin putih tipis supaya tetap terlihat sebagai tombol
  // di atas hero biru, termasuk saat fotonya kebetulan berwarna serupa.
  tombolProfil: {
    borderRadius: 24, padding: 2,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)',
  },

  isi: { paddingHorizontal: 16, marginTop: -42 },
  pesan: {
    fontSize: 12, color: w.hijau.teks, backgroundColor: w.hijau.latar,
    borderWidth: 1, borderColor: w.hijau.garis, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, fontWeight: '600',
  },
  error: {
    fontSize: 12, color: w.merah.teks, backgroundColor: w.merah.latar,
    borderWidth: 1, borderColor: w.merah.garis, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },

  card: {
    backgroundColor: w.permukaan, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: w.garis, marginBottom: 12,
  },
  shiftHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  shiftKolom: { flex: 1 },
  kecil: { fontSize: 11, color: w.teksRedup },
  besar: { fontSize: 15, fontWeight: '700', color: w.teks, marginTop: 1 },
  plusHari: { fontSize: 11, fontWeight: '600', color: w.aksen.ungu },
  hariKerja: { fontSize: 11, color: w.teksRedup, marginTop: 8 },

  catatan: {
    fontSize: 11, borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6, marginTop: 10,
  },
  catatanUngu: { color: w.ungu.teks, backgroundColor: w.ungu.latar, borderColor: w.ungu.garis },
  catatanKuning: { color: w.kuning.teks, backgroundColor: w.kuning.latar, borderColor: w.kuning.garis },

  jendelaRow: {
    flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: w.permukaan2,
  },
  jendelaKolom: { flex: 1 },
  jendelaLabel: { fontSize: 11, color: w.teksSamar },
  jendelaTanggal: { fontSize: 11, fontWeight: '600', color: w.aksen.ungu, marginTop: 1 },
  jendelaJam: { fontSize: 13, fontWeight: '600', color: w.teks, marginTop: 1 },
  jendelaStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  titik: { width: 6, height: 6, borderRadius: 3 },
  jendelaStatus: { fontSize: 11, color: w.teksRedup, flexShrink: 1 },

  jamRow: { flexDirection: 'row', alignItems: 'center' },
  jamKolom: { flex: 1 },
  jamNilai: { fontSize: 18, fontWeight: '700', color: w.teks, marginTop: 2 },
  pemisah: { width: 1, alignSelf: 'stretch', backgroundColor: w.permukaan2, marginHorizontal: 12 },

  tombolUtama: {
    backgroundColor: w.utama, borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  tombolGelap: {
    backgroundColor: w.teks, borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  tombolMati: { opacity: 0.4 },
  tombolTeks: { color: w.teksDiWarna, fontWeight: '700', fontSize: 14 },
  tombolCatatan: { fontSize: 11, color: w.teksRedup, textAlign: 'center', marginTop: 6 },

  judulBagian: { fontSize: 14, fontWeight: '700', color: w.teks, marginTop: 22, marginBottom: 10 },
  judulRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tautan: { fontSize: 12, color: w.utama, fontWeight: '600', marginTop: 12 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 2 },
  peringatanKurang: {
    marginTop: 12, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: w.status.terlambat.latar,
    borderWidth: 1, borderColor: w.status.terlambat.teks,
  },
  peringatanJudul: { fontSize: 13, fontWeight: '700', color: w.status.terlambat.teks },
  peringatanTeks: { fontSize: 11, color: w.status.terlambat.teks, opacity: 0.85, marginTop: 2 },
  statCard: {
    width: '47.5%', flexGrow: 1, backgroundColor: w.permukaan, borderRadius: 14,
    borderWidth: 1, borderColor: w.garis, paddingVertical: 14, paddingHorizontal: 14,
  },
  statValue: { fontSize: 19, fontWeight: '700', color: w.teks },
  statLabel: { fontSize: 11, color: w.teksRedup, marginTop: 2 },

  riwayatBaris: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 10,
  },
  riwayatGaris: { borderTopWidth: 1, borderTopColor: w.permukaan2 },
  riwayatTanggal: { fontSize: 13, fontWeight: '600', color: w.teks },
  riwayatJam: { fontSize: 11, color: w.teksSamar, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  kosong: { fontSize: 12, color: w.teksSamar, textAlign: 'center', paddingVertical: 14 },

  menuRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  menuButton: {
    flex: 1, backgroundColor: w.permukaan, borderRadius: 14, paddingVertical: 13,
    alignItems: 'center', borderWidth: 1, borderColor: w.garis,
  },
  menuButtonText: { fontSize: 13, color: w.teksBadan, fontWeight: '600' },
});
