import { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useWarna } from '../theme';
import { urlFoto } from '../services/fotoUrl';

// Inisial dari nama: "Budi Pegawai" -> "BP", "ari" -> "A".
function inisial(nama) {
  const bagian = String(nama || '').trim().split(/\s+/).filter(Boolean);
  if (bagian.length === 0) return '?';
  if (bagian.length === 1) return bagian[0][0].toUpperCase();
  return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase();
}

// Warna latar diturunkan dari namanya sendiri, bukan diacak. Orang yang
// sama selalu mendapat warna yang sama di layar mana pun, sehingga wajah
// yang belum diunggah pun tetap bisa dikenali sekilas.
const PALET = ['#2563eb', '#7c3aed', '#0f766e', '#b45309', '#be123c', '#15803d'];

function warnaDariNama(nama) {
  const teks = String(nama || '');
  let jumlah = 0;
  for (let i = 0; i < teks.length; i += 1) jumlah += teks.charCodeAt(i);
  return PALET[jumlah % PALET.length];
}

export default function Avatar({ nama, url, token, ukuran = 40 }) {
  const w = useWarna();
  const sumber = urlFoto(url, token);
  const gaya = useMemo(() => ({
    width: ukuran,
    height: ukuran,
    borderRadius: ukuran / 2,
  }), [ukuran]);

  if (sumber) {
    return (
      <Image
        source={{ uri: sumber }}
        style={[gaya, { backgroundColor: w.permukaan2 }]}
        accessibilityLabel={`Foto profil ${nama || ''}`}
      />
    );
  }

  return (
    <View style={[gaya, styles.inisialWadah, { backgroundColor: warnaDariNama(nama) }]}>
      <Text style={[styles.inisialTeks, { fontSize: ukuran * 0.38 }]}>{inisial(nama)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inisialWadah: { alignItems: 'center', justifyContent: 'center' },
  inisialTeks: { color: '#ffffff', fontWeight: '700' },
});
