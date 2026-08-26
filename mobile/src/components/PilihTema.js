import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useWarna, useThemeStore, PILIHAN_TEMA } from '../theme';

// Pemilih tema tiga posisi: Terang · Sistem · Gelap.
//
// Opsi "Sistem" bukan pelengkap. Tanpanya, pegawai yang HP-nya berpindah
// terang/gelap mengikuti jam tidak punya cara menyatakan "ikuti saja
// setelan saya", dan harus mengubah aplikasi ini dua kali sehari.
//
// `diAtasWarna` dipakai saat pemilihnya duduk di atas hero biru. Di situ
// token permukaan terang maupun gelap sama-sama tidak terbaca, jadi
// warnanya diambil dari putih transparan, bukan dari tema.
export default function PilihTema({ diAtasWarna = false }) {
  const w = useWarna();
  const { pilihan, setTema } = useThemeStore();
  const styles = useMemo(() => buatGaya(w, diAtasWarna), [w, diAtasWarna]);

  return (
    <View style={styles.wadah} accessibilityRole="radiogroup">
      {PILIHAN_TEMA.map((p) => {
        const aktif = pilihan === p.key;
        return (
          <TouchableOpacity
            key={p.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: aktif }}
            style={[styles.tombol, aktif && styles.tombolAktif]}
            onPress={() => setTema(p.key)}
          >
            <Text style={[styles.teks, aktif && styles.teksAktif]}>{p.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const buatGaya = (w, diAtasWarna) => StyleSheet.create({
  wadah: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 12,
    padding: 3,
    gap: 2,
    backgroundColor: diAtasWarna ? 'rgba(255,255,255,0.15)' : w.permukaan2,
    borderWidth: 1,
    borderColor: diAtasWarna ? 'rgba(255,255,255,0.25)' : w.garis,
  },
  tombol: {
    // Tinggi ketuk minimal 40px. Chip setinggi 28px terlihat rapi di
    // gambar tapi sulit ditekan dengan ibu jari di HP.
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  tombolAktif: {
    backgroundColor: diAtasWarna ? 'rgba(255,255,255,0.9)' : w.utama,
  },
  teks: {
    fontSize: 12,
    fontWeight: '600',
    color: diAtasWarna ? 'rgba(255,255,255,0.85)' : w.teksRedup,
  },
  teksAktif: {
    color: diAtasWarna ? w.utama : w.teksDiWarna,
  },
});
