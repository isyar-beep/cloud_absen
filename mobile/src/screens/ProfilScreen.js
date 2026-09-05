import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import { pesanGalat } from '../services/galat';
import { useAuthStore } from '../store/authStore';
import { unregisterPushToken } from '../services/notifications';
import { useTokenFoto } from '../services/fotoUrl';
import { useWarna } from '../theme';
import Avatar from '../components/Avatar';
import PilihTema from '../components/PilihTema';
import UbahPasswordModal from '../components/UbahPasswordModal';

// Batas ukuran unggahan foto profil di server (middleware/upload.js).
const MAKS_FOTO = 5 * 1024 * 1024;

// ============================================================
// Profil & Pengaturan.
//
// Sebelumnya "Ubah Password" adalah tombol yang tergeletak di dasar
// dashboard, di bawah statistik dan riwayat -- tempat orang mencari
// informasi, bukan pengaturan. Unggah foto profil malah tidak ada sama
// sekali di mobile, padahal endpoint-nya sudah lama tersedia dan versi
// web sudah memakainya.
//
// Semua yang sifatnya "mengatur akun saya" dikumpulkan di sini, dan
// dashboard kembali menjadi murni layar kerja: absen, statistik, riwayat.
// ============================================================
export default function ProfilScreen({ navigation }) {
  const { user, logout, perbaruiUser, gantiToken } = useAuthStore();
  const [profil, setProfil] = useState(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [ubahPassword, setUbahPassword] = useState(false);
  const [pesan, setPesan] = useState('');
  const [memutusSesi, setMemutusSesi] = useState(false);

  // Memutus sesi di perangkat LAIN. HP ini tetap masuk memakai token
  // pengganti dari server -- tombol keamanan yang mengeluarkan
  // penekannya sendiri membuat orang ragu menekannya, dan tombol yang
  // orang ragu menekannya sama saja dengan tidak ada.
  async function keluarkanPerangkatLain() {
    Alert.alert(
      'Keluarkan perangkat lain?',
      'Semua perangkat selain HP ini akan diminta login ulang.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluarkan',
          style: 'destructive',
          onPress: async () => {
            setMemutusSesi(true);
            try {
              const res = await api.post('/auth/keluar-semua');
              await gantiToken(res.data.token);
              setPesan(res.data.message);
            } catch (err) {
              Alert.alert('Gagal', pesanGalat(err, 'Gagal memutus sesi perangkat lain.'));
            } finally {
              setMemutusSesi(false);
            }
          },
        },
      ]
    );
  }
  const w = useWarna();
  const tokenFoto = useTokenFoto();
  const styles = useMemo(() => buatGaya(w), [w]);

  const ambilProfil = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setProfil(res.data);
    } catch (err) {
      console.log('Gagal memuat profil:', err.message);
    }
  }, []);

  useEffect(() => {
    ambilProfil();
  }, [ambilProfil]);

  async function gantiFoto() {
    try {
      const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!izin.granted) {
        Alert.alert('Izin diperlukan', 'Aplikasi perlu izin membuka galeri untuk memilih foto profil.');
        return;
      }

      const hasil = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        // Persegi: foto profil selalu ditampilkan sebagai lingkaran, jadi
        // memotongnya di sini mencegah wajah terpotong sembarangan nanti.
        aspect: [1, 1],
        quality: 0.7,
      });
      if (hasil.canceled) return;

      const berkas = hasil.assets?.[0];
      if (!berkas) return;

      if (berkas.fileSize && berkas.fileSize > MAKS_FOTO) {
        Alert.alert(
          'Foto terlalu besar',
          `Ukuran maksimal 5MB. Foto Anda ${(berkas.fileSize / 1024 / 1024).toFixed(1)}MB.`
        );
        return;
      }

      setMengunggah(true);
      const data = new FormData();
      data.append('photo', {
        uri: berkas.uri,
        name: 'avatar.jpg',
        type: berkas.mimeType || 'image/jpeg',
      });

      const res = await api.put('/auth/avatar', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setProfil((p) => ({ ...p, avatar_url: res.data.avatar_url }));
      // Ikut disimpan di sesi supaya avatar di dashboard langsung berubah,
      // bukan menunggu pegawai keluar lalu masuk lagi.
      await perbaruiUser({ avatar_url: res.data.avatar_url });
      setPesan(res.data.message);
    } catch (err) {
      Alert.alert('Gagal', pesanGalat(err, 'Foto profil gagal diunggah.'));
    } finally {
      setMengunggah(false);
    }
  }

  async function hapusFoto() {
    Alert.alert(
      'Hapus foto profil?',
      'Tampilan kembali memakai inisial nama. Anda bisa mengunggah foto baru kapan saja.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.delete('/auth/avatar');
              setProfil((p) => ({ ...p, avatar_url: null }));
              await perbaruiUser({ avatar_url: null });
              setPesan(res.data.message);
            } catch (err) {
              Alert.alert('Gagal', pesanGalat(err, 'Foto profil gagal dihapus.'));
            }
          },
        },
      ]
    );
  }

  function konfirmasiKeluar() {
    Alert.alert('Keluar dari akun?', 'Anda perlu memasukkan email dan password lagi untuk masuk.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await unregisterPushToken(); // selagi token JWT masih berlaku
          await logout();
          navigation.replace('Login');
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.isi}>
      {pesan ? <Text style={styles.pesan}>✓ {pesan}</Text> : null}

      {/* Identitas */}
      <View style={styles.kartuProfil}>
        <View style={styles.avatarWadah}>
          <Avatar nama={user?.name} url={profil?.avatar_url} token={tokenFoto} ukuran={84} />
          {mengunggah ? (
            <View style={styles.avatarTirai}>
              <ActivityIndicator color="#ffffff" />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.kameraBulat}
              onPress={gantiFoto}
              accessibilityLabel="Ganti foto profil"
            >
              <Ionicons name="camera" size={16} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.nama}>{user?.name}</Text>
        <Text style={styles.email}>{profil?.email || user?.email}</Text>

        {profil?.shift_name ? (
          <View style={styles.lencanaShift}>
            <Ionicons name="time-outline" size={13} color={w.utama} />
            <Text style={styles.lencanaTeks}>
              {profil.shift_name} · {profil.shift_start}–{profil.shift_end}
            </Text>
          </View>
        ) : null}

        {profil?.avatar_url ? (
          <TouchableOpacity onPress={hapusFoto} style={styles.hapusFoto}>
            <Text style={styles.hapusFotoTeks}>Hapus foto profil</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tampilan */}
      <Text style={styles.judulBagian}>Tampilan</Text>
      <View style={styles.kartu}>
        <PilihTema ringkas={false} />
      </View>

      {/* Keamanan */}
      <Text style={styles.judulBagian}>Keamanan</Text>
      <View style={styles.kartu}>
        <TouchableOpacity style={styles.menuBaris} onPress={() => setUbahPassword(true)}>
          <View style={styles.menuIkon}>
            <Ionicons name="key-outline" size={18} color={w.utama} />
          </View>
          <View style={styles.menuTeks}>
            <Text style={styles.menuJudul}>Ubah Password</Text>
            <Text style={styles.menuKeterangan}>Minimal 8 karakter</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={w.teksSamar} />
        </TouchableOpacity>

        {/* Jejak login: satu-satunya hal yang bisa diperiksa sendiri oleh
            pemiliknya untuk menyadari akunnya dipakai orang lain, tanpa
            menunggu ada yang melapor. */}
        <TouchableOpacity
          style={styles.menuBaris}
          onPress={keluarkanPerangkatLain}
          disabled={memutusSesi}
        >
          <View style={styles.menuIkon}>
            <Ionicons name="phone-portrait-outline" size={18} color={w.utama} />
          </View>
          <View style={styles.menuTeks}>
            <Text style={styles.menuJudul}>
              {memutusSesi ? 'Memutus sesi...' : 'Keluarkan Perangkat Lain'}
            </Text>
            {/* Dulu di sini tertulis "Login sebelumnya" -- padahal yang
                ditampilkan justru login SAAT ITU JUGA, karena kolomnya
                sudah ditimpa saat login. Keterangan yang tidak akan
                pernah bisa menunjukkan penyusup.

                Kabar itu sekarang datang sebagai pemberitahuan
                "Login dari perangkat baru", bukan keterangan pasif yang
                harus dicari sendiri. */}
            <Text style={styles.menuKeterangan}>Akhiri sesi di perangkat selain ini</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={w.teksSamar} />
        </TouchableOpacity>
      </View>

      {/* Keluar */}
      <TouchableOpacity style={styles.keluar} onPress={konfirmasiKeluar}>
        <Ionicons name="log-out-outline" size={18} color={w.merah.teks} />
        <Text style={styles.keluarTeks}>Keluar dari Akun</Text>
      </TouchableOpacity>

      {/* Versi aplikasi. Dibaca dari app.json lewat expo-constants, bukan
          ditulis ulang di sini -- nomor yang disalin ke dua tempat pasti
          berselisih cepat atau lambat, dan versi yang salah lebih
          menyesatkan daripada tidak ada versi sama sekali.

          Gunanya nyata saat pegawai melapor: tanpa ini, "sudah saya coba
          dan tetap begitu" tidak bisa dipastikan menunjuk kode yang sama
          dengan yang sedang diperiksa. */}
      <Text style={styles.versi} selectable>
        Absensi Konsultan v{Constants.expoConfig?.version || '-'}
      </Text>

      {ubahPassword ? (
        <UbahPasswordModal
          onTutup={() => setUbahPassword(false)}
          onSelesai={(msg) => {
            setUbahPassword(false);
            setPesan(msg);
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const buatGaya = (w) => StyleSheet.create({
  container: { flex: 1, backgroundColor: w.latar },
  isi: { padding: 16, paddingBottom: 32 },

  pesan: {
    fontSize: 12, color: w.hijau.teks, backgroundColor: w.hijau.latar,
    borderWidth: 1, borderColor: w.hijau.garis, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12, fontWeight: '600',
  },

  kartuProfil: {
    backgroundColor: w.permukaan, borderRadius: 16, borderWidth: 1, borderColor: w.garis,
    paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center',
  },
  avatarWadah: { position: 'relative' },
  avatarTirai: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 42, backgroundColor: 'rgba(2,6,23,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  kameraBulat: {
    position: 'absolute', right: -2, bottom: -2,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: w.utama,
    // Cincin sewarna kartu memisahkan tombol dari foto di belakangnya,
    // supaya tetap terlihat walau fotonya kebetulan biru.
    borderWidth: 3, borderColor: w.permukaan,
  },
  nama: { fontSize: 18, fontWeight: '700', color: w.teks, marginTop: 14 },
  email: { fontSize: 13, color: w.teksRedup, marginTop: 2 },
  lencanaShift: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: w.permukaan2, borderWidth: 1, borderColor: w.garis,
  },
  lencanaTeks: { fontSize: 12, color: w.teksBadan, fontWeight: '600' },
  hapusFoto: { marginTop: 14, minHeight: 36, justifyContent: 'center' },
  hapusFotoTeks: { fontSize: 12, color: w.merah.teks, fontWeight: '600' },

  judulBagian: {
    fontSize: 12, fontWeight: '700', color: w.teksRedup,
    marginTop: 24, marginBottom: 8, marginLeft: 2,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  kartu: {
    backgroundColor: w.permukaan, borderRadius: 16,
    borderWidth: 1, borderColor: w.garis, padding: 12,
  },

  menuBaris: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  menuIkon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', backgroundColor: w.permukaan2,
  },
  menuTeks: { flex: 1 },
  menuJudul: { fontSize: 14, fontWeight: '600', color: w.teks },
  menuKeterangan: { fontSize: 11, color: w.teksRedup, marginTop: 1 },

  keluar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 28, minHeight: 48, borderRadius: 14,
    backgroundColor: w.merah.latar, borderWidth: 1, borderColor: w.merah.garis,
  },
  versi: {
    fontSize: 11, color: w.teksSamar, textAlign: 'center',
    marginTop: 14, marginBottom: 4,
  },
  keluarTeks: { fontSize: 14, fontWeight: '700', color: w.merah.teks },
});
