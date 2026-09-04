import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ============================================================
// Kepala layar berwarna.
//
// Dulu gradasinya disusun sendiri dari 14 lapis warna solid, dengan
// alasan menghindari satu paket tambahan. Alasan itu tidak bertahan:
// empat belas lapis berarti empat belas batas, dan batasnya TERLIHAT --
// bidang biru selebar layar memperlihatkan tiap tangga warna sebagai
// garis mendatar. Menambah lapis hanya memperbanyak garis yang lebih
// halus, tidak pernah menghilangkannya, dan sama sekali tidak menolong
// untuk memudarkan tepi.
//
// expo-linear-gradient menggambar gradiennya di lapisan asli: mulus
// tanpa tangga, dan menerima warna tembus pandang sehingga tepinya bisa
// benar-benar larut, bukan sekadar dipucatkan.
//
// Dua lapis disusun di sini.
//
// 1. GRADASI TEGAK -- biru pekat di atas, biru muda di bawah, lalu
//    TEMBUS PANDANG di ujungnya. Ujung tembus pandang itulah yang
//    membuat birunya larut ke latar halaman alih-alih berhenti pada
//    satu garis lurus. Perhentiannya dirapatkan di atas supaya warnanya
//    bertahan pekat di belakang teks, dan seluruh peluruhannya terjadi
//    di sepertiga bawah -- tempat yang memang sudah tidak ada teks.
//
// 2. DUA SAPUAN SUDUT -- memudarkan tepi kiri dan kanan ke warna latar
//    halaman. Arahnya DIAGONAL, berangkat dari sudut bawah dan sudah
//    habis sebelum mencapai sepertiga atas.
//
//    Arah diagonal itu bukan pilihan rasa. Sapuan mendatar biasa (yang
//    memudarkan tepi setinggi layar penuh) ikut memucatkan latar di
//    belakang nama pegawai, dan diukur dengan membaca pikselnya: kontras
//    teks putih di situ jatuh dari 3.25 ke 2.68 -- di bawah ambang 3.0
//    untuk teks tebal. Versi diagonal ini hanya menurunkannya ke 3.11,
//    karena bagian yang dipudarkan memang cuma sudut bawah.
// ============================================================

const rgb = (c, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
const BENING = 'rgba(0, 0, 0, 0)';

// Tidak sampai pekat penuh. Pada 1.0 sudutnya menjadi benar-benar warna
// latar, dan yang terbaca adalah bidang biru yang dipotong -- bukan
// cahaya yang meluruh.
const PEKAT_SUDUT = 0.3;

export default function Gradasi({ atas, bawah, latar, style, children }) {
  return (
    <View style={style}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={[rgb(atas), rgb(atas), rgb(bawah), rgb(bawah, 0.55), rgb(bawah, 0)]}
          locations={[0, 0.42, 0.72, 0.88, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Hanya digambar kalau warna latarnya diberi tahu -- tanpa itu
            tidak ada warna yang benar untuk dituju, dan menebak akan
            salah di salah satu tema. */}
        {latar ? (
          <>
            <LinearGradient
              colors={[latar, BENING]}
              start={{ x: 0, y: 1 }}
              end={{ x: 0.45, y: 0.35 }}
              style={[StyleSheet.absoluteFill, { opacity: PEKAT_SUDUT }]}
            />
            <LinearGradient
              colors={[latar, BENING]}
              start={{ x: 1, y: 1 }}
              end={{ x: 0.55, y: 0.35 }}
              style={[StyleSheet.absoluteFill, { opacity: PEKAT_SUDUT }]}
            />
          </>
        ) : null}
      </View>
      {children}
    </View>
  );
}
