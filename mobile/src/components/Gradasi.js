import { View, StyleSheet } from 'react-native';

// ============================================================
// Gradasi warna tanpa pustaka tambahan.
//
// React Native tidak punya gradien bawaan, dan expo-linear-gradient
// berarti satu paket baru berikut satu langkah pasang lagi -- terlalu
// mahal untuk satu kepala layar. Sebagai gantinya, gradasinya disusun
// dari beberapa lapis warna bertingkat. Dengan dua ujung warna yang
// berdekatan dan cukup banyak lapis, batas antar lapis tidak terlihat.
//
// Lengkungnya SENGAJA bukan lurus (pangkat 1.6): warnanya bertahan
// gelap lebih lama, lalu memudar cepat di sepertiga bawah. Kalau lurus,
// bagian tengah sudah terlanjur pucat padahal di situ masih ada teks
// putih yang harus terbaca.
// ============================================================

const LAPIS = 14;

function campur(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}

function keRgb(c) {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export default function Gradasi({ atas, bawah, style, children }) {
  return (
    <View style={style}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: LAPIS }).map((_, i) => {
          const t = Math.pow(i / (LAPIS - 1), 1.6);
          return (
            <View
              key={i}
              style={{ flex: 1, backgroundColor: keRgb(campur(atas, bawah, t)) }}
            />
          );
        })}
      </View>
      {children}
    </View>
  );
}
