import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useWarna } from '../theme';
import { formatTanggalHari, tanggalIso, tanggalLokal } from '../utils/tanggal';

// ============================================================
// Kolom tanggal yang membuka kalender bawaan HP.
//
// Sebelumnya tanggal DIKETIK sebagai teks "YYYY-MM-DD". Di layar
// segenggam itu menyiksa: papan angka harus dibuka, tanda hubung dicari
// di papan simbol, dan satu salah ketik ditolak server setelah semua
// kolom lain terlanjur diisi. Contoh yang tertulis di kolomnya pun
// tanggal mati -- ia menua diam-diam dan akhirnya menyarankan tanggal
// yang sudah lewat.
//
// Kalender bawaan menghapus seluruh kelas masalah itu sekaligus:
// tanggalnya tidak mungkin salah bentuk, dan pegawai cukup menunjuk.
//
// Nilai yang keluar-masuk tetap teks "YYYY-MM-DD" -- sama seperti
// sebelumnya, jadi sisi server dan validasinya tidak perlu tahu bahwa
// cara mengisinya berubah.
// ============================================================

export default function KolomTanggal({ nilai, onUbah, minimum, maksimum }) {
  const [buka, setBuka] = useState(false);
  const w = useWarna();
  const styles = useMemo(() => buatGaya(w), [w]);

  // Kalender butuh objek Date; kalau kolomnya masih kosong, dibuka pada
  // hari ini -- titik berangkat yang paling mungkin dituju.
  const terpilih = nilai ? tanggalLokal(nilai) : new Date();

  function pilih(peristiwa, tanggal) {
    // Android menutup kalendernya sendiri setiap kali, baik dipilih
    // maupun dibatalkan. iOS membiarkannya terbuka, jadi hanya ditutup
    // setelah ada tanggal yang benar-benar dipilih.
    if (Platform.OS === 'android') setBuka(false);
    if (peristiwa.type === 'dismissed' || !tanggal) return;
    onUbah(tanggalIso(tanggal));
    if (Platform.OS !== 'android') setBuka(false);
  }

  return (
    <>
      <TouchableOpacity style={styles.kolom} onPress={() => setBuka(true)} activeOpacity={0.7}>
        <Text style={nilai ? styles.isi : styles.kosong}>
          {nilai ? formatTanggalHari(nilai) : 'Pilih tanggal'}
        </Text>
      </TouchableOpacity>

      {buka && (
        <DateTimePicker
          value={terpilih}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimum}
          maximumDate={maksimum}
          onChange={pilih}
        />
      )}
    </>
  );
}

const buatGaya = (w) => StyleSheet.create({
  kolom: {
    borderWidth: 1, borderColor: w.garisTebal, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: w.latar, justifyContent: 'center',
  },
  isi: { fontSize: 14, color: w.teks },
  kosong: { fontSize: 14, color: w.teksSamar },
});
