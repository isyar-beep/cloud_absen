import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
} from 'react-native';
import api from '../services/api';
import { formatTanggalHari, formatJam } from '../utils/tanggal';

const LIMIT = 30;

const statusInfo = {
  hadir: { text: 'Hadir', color: '#15803d', bg: '#f0fdf4' },
  terlambat: { text: 'Hadir (Terlambat)', color: '#b45309', bg: '#fffbeb' },
  izin: { text: 'Izin', color: '#1d4ed8', bg: '#eff6ff' },
  alpha: { text: 'Alpha', color: '#b91c1c', bg: '#fef2f2' },
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
  const [statusFilter, setStatusFilter] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset };
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/attendance/history', { params });
      setItems((prev) => (append ? [...prev, ...res.data] : res.data));
      setHasMore(res.data.length === LIMIT);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function renderItem({ item }) {
    const info = statusInfo[item.status] || statusInfo.hadir;
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
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Tidak ada data untuk filter ini.</Text> : null
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
  empty: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 24 },
  loadMore: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  loadMoreText: { fontSize: 13, color: '#374151', fontWeight: '500' },
});
