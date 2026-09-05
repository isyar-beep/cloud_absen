import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWarna, LENGKUNG } from '../theme';
import PilihTema from '../components/PilihTema';
import api, { API_URL } from '../services/api';
import { pesanGalat } from '../services/galat';
import { useAuthStore } from '../store/authStore';
import { registerForPushNotifications } from '../services/notifications';
import { sidikPerangkat, namaPerangkat } from '../services/perangkat';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);

  // Alasan sesi sebelumnya berakhir, dititipkan penyadap 401 saat
  // memulangkan pegawai ke sini (lihat services/api.js).
  //
  // Dibaca sekali lalu dihapus supaya tidak muncul lagi setiap kali layar
  // ini dibuka.
  const pesanSesi = useAuthStore((state) => state.pesanSesi);
  const hapusPesanSesi = useAuthStore((state) => state.hapusPesanSesi);
  useEffect(() => () => hapusPesanSesi(), []);
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
      // Penanda perangkat ikut dikirim supaya server bisa mengenali
      // "akun ini sudah pernah dipakai dari sini" dan memberi tahu
      // pemiliknya kalau muncul yang baru.
      const res = await api.post('/auth/login', {
        email: email.trim(),
        password,
        sidik_perangkat: await sidikPerangkat(),
        nama_perangkat: namaPerangkat(),
      });
      await login(res.data.user, res.data.token);
      registerForPushNotifications(); // best-effort, tidak menunda navigasi
      navigation.replace('Dashboard');
    } catch (err) {
      Alert.alert('Gagal login', pesanGalat(err, 'Terjadi kesalahan.'));
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
      {/* Pemilih tema mengambang di pojok kanan atas, di luar alur baca.
          Sebelumnya ia berupa tiga tombol berteks di bawah tombol Masuk --
          membuat halaman terasa ramai padahal yang dicari orang saat
          membuka aplikasi hanyalah kolom email. */}
      <View style={[styles.temaPojok, { top: insets.top + 8 }]}>
        <PilihTema />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.isi,
          { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logo}>
          <Text style={styles.logoText}>AK</Text>
        </View>
        <Text style={styles.title}>Absensi Konsultan</Text>
        <Text style={styles.subtitle}>Masuk ke akun Anda untuk melanjutkan</Text>

        {/* Kuning, bukan merah. Tidak ada yang salah dengan isian di
            bawah -- sandinya tidak keliru, dan warna merah yang sama
            dengan "password salah" membuat orang mengulang-ulang
            mengetik, bukan membaca kalimatnya. */}
        {!!pesanSesi && (
          <View style={styles.pesanSesi}>
            <Text style={styles.pesanSesiTeks}>{pesanSesi}</Text>
          </View>
        )}

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

        <Text style={styles.hakCipta}>
          © {new Date().getFullYear()} by : PERCIPKAR — Sistem Absensi Konsultan
        </Text>

        {/* Hanya saat pengembangan: alamat server yang sedang dituju.
            Alamat backend di HP adalah sumber kebingungan yang paling
            sering -- "localhost" berarti HP itu sendiri, adapter virtual
            bisa terpilih keliru, dan berkas .env kadang belum terbaca
            karena cache. Menampilkannya di layar mengubah tebak-tebakan
            jadi satu kali lihat. Tidak pernah muncul di APK produksi. */}
        {__DEV__ && (
          <Text style={styles.alamatServer} selectable>
            server: {API_URL}
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const buatGaya = (w) => StyleSheet.create({
  alamatServer: {
    fontSize: 10, color: w.teksSamar, textAlign: 'center', marginTop: 6,
  },
  container: { flex: 1, backgroundColor: w.latar },
  isi: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: {
    width: 68, height: 68, borderRadius: 20, backgroundColor: w.utama,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16,
  },
  logoText: { color: w.teksDiWarna, fontSize: 20, fontWeight: '600' },
  title: {
    fontSize: 21, fontWeight: '700', textAlign: 'center',
    color: w.teks, textTransform: 'uppercase',
  },
  subtitle: { fontSize: 13, color: w.teksRedup, textAlign: 'center', marginTop: 4, marginBottom: 28 },

  pesanSesi: {
    borderWidth: 1, borderColor: w.gelap ? '#78350f' : '#fcd34d',
    backgroundColor: w.gelap ? 'rgba(245,158,11,0.15)' : '#fffbeb',
    borderRadius: LENGKUNG.kotak, paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 20, marginTop: -12,
  },
  pesanSesiTeks: { fontSize: 13, lineHeight: 19, color: w.gelap ? '#fcd34d' : '#92400e' },

  label: { fontSize: 12, fontWeight: '600', color: w.teksRedup, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: w.kacaGaris, borderRadius: LENGKUNG.kotak,
    paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16, fontSize: 15,
    backgroundColor: w.permukaan,
    // Tanpa baris ini teksnya digambar hitam bawaan sistem -- tidak
    // terlihat sama sekali di atas kolom gelap.
    color: w.teks,
  },
  button: {
    backgroundColor: w.utama, borderRadius: LENGKUNG.kotak, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
  },
  buttonMati: { opacity: 0.6 },
  buttonText: { color: w.teksDiWarna, fontWeight: '700', fontSize: 15 },

  // zIndex: ScrollView digambar setelahnya, jadi tanpa ini tombol tertimpa
  // dan ketukan jatuh ke daftar di belakangnya.
  temaPojok: { position: 'absolute', right: 20, zIndex: 10 },

  hakCipta: {
    fontSize: 11, color: w.teksSamar, textAlign: 'center', marginTop: 24,
  },
});
