import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useWarna } from '../theme';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { registerForPushNotifications } from '../services/notifications';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const w = useWarna();
  const styles = useMemo(() => buatGaya(w), [w]);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Perhatian', 'Email dan password wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      await login(res.data.user, res.data.token);
      registerForPushNotifications(); // best-effort, tidak menunda navigasi
      navigation.replace('Dashboard');
    } catch (err) {
      Alert.alert('Gagal login', err.response?.data?.message || 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>CA</Text>
      </View>
      <Text style={styles.title}>Cloud Absen</Text>
      <Text style={styles.subtitle}>Masuk ke akun Anda untuk melanjutkan</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Memproses...' : 'Masuk'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const buatGaya = (w) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: w.latar },
  logo: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: w.utama,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16,
  },
  logoText: { color: w.permukaan, fontSize: 20, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '600', textAlign: 'center', color: w.teks },
  subtitle: { fontSize: 13, color: w.teksRedup, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  input: {
    borderWidth: 1, borderColor: w.garisTebal, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, fontSize: 14, backgroundColor: w.permukaan,
  },
  button: {
    backgroundColor: w.utama, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: w.permukaan, fontWeight: '600', fontSize: 14 },
});
