import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl,
} from 'react-native';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { unregisterPushToken } from '../services/notifications';
import { formatJam, formatTanggalHari, tanggalLokal } from '../utils/tanggal';

const statusInfo = {
  hadir: { text: 'Hadir', color: '#15803d', bg: '#f0fdf4' },
  terlambat: { text: 'Terlambat', color: '#b45309', bg: '#fffbeb' },
  izin: { text: 'Izin', color: '#1d4ed8', bg: '#eff6ff' },
  alpha: { text: 'Alpha', color: '#b91c1c', bg: '#fef2f2' },
};

// Satu baris "kapan boleh absen": rentang jamnya plus titik warna --
// hijau berarti sedang dibuka, abu berarti belum atau sudah lewat, biru
// berarti absennya memang sudah dilakukan. Kembaran JendelaBaris di
// frontend/src/pages/Attendance.jsx.
function JendelaBaris({ label, info, selesai, tutup }) {
  const warna = selesai ? '#2563eb' : info?.boleh ? '#22c55e' : '#d1d5db';
  const keterangan = tutup
    ? 'Kantor tutup'
    : selesai ? 'Sudah dilakukan' : info?.boleh ? 'Dibuka sekarang' : 'Belum dibuka';

  return (
    <View style={styles.jendelaKolom}>
      <Text style={styles.jendelaLabel}>{label}</Text>
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

function KartuAngka({ label, nilai, warna }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, warna ? { color: warna } : null]}>{nilai}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuthStore();
  const [info, setInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [memuat, setMemuat] = useState(false);

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

  async function handleLogout() {
    await unregisterPushToken(); // sebelum token JWT dihapus, supaya request masih terautentikasi
    await logout();
    navigation.replace('Login');
  }

  const absensi = info?.absensi;
  const sudahCheckIn = !!absensi?.check_in_time;
  const sudahCheckOut = !!absensi?.check_out_time;
  const shift = info?.shift;
  const kantorTutup = !!info?.hari_kerja && !info.hari_kerja.kerja;
  // tanggal_shift, bukan tanggal_shift_masuk: yang pertama sudah mengikuti
  // baris absensi yang sedang berjalan, jadi pegawai shift malam melihat
  // tanggal yang sama dengan yang dipakai server saat menyimpan.
  const tanggalShiftBeda = info?.tanggal_shift && info.tanggal_shift !== info.hari_ini;

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
      {/* Kepala berwarna, sejajar dengan tampilan web */}
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.heroTeks}>
            <Text style={styles.heroTanggal}>{tanggalHariIni}</Text>
            <Text style={styles.heroNama}>Halo, {user?.name} 👋</Text>
            {shift ? (
              <Text style={styles.heroShift}>
                {shift.nama} · {shift.mulai}–{shift.selesai}
                {shift.lintas_hari ? ' (+1 hari)' : ''}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={handleLogout} hitSlop={10}>
            <Text style={styles.logout}>Keluar</Text>
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
                Absen ini tercatat untuk shift tanggal {formatTanggalHari(info.tanggal_shift)}.
              </Text>
            ) : null}

            <View style={styles.jendelaRow}>
              <JendelaBaris label="Absen masuk" info={info.masuk} selesai={sudahCheckIn} tutup={kantorTutup} />
              <JendelaBaris label="Absen pulang" info={info.pulang} selesai={sudahCheckOut} tutup={kantorTutup} />
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
            <KartuAngka label="Total Hadir" nilai={`${stats.total_hadir} hari`} warna="#15803d" />
            <KartuAngka label="Attendance Rate" nilai={`${stats.attendance_rate}%`} warna="#2563eb" />
            <KartuAngka label="Terlambat" nilai={`${stats.total_terlambat} kali`} warna="#b45309" />
            <KartuAngka label="Rata-rata Kerja" nilai={`${stats.avg_work_hours} jam`} warna="#7c3aed" />
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

        {/* Riwayat terbaru */}
        <View style={styles.judulRow}>
          <Text style={styles.judulBagian}>Riwayat Terbaru</Text>
          <TouchableOpacity onPress={() => navigation.navigate('History')}>
            <Text style={styles.tautan}>Lihat semua →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {history.map((item, i) => {
            const s = statusInfo[item.status] || statusInfo.hadir;
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
                <View style={[styles.badge, { backgroundColor: s.bg }]}>
                  <Text style={[styles.badgeText, { color: s.color }]}>{s.text}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  hero: { backgroundColor: '#2563eb', paddingTop: 20, paddingBottom: 56, paddingHorizontal: 16 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroTeks: { flex: 1, paddingRight: 12 },
  heroTanggal: { fontSize: 12, color: '#dbeafe' },
  heroNama: { fontSize: 19, fontWeight: '700', color: '#fff', marginTop: 2 },
  heroShift: { fontSize: 12, color: '#dbeafe', marginTop: 4 },
  logout: { fontSize: 13, color: '#dbeafe', fontWeight: '600' },

  isi: { paddingHorizontal: 16, marginTop: -42 },
  error: {
    fontSize: 12, color: '#b91c1c', backgroundColor: '#fef2f2',
    borderWidth: 1, borderColor: '#fecaca', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12,
  },
  shiftHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  shiftKolom: { flex: 1 },
  kecil: { fontSize: 11, color: '#6b7280' },
  besar: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 1 },
  plusHari: { fontSize: 11, fontWeight: '600', color: '#7c3aed' },

  catatan: {
    fontSize: 11, borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6, marginTop: 10,
  },
  catatanUngu: { color: '#6d28d9', backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' },
  catatanKuning: { color: '#92400e', backgroundColor: '#fffbeb', borderColor: '#fde68a' },

  jendelaRow: {
    flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  jendelaKolom: { flex: 1 },
  jendelaLabel: { fontSize: 11, color: '#9ca3af' },
  jendelaJam: { fontSize: 13, fontWeight: '600', color: '#1f2937', marginTop: 1 },
  jendelaStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  titik: { width: 6, height: 6, borderRadius: 3 },
  jendelaStatus: { fontSize: 11, color: '#6b7280', flexShrink: 1 },

  jamRow: { flexDirection: 'row', alignItems: 'center' },
  jamKolom: { flex: 1 },
  jamNilai: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 2 },
  pemisah: { width: 1, alignSelf: 'stretch', backgroundColor: '#f3f4f6', marginHorizontal: 12 },

  tombolUtama: {
    backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  tombolGelap: {
    backgroundColor: '#111827', borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  tombolMati: { opacity: 0.4 },
  tombolTeks: { color: '#fff', fontWeight: '700', fontSize: 14 },
  tombolCatatan: { fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 6 },

  judulBagian: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 22, marginBottom: 10 },
  judulRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tautan: { fontSize: 12, color: '#2563eb', fontWeight: '600', marginTop: 12 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 2 },
  statCard: {
    width: '47.5%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 14, paddingHorizontal: 14,
  },
  statValue: { fontSize: 19, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  riwayatBaris: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 10,
  },
  riwayatGaris: { borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  riwayatTanggal: { fontSize: 13, fontWeight: '600', color: '#111827' },
  riwayatJam: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  kosong: { fontSize: 12, color: '#9ca3af', textAlign: 'center', paddingVertical: 14 },

  menuRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  menuButton: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13,
    alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb',
  },
  menuButtonText: { fontSize: 13, color: '#374151', fontWeight: '600' },
});
