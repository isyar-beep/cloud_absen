import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
} from 'react-native';
import api from '../services/api';
import AjukanKoreksiModal from '../components/AjukanKoreksiModal';
import { formatTanggalHari, formatJam } from '../utils/tanggal';
import { rentangPreset } from '../utils/periode';

const LIMIT = 30;

const statusInfo = {
  hadir: { text: 'Hadir', color: '#15803d', bg: '#f0fdf4' },
  terlambat: { text: 'Hadir (Terlambat)', color: '#b45309', bg: '#fffbeb' },
  izin: { text: 'Izin', color: '#1d4ed8', bg: '#eff6ff' },
  alpha: { text: 'Alpha', color: '#b91c1c', bg: '#fef2f2' },
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

const KETERANGAN_KOREKSI = {
  pending: { teks: 'Koreksi menunggu keputusan admin', warna: '#b45309' },
  approved: { teks: 'Koreksi disetujui', warna: '#15803d' },
  rejected: { teks: 'Koreksi ditolak', warna: '#dc2626' },
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
    const info = statusInfo[item.status] || statusInfo.hadir;
    const pengajuan = ajuanPerTanggal[item.date];
    const ket = pengajuan ? KETERANGAN_KOREKSI[pengajuan.status] : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.date}>{formatTanggalHari(item.date)}</Text>
          <View style={[styles.badge, { backgroundColor: info.bg }]}>
            <Text style={[styles.badgeText, { color: info.color }]}>{info.text}</Text>
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
            <Text style={[styles.koreksiStatus, { color: ket.warna }]}>
              {ket.teks}
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
              { key: 'hadir', label: 'Hadir', nilai: rekap.hadir, warna: '#15803d' },
              { key: 'terlambat', label: 'Terlambat', nilai: rekap.terlambat, warna: '#b45309' },
              { key: 'izin', label: 'Izin', nilai: rekap.izin, warna: '#1d4ed8' },
              { key: 'alpha', label: 'Alpha', nilai: rekap.alpha, warna: '#b91c1c' },
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db',
  },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterText: { fontSize: 12, color: '#4b5563', fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  rekapRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  rekapCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb',
  },
  rekapCardActive: { borderColor: '#93c5fd', backgroundColor: '#eff6ff' },
  rekapNilai: { fontSize: 18, fontWeight: '700' },
  rekapLabel: { fontSize: 11, color: '#6b7280' },
  rekapKeterangan: { fontSize: 11, color: '#9ca3af', marginBottom: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  date: { fontSize: 14, fontWeight: '500', color: '#111827' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  times: { fontSize: 12, color: '#6b7280' },
  reason: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  koreksiTombol: { fontSize: 11, fontWeight: '700', color: '#2563eb', marginTop: 6 },
  koreksiStatus: { fontSize: 11, fontWeight: '600', marginTop: 6 },
  catatanAdmin: { color: '#9ca3af', fontWeight: '400' },
  pesan: {
    fontSize: 12, color: '#15803d', backgroundColor: '#f0fdf4',
    borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, fontWeight: '600',
  },
  empty: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 24 },
  loadMore: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  loadMoreText: { fontSize: 13, color: '#374151', fontWeight: '500' },
});
