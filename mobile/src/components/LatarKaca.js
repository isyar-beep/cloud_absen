import { View, StyleSheet } from 'react-native';
import { useWarna } from '../theme';

// ============================================================
// Latar bernoda cahaya, sepadan dengan dashboard web.
//
// Di web noda ini dibuat dengan radial-gradient. React Native tidak
// punya gradien radial sama sekali, jadi bentuknya ditiru dengan
// lingkaran besar ber-borderRadius penuh yang sebagian keluar tepi
// layar. Tanpa blur, tepinya akan tegas -- karena itu dipakai tiga
// lapis lingkaran sepusat dengan opacity menurun, sehingga peralihannya
// terbaca sebagai pudar, bukan sebagai bulatan.
//
// Ini yang membuat permukaan kaca di atasnya ada gunanya: kaca hanya
// terasa kalau ada WARNA di belakangnya yang bisa menembus.
//
// pointerEvents="none" wajib -- tanpa itu lingkaran ini menadah sentuhan
// dan tombol di bawahnya berhenti bekerja.
// ============================================================

function Noda({ warna, ukuran, atas, kiri, kanan, bawah }) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.noda,
        { width: ukuran, height: ukuran, borderRadius: ukuran / 2, top: atas, left: kiri, right: kanan, bottom: bawah },
      ]}
    >
      {[0, 1, 2].map((i) => {
        const s = ukuran * (1 - i * 0.22);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: s,
              height: s,
              borderRadius: s / 2,
              top: (ukuran - s) / 2,
              left: (ukuran - s) / 2,
              backgroundColor: warna,
            }}
          />
        );
      })}
    </View>
  );
}

export default function LatarKaca({ children }) {
  const w = useWarna();

  return (
    <View style={[styles.akar, { backgroundColor: w.latar }]}>
      <Noda warna={w.nodaBiru} ukuran={520} atas={-190} kiri={-170} />
      <Noda warna={w.nodaUngu} ukuran={460} bawah={-180} kanan={-150} />
      <View style={styles.isi}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  akar: { flex: 1 },
  noda: { position: 'absolute', opacity: 0.9 },
  // Isi berada di atas noda; tanpa lapisan ini urutan gambarnya bergantung
  // urutan penulisan saja dan mudah terbalik saat layar disusun ulang.
  isi: { flex: 1, zIndex: 1 },
});
