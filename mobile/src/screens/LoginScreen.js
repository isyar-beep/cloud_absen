import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWarna } from '../theme';
import PilihTema from '../components/PilihTema';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { registerForPushNotifications } from '../services/notifications';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const w = useWarna();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => buatGaya(w), [w]);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Perhatian', 'Email dan password wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email: email.trim(), password });
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
    // KeyboardAvoidingView + ScrollView: tanpa keduanya, papan ketik HP
    // menutupi kolom password dan pegawai mengetik tanpa bisa melihat apa
    // yang diketiknya. Di Android 'height' bekerja lebih andal daripada
    // 'padding', yang justru dipakai iOS.
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.isi,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logo}>
          <Text style={styles.logoText}>CA</Text>
        </View>
        <Text style={styles.title}>Cloud Absen</Text>
        <Text style={styles.subtitle}>Masuk ke akun Anda untuk melanjutkan</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="nama@perusahaan.com"
          placeholderTextColor={w.teksSamar}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={w.teksSamar}
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonMati]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Memproses...' : 'Masuk'}</Text>
        </TouchableOpacity>

        <View style={styles.temaWadah}>
          <Text style={styles.temaLabel}>Tampilan</Text>
          <PilihTema />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const buatGaya = (w) => StyleSheet.create({
  container: { flex: 1, backgroundColor: w.latar },
  isi: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: w.utama,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16,
  },
  logoText: { color: w.teksDiWarna, fontSize: 20, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '600', textAlign: 'center', color: w.teks },
  subtitle: { fontSize: 13, color: w.teksRedup, textAlign: 'center', marginTop: 4, marginBottom: 28 },

  label: { fontSize: 12, fontWeight: '600', color: w.teksRedup, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: w.garisTebal, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16, fontSize: 15,
    backgroundColor: w.permukaan,
    // Tanpa baris ini teksnya digambar hitam bawaan sistem -- tidak
    // terlihat sama sekali di atas kolom gelap.
    color: w.teks,
  },
  button: {
    backgroundColor: w.utama, borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
  },
  buttonMati: { opacity: 0.6 },
  buttonText: { color: w.teksDiWarna, fontWeight: '700', fontSize: 15 },

  temaWadah: { marginTop: 32, alignItems: 'center', gap: 8 },
  temaLabel: { fontSize: 11, color: w.teksSamar, fontWeight: '600' },
});
