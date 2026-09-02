import { View, Pressable, StyleSheet } from 'react-native';
import { useWarna, LENGKUNG, BAYANG } from '../theme';

// ============================================================
// Kartu kaca, sepadan dengan .kartu-kaca di web.
//
// Tiga hal yang membuat sebuah permukaan terbaca sebagai kaca, dan
// ketiganya ada di sini:
//   1. permukaannya semi-transparan, sehingga warna latar menembus
//   2. tepinya terang, seperti cahaya yang tertangkap di sisi lembaran
//   3. bayangnya lembut dan jauh, bukan garis gelap yang rapat
//
// Yang TIDAK ada, dan memang tidak dipakai, adalah blur. Lihat catatan
// di theme.js: di layar segenggam kartu nyaris memenuhi lebar layar,
// jadi hampir tidak ada latar tersisa untuk diburamkan.
//
// `bisaTekan` mengubahnya jadi Pressable dan memberi balasan tekan --
// hanya untuk kartu yang memang bisa diketuk. Kartu yang cuma dibaca
// tidak boleh bergerak, karena gerakan yang tidak berarti apa-apa
// justru melatih orang untuk mengabaikannya.
// ============================================================

export default function Kartu({
  children,
  style,
  bisaTekan = false,
  onPress,
  pekat = false,
  ...sisa
}) {
  const w = useWarna();

  const dasar = [
    styles.kartu,
    {
      backgroundColor: pekat ? w.kacaPekat : w.kaca,
      borderColor: w.kacaGaris,
    },
    BAYANG.lembut,
    style,
  ];

  if (!bisaTekan) return <View style={dasar} {...sisa}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        ...dasar,
        pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 },
      ]}
      {...sisa}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kartu: {
    borderRadius: LENGKUNG.kartu,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
