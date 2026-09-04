import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useWarna } from '../theme';
import api from '../services/api';
import { pesanGalat } from '../services/galat';
import { formatTanggalHari, formatJam } from '../utils/tanggal';

// Kembaran frontend/src/components/AjukanKoreksiModal.jsx.
//
// Bedanya satu: web memakai <input type="time">, sementara React Native
// tidak punya pemilih jam bawaan. Di sini jamnya diketik "HH:MM" dan
// divalidasi sebelum dikirim -- pola yang sama dengan input tanggal di
// layar pengajuan izin, jadi tidak ada paket tambahan yang perlu dipasang.
const POLA_JAM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default function AjukanKoreksiModal({ baris, onTutup, onKirim }) {
  const [jamMasuk, setJamMasuk] = useState('');
  const [jamPulang, setJamPulang] = useState('');
  const [alasan, setAlasan] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const w = useWarna();
  const styles = useMemo(() => buatGaya(w), [w]);

  async function kirim() {
    setError('');

    if (!jamMasuk && !jamPulang) {
      setError('Isi minimal satu usulan jam (masuk atau pulang).');
      return;
    }
    if (jamMasuk && !POLA_JAM.test(jamMasuk)) {
      setError('Jam masuk harus berformat HH:MM, contoh 08:00.');
      return;
    }
    if (jamPulang && !POLA_JAM.test(jamPulang)) {
      setError('Jam pulang harus berformat HH:MM, contoh 17:00.');
      return;
    }
    if (!alasan.trim()) {
      setError('Alasan pengajuan wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/corrections', {
        date: baris.date,
        requested_check_in: jamMasuk || null,
        requested_check_out: jamPulang || null,
        reason: alasan,
      });
      onKirim(res.data.message);
    } catch (err) {
      setError(pesanGalat(err, 'Gagal mengirim pengajuan.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onTutup}>
      {/* Panel ini menempel di tepi bawah layar, jadi papan ketik menutupinya
          seluruhnya tanpa KeyboardAvoidingView -- pegawai mengetik tanpa bisa
          melihat kolom yang sedang diisinya. */}
      <KeyboardAvoidingView
        style={styles.latar}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.panel}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.judul}>Ajukan Koreksi Absensi</Text>
            <Text style={styles.subjudul}>{formatTanggalHari(baris.date)}</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.kotakInfo}>
              <Text style={styles.kotakLabel}>Tercatat sekarang</Text>
              <Text style={styles.kotakNilai}>
                Masuk {formatJam(baris.check_in_time)} · Pulang {formatJam(baris.check_out_time)}
              </Text>
            </View>

            <View style={styles.jamRow}>
              <View style={styles.jamKolom}>
                <Text style={styles.label}>Usulan jam masuk</Text>
                <TextInput
                  style={styles.input}
                  value={jamMasuk}
                  onChangeText={setJamMasuk}
                  placeholder="08:00"
          placeholderTextColor={w.teksSamar}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
              <View style={styles.jamKolom}>
                <Text style={styles.label}>Usulan jam pulang</Text>
                <TextInput
                  style={styles.input}
                  value={jamPulang}
                  onChangeText={setJamPulang}
                  placeholder="17:00"
          placeholderTextColor={w.teksSamar}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>
            </View>
            <Text style={styles.petunjuk}>Kosongkan yang tidak perlu diubah.</Text>

            <Text style={styles.label}>Alasan *</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={alasan}
              onChangeText={setAlasan}
              placeholder="mis. Lupa absen pulang karena rapat sampai sore"
          placeholderTextColor={w.teksSamar}
              multiline
              numberOfLines={3}
            />

            <View style={styles.tombolRow}>
              <TouchableOpacity
                style={[styles.tombolUtama, loading && styles.tombolMati]}
                onPress={kirim}
                disabled={loading}
              >
                <Text style={styles.tombolUtamaTeks}>
                  {loading ? 'Mengirim...' : 'Kirim Pengajuan'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tombolBatal} onPress={onTutup}>
                <Text style={styles.tombolBatalTeks}>Batal</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.petunjuk}>Absensi baru berubah setelah pengajuan ini disetujui.</Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const buatGaya = (w) => StyleSheet.create({
  latar: { flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', justifyContent: 'flex-end' },
  panel: {
    backgroundColor: w.permukaan, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '88%',
  },
  judul: { fontSize: 15, fontWeight: '700', color: w.teks },
  subjudul: { fontSize: 12, color: w.teksRedup, marginTop: 2, marginBottom: 14 },
  error: {
    fontSize: 12, color: w.merah.teks, backgroundColor: w.merah.latar,
    borderWidth: 1, borderColor: w.merah.garis, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  kotakInfo: { backgroundColor: w.latar, borderRadius: 10, padding: 12, marginBottom: 14 },
  kotakLabel: { fontSize: 11, color: w.teksSamar },
  kotakNilai: { fontSize: 13, color: w.teksBadan, marginTop: 2 },
  jamRow: { flexDirection: 'row', gap: 12 },
  jamKolom: { flex: 1 },
  label: { fontSize: 11, fontWeight: '600', color: w.teksRedup, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: w.garisTebal, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    backgroundColor: w.latar, color: w.teks,
  },
  textarea: { height: 82, textAlignVertical: 'top', marginBottom: 14 },
  petunjuk: { fontSize: 11, color: w.teksSamar, marginTop: 6, marginBottom: 14 },
  tombolRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tombolUtama: {
    flex: 1, backgroundColor: w.utama, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  tombolMati: { opacity: 0.5 },
  tombolUtamaTeks: { color: w.teksDiWarna, fontWeight: '700', fontSize: 14 },
  tombolBatal: { paddingHorizontal: 8, paddingVertical: 13 },
  tombolBatalTeks: { color: w.teksRedup, fontWeight: '600', fontSize: 13 },
});
