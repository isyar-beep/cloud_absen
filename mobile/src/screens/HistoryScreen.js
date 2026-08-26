import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
} from 'react-native';
import { useWarna } from '../theme';
import api from '../services/api';
import AjukanKoreksiModal from '../components/AjukanKoreksiModal';
import { formatTanggalHari, formatJam } from '../utils/tanggal';
import { rentangPreset } from '../utils/periode';

const LIMIT = 30;

// Hanya labelnya yang tetap; warnanya diambil dari palet tema supaya pil
// status tidak jadi pastel menyilaukan di atas kartu gelap.
const LABEL_STATUS = {
  hadir: 'Hadir',
  terlambat: 'Hadir (Terlambat)',
  izin: 'Izin',
  alpha: 'Alpha',
};

// Preset periode. Dropdown bulan/tahun dan rentang khusus sengaja tidak
// dibawa ke mobile: di layar sempit, empat preset ini sudah menutup hampir
// semua kebutuhan, dan pemilih tanggal butuh paket tambahan.
const periodeOptions = [
  { key: 'minggu_ini', label: 'Minggu ini' },
  { key: 'bulan_ini', label: 'Bulan ini' },
  { key: 'tahun_ini', label: 'Tahun ini' },
  { key: 'semua', label: 'Semua' },
];

const TEKS_KOREKSI = {
  pending: 'Koreksi menunggu keputusan admin',
  approved: 'Koreksi disetujui',
  rejected: 'Koreksi ditolak',
};

const filterOptions = [
  { key: '', label: 'Semua' },
  { key: 'hadir', label: 'Hadir' },
  { key: 'terlambat', label: 'Terlambat' },
  { key: 'izin', label: 'Izin' },
  { key: 'alpha', label: 'Alpha' },
];

export default function HistoryScreen() {
  const [items, setItems] = useState([]);
  const [rekap, setRekap] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [periode, setPeriode] = useState('bulan_ini');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [koreksi, setKoreksi] = useState(null);
  const [ajuan, setAjuan] = useState([]);
  const [pesan, setPesan] = useState('');
  const w = useWarna();
  const styles = useMemo(() => buatGaya(w), [w]);

  const rentang = rentangPreset(periode);

  const fetchHistory = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset };
      if (statusFilter) params.status = statusFilter;
      if (rentang.start_date) params.start_date = rentang.start_date;
      if (rentang.end_date) params.end_date = rentang.end_date;

      const res = await api.get('/attendance/history', { params });
      setItems((prev) => (append ? [...prev, ...res.data] : res.data));
      setHasMore(res.data.length === LIMIT);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, rentang.start_date, rentang.end_date]);

  // Rekap tidak ikut saringan status -- justru ini yang memberi tahu ada
  // berapa banyak tiap status dalam periode terpilih.
  const fetchRekap = useCallback(async () => {
    try {
      const params = {};
      if (rentang.start_date) params.start_date = rentang.start_date;
      if (rentang.end_date) params.end_date = rentang.end_date;
      const res = await api.get('/attendance/history/summary', { params });
      setRekap(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [rentang.start_date, rentang.end_date]);

  // Status pengajuan koreksi milik sendiri, supaya baris yang sudah pernah
  // diajukan tidak menawarkan tombol "Ajukan koreksi" lagi.
  const fetchAjuan = useCallback(async () => {
    try {
      const res = await api.get('/corrections/me');
      setAjuan(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    fetchRekap();
  }, [fetchRekap]);

  useEffect(() => {
    fetchAjuan();
  }, [fetchAjuan]);

  // Satu pengajuan aktif per tanggal; yang terbaru menang.
  const ajuanPerTanggal = ajuan.reduce((hasil, a) => {
    if (!hasil[a.date]) hasil[a.date] = a;
    return hasil;
  }, {});

  function renderItem({ item }) {
    const info = w.status[item.status] || w.status.hadir;
    const label = LABEL_STATUS[item.status] || LABEL_STATUS.hadir;
    const pengajuan = ajuanPerTanggal[item.date];
    const ket = pengajuan ? TEKS_KOREKSI[pengajuan.status] : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.date}>{formatTanggalHari(item.date)}</Text>
          <View style={[styles.badge, { backgroundColor: info.latar }]}>
            <Text style={[styles.badgeText, { color: info.teks }]}>{label}</Text>
          </View>
        </View>
        <Text style={styles.times}>
          Masuk: {formatJam(item.check_in_time)}   Pulang: {formatJam(item.check_out_time)}
        </Text>
        {item.reason ? <Text style={styles.reason}>{item.reason}</Text> : null}

        {/* Jalur resmi untuk jam yang keliru atau lupa absen pulang. Hari
            berstatus izin tidak menawarkan koreksi jam -- itu ranah
            pengajuan izin, bukan koreksi absen. Sama seperti di web. */}
        {item.status !== 'izin' ? (
          ket ? (
            <Text style={[styles.koreksiStatus, { color: w.status[pengajuan.status]?.teks || w.teksRedup }]}>
              {ket}
              {pengajuan.admin_note ? <Text style={styles.catatanAdmin}> — {pengajuan.admin_note}</Text> : null}
            </Text>
          ) : (
            <TouchableOpacity onPress={() => setKoreksi(item)} hitSlop={6}>
              <Text style={styles.koreksiTombol}>Ajukan koreksi</Text>
            </TouchableOpacity>
          )
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {pesan ? <Text style={styles.pesan}>✓ {pesan}</Text> : null}

      {/* Pilih periode */}
      <View style={styles.filterRow}>
        {periodeOptions.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.filterChip, periode === p.key && styles.filterChipActive]}
            onPress={() => setPeriode(p.key)}
          >
            <Text style={[styles.filterText, periode === p.key && styles.filterTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Rekap periode terpilih. Angkanya juga jadi pintasan ke saringan
          status yang bersangkutan. */}
      {rekap ? (
        <View>
          <View style={styles.rekapRow}>
            {[
              { key: 'hadir', label: 'Hadir', nilai: rekap.hadir, warna: w.status.hadir.teks },
              { key: 'terlambat', label: 'Terlambat', nilai: rekap.terlambat, warna: w.status.terlambat.teks },
              { key: 'izin', label: 'Izin', nilai: rekap.izin, warna: w.status.izin.teks },
              { key: 'alpha', label: 'Alpha', nilai: rekap.alpha, warna: w.status.alpha.teks },
            ].map((k) => (
              <TouchableOpacity
                key={k.key}
                style={[styles.rekapCard, statusFilter === k.key && styles.rekapCardActive]}
                onPress={() => setStatusFilter(statusFilter === k.key ? '' : k.key)}
              >
                <Text style={[styles.rekapNilai, { color: k.warna }]}>{k.nilai}</Text>
                <Text style={styles.rekapLabel}>{k.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.rekapKeterangan}>
            Kehadiran {rekap.rate}% dari {rekap.hari_efektif} hari efektif.
            {' '}Izin tidak mengurangi angka ini.
          </Text>
        </View>
      ) : null}

      {/* Filter status */}
      <View style={styles.filterRow}>
        {filterOptions.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, statusFilter === f.key && styles.filterChipActive]}
            onPress={() => setStatusFilter(f.key)}
          >
            <Text style={[styles.filterText, statusFilter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={items}
        // extraData wajib: renderItem membaca daftar pengajuan koreksi yang
        // hidup di luar `data`. Tanpa ini, baris yang baru saja diajukan
        // koreksinya tetap menampilkan tombol "Ajukan koreksi" sampai
        // daftarnya kebetulan dimuat ulang.
        extraData={ajuan}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>Tidak ada catatan absensi pada periode dan saringan ini.</Text>
          ) : null
        }
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity
              style={styles.loadMore}
              onPress={() => fetchHistory(items.length, true)}
              disabled={loading}
            >
              <Text style={styles.loadMoreText}>
                {loading ? 'Memuat...' : 'Muat Lebih Banyak'}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {koreksi ? (
        <AjukanKoreksiModal
          baris={koreksi}
          onTutup={() => setKoreksi(null)}
          onKirim={(msg) => {
            setKoreksi(null);
            setPesan(msg);
            fetchAjuan();
          }}
        />
      ) : null}
    </View>
  );
}

const buatGaya = (w) => StyleSheet.create({
  container: { flex: 1, backgroundColor: w.latar, padding: 16 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: w.permukaan, borderWidth: 1, borderColor: w.garisTebal,
  },
  filterChipActive: { backgroundColor: w.utama, borderColor: w.utama },
  filterText: { fontSize: 12, color: w.teksBadan, fontWeight: '500' },
  filterTextActive: { color: w.teksDiWarna },
  rekapRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  rekapCard: {
    flex: 1, backgroundColor: w.permukaan, borderRadius: 12, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1, borderColor: w.garis,
  },
  rekapCardActive: { borderColor: w.utama, backgroundColor: w.permukaan2 },
  rekapNilai: { fontSize: 18, fontWeight: '700' },
  rekapLabel: { fontSize: 11, color: w.teksRedup },
  rekapKeterangan: { fontSize: 11, color: w.teksSamar, marginBottom: 12 },
  card: {
    backgroundColor: w.permukaan, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: w.garis, marginBottom: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  date: { fontSize: 14, fontWeight: '500', color: w.teks },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  times: { fontSize: 12, color: w.teksRedup },
  reason: { fontSize: 12, color: w.teksSamar, marginTop: 2 },
  koreksiTombol: { fontSize: 11, fontWeight: '700', color: w.utama, marginTop: 6 },
  koreksiStatus: { fontSize: 11, fontWeight: '600', marginTop: 6 },
  catatanAdmin: { color: w.teksSamar, fontWeight: '400' },
  pesan: {
    fontSize: 12, color: w.hijau.teks, backgroundColor: w.hijau.latar,
    borderWidth: 1, borderColor: w.hijau.garis, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, fontWeight: '600',
  },
  empty: { fontSize: 13, color: w.teksSamar, textAlign: 'center', paddingVertical: 24 },
  loadMore: {
    backgroundColor: w.permukaan, borderWidth: 1, borderColor: w.garisTebal,
    borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  loadMoreText: { fontSize: 13, color: w.teksBadan, fontWeight: '500' },
});
