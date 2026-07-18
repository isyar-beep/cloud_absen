import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuthStore();
  const [todayStatus, setTodayStatus] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchData();
    const unsubscribe = navigation.addListener('focus', fetchData);
    return unsubscribe;
  }, [navigation]);

  async function fetchData() {
    try {
      const [todayRes, statsRes] = await Promise.all([
        api.get('/attendance/today'),
        api.get('/stats/me'),
      ]);
      setTodayStatus(todayRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleLogout() {
    await logout();
    navigation.replace('Login');
  }

  const sudahCheckIn = !!todayStatus?.check_in_time;
  const sudahCheckOut = !!todayStatus?.check_out_time;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Selamat datang,</Text>
          <Text style={styles.name}>{user?.name}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Keluar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.actionButton, sudahCheckIn && styles.actionButtonDisabled]}
          disabled={sudahCheckIn}
          onPress={() => navigation.navigate('Camera', { mode: 'check-in' })}
        >
          <Text style={styles.actionButtonText}>
            {sudahCheckIn ? 'Sudah Absen Masuk' : 'Absen Masuk'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButtonDark, (!sudahCheckIn || sudahCheckOut) && styles.actionButtonDisabled]}
          disabled={!sudahCheckIn || sudahCheckOut}
          onPress={() => navigation.navigate('Camera', { mode: 'check-out' })}
        >
          <Text style={styles.actionButtonText}>
            {sudahCheckOut ? 'Sudah Absen Pulang' : 'Absen Pulang'}
          </Text>
        </TouchableOpacity>
      </View>

      {stats && (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Hadir</Text>
            <Text style={styles.statValue}>{stats.total_hadir} hari</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Attendance Rate</Text>
            <Text style={styles.statValue}>{stats.attendance_rate}%</Text>
          </View>
        </View>
      )}

      <View style={styles.menuRow}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Leaves')}>
          <Text style={styles.menuButtonText}>Ajukan Izin</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('History')}>
          <Text style={styles.menuButtonText}>Riwayat Absensi</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 13, color: '#6b7280' },
  name: { fontSize: 16, fontWeight: '600', color: '#111827' },
  logout: { fontSize: 13, color: '#6b7280' },
  buttonRow: { gap: 10, marginBottom: 20 },
  actionButton: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  actionButtonDark: { backgroundColor: '#111827', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  actionButtonDisabled: { opacity: 0.4 },
  actionButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  menuRow: { flexDirection: 'row', gap: 10 },
  menuButton: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db',
  },
  menuButtonText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  statLabel: { fontSize: 11, color: '#6b7280', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '600', color: '#111827' },
});
