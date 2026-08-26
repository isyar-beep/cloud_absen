import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWarna, useThemeStore, PILIHAN_TEMA } from '../theme';

const IKON = {
  terang: 'sunny-outline',
  sistem: 'phone-portrait-outline',
  gelap: 'moon-outline',
};

const KETERANGAN = {
  terang: 'Selalu terang',
  sistem: 'Ikut setelan HP',
  gelap: 'Selalu gelap',
};

// ============================================================
// Pemilih tema.
//
// Dua bentuk, karena tempatnya berbeda kebutuhan:
//
// - `ringkas` (bawaan): SATU tombol ikon yang berputar antara ketiga
//   pilihan. Dipakai di layar login, tempat deretan tiga tombol berteks
//   membuat halaman terasa ramai padahal yang dicari orang cuma kolom
//   email.
//
// - Bentuk penuh: tiga pilihan sekaligus lengkap dengan keterangannya.
//   Dipakai di layar Profil, tempat orang memang sedang mengatur sesuatu
//   dan berhak melihat ada pilihan apa saja.
//
// Bawaannya tetap "sistem" -- mengikuti setelan HP sampai pemiliknya
// menyatakan lain.
// ============================================================
export default function PilihTema({ ringkas = true }) {
  const w = useWarna();
  const { pilihan, setTema } = useThemeStore();
  const styles = useMemo(() => buatGaya(w), [w]);

  if (ringkas) {
    const indeks = PILIHAN_TEMA.findIndex((p) => p.key === pilihan);
    const berikutnya = PILIHAN_TEMA[(indeks + 1) % PILIHAN_TEMA.length];
    return (
      <TouchableOpacity
        style={styles.tombolIkon}
        onPress={() => setTema(berikutnya.key)}
        accessibilityRole="button"
        accessibilityLabel={`Tampilan ${KETERANGAN[pilihan]}. Ketuk untuk ${KETERANGAN[berikutnya.key]}.`}
      >
        <Ionicons name={IKON[pilihan]} size={20} color={styles.warnaIkon.color} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.daftar} accessibilityRole="radiogroup">
      {PILIHAN_TEMA.map((p) => {
        const aktif = pilihan === p.key;
        return (
          <TouchableOpacity
            key={p.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: aktif }}
            style={[styles.baris, aktif && styles.barisAktif]}
            onPress={() => setTema(p.key)}
          >
            <Ionicons
              name={IKON[p.key]}
              size={18}
              color={aktif ? w.utama : w.teksRedup}
            />
            <View style={styles.barisTeks}>
              <Text style={[styles.judul, aktif && styles.judulAktif]}>{p.label}</Text>
              <Text style={styles.keterangan}>{KETERANGAN[p.key]}</Text>
            </View>
            {aktif ? <Ionicons name="checkmark-circle" size={20} color={w.utama} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const buatGaya = (w) => StyleSheet.create({
  // Tombol ikon 40x40: batas bawah yang masih nyaman ditekan ibu jari.
  tombolIkon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: w.permukaan2,
    borderWidth: 1, borderColor: w.garis,
  },
  warnaIkon: { color: w.teksBadan },

  daftar: { gap: 8 },
  baris: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1,
    borderColor: w.garis, backgroundColor: w.permukaan2,
  },
  barisAktif: { borderColor: w.utama, backgroundColor: w.permukaan3 },
  barisTeks: { flex: 1 },
  judul: { fontSize: 14, fontWeight: '600', color: w.teksBadan },
  judulAktif: { color: w.teks },
  keterangan: { fontSize: 11, color: w.teksRedup, marginTop: 1 },
});
