import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import api from '../services/api';

const statusInfo = {
  pending: { text: 'Menunggu', color: '#b45309', bg: '#fffbeb' },
  approved: { text: 'Disetujui', color: '#15803d', bg: '#f0fdf4' },
  rejected: { text: 'Ditolak', color: '#b91c1c', bg: '#fef2f2' },
};

export default function LeavesScreen() {
  const [leaves, setLeaves] = useState([]);
  const [form, setForm] = useState({ start_date: '', end_date: '', reason: '' });
  const [loading, setLoading] = useState(false);

  const fetchLeaves = useCallback(async () => {
    try {
      const res = await api.get('/leaves/me');
      setLeaves(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  async function handleSubmit() {
    // Validasi format tanggal sederhana (YYYY-MM-DD) sebelum dikirim ke backend
    const formatTanggalValid = /^\d{4}-\d{2}-\d{2}$/;
    if (!formatTanggalValid.test(form.start_date) || !formatTanggalValid.test(form.end_date)) {
      Alert.alert('Perhatian', 'Isi tanggal dengan format YYYY-MM-DD, contoh: 2026-07-25');
      return;
    }
    if (!form.reason.trim()) {
      Alert.alert('Perhatian', 'Alasan izin wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/leaves', form);
      Alert.alert('Berhasil', res.data.message);
      setForm({ start_date: '', end_date: '', reason: '' });
      fetchLeaves();
    } catch (err) {
      Alert.alert('Gagal', err.response?.data?.message || 'Gagal mengirim pengajuan izin.');
    } finally {
      setLoading(false);
    }
  }

  function formatTanggal(d) {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>Ajukan Izin Baru</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Dari (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-07-25"
              value={form.start_date}
              onChangeText={(v) => setForm({ ...form, start_date: v })}
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Sampai (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-07-26"
              value={form.end_date}
              onChangeText={(v) => setForm({ ...form, end_date: v })}
            />
          </View>
        </View>
        <Text style={styles.label}>Alasan</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Contoh: keperluan keluarga, sakit, dll."
          multiline
          numberOfLines={3}
          value={form.reason}
          onChangeText={(v) => setForm({ ...form, reason: v })}
        />
        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Mengirim...' : 'Ajukan Izin'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Riwayat Pengajuan</Text>
      {leaves.map((item) => {
        const info = statusInfo[item.status] || statusInfo.pending;
        return (
          <View key={item.id} style={styles.card}>
            <View style={styles.leaveHeader}>
              <Text style={styles.leaveDate}>
                {formatTanggal(item.start_date)}
                {item.start_date !== item.end_date ? ` — ${formatTanggal(item.end_date)}` : ''}
              </Text>
              <View style={[styles.badge, { backgroundColor: info.bg }]}>
                <Text style={[styles.badgeText, { color: info.color }]}>{info.text}</Text>
              </View>
            </View>
            <Text style={styles.leaveReason}>{item.reason}</Text>
            {item.admin_note ? (
              <Text style={styles.adminNote}>Catatan admin: {item.admin_note}</Text>
            ) : null}
          </View>
        );
      })}
      {leaves.length === 0 && (
        <Text style={styles.empty}>Belum ada pengajuan izin.</Text>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8, marginTop: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10,
  },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  label: { fontSize: 12, color: '#374151', marginBottom: 4, fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 14, backgroundColor: '#fff',
  },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  button: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  leaveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  leaveDate: { fontSize: 14, color: '#111827', fontWeight: '500', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  leaveReason: { fontSize: 13, color: '#6b7280' },
  adminNote: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  empty: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 24 },
});
