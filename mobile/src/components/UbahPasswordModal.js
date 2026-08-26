import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import api from '../services/api';
import { useWarna } from '../theme';

// Ubah password sendiri, kembaran frontend/src/components/UbahPasswordModal.jsx.
//
// Endpoint POST /api/auth/change-password sudah ada sejak awal tapi tidak
// pernah punya tombol di layar mana pun. Tanpa ini, satu-satunya cara
// pegawai mengganti password adalah meminta admin me-reset-nya -- dan itu
// berarti passwordnya sempat diketahui orang lain.
export default function UbahPasswordModal({ onTutup, onSelesai }) {
  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');
  const [ulang, setUlang] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const w = useWarna();
  const styles = useMemo(() => buatGaya(w), [w]);

  async function kirim() {
    setError('');

    // Ketiga pemeriksaan ini juga ada di server. Yang di sini hanya supaya
    // pegawai tidak perlu menunggu perjalanan bolak-balik untuk tahu
    // ketikannya keliru -- di lapangan sinyalnya sering seadanya.
    if (!lama || !baru) {
      setError('Password lama dan baru wajib diisi.');
      return;
    }
    if (baru.length < 6) {
      setError('Password baru minimal 6 karakter.');
      return;
    }
    if (baru !== ulang) {
      setError('Ulangi password tidak sama dengan password baru.');
      return;
    }
    if (baru === lama) {
      setError('Password baru tidak boleh sama dengan password lama.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/change-password', {
        oldPassword: lama,
        newPassword: baru,
      });
      onSelesai(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengubah password.');
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
            <Text style={styles.judul}>Ubah Password</Text>
            <Text style={styles.subjudul}>Minimal 6 karakter</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.label}>Password lama</Text>
            <TextInput
              style={styles.input}
              value={lama}
              onChangeText={setLama}
              secureTextEntry
              autoCapitalize="none"
              placeholderTextColor={w.teksSamar}
            />

            <Text style={styles.label}>Password baru</Text>
            <TextInput
              style={styles.input}
              value={baru}
              onChangeText={setBaru}
              secureTextEntry
              autoCapitalize="none"
              placeholderTextColor={w.teksSamar}
            />

            <Text style={styles.label}>Ulangi password baru</Text>
            <TextInput
              style={styles.input}
              value={ulang}
              onChangeText={setUlang}
              secureTextEntry
              autoCapitalize="none"
              placeholderTextColor={w.teksSamar}
            />

            <View style={styles.tombolRow}>
              <TouchableOpacity
                style={[styles.tombolUtama, loading && styles.tombolMati]}
                onPress={kirim}
                disabled={loading}
              >
                <Text style={styles.tombolUtamaTeks}>
                  {loading ? 'Menyimpan...' : 'Simpan Password'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tombolBatal} onPress={onTutup}>
                <Text style={styles.tombolBatalTeks}>Batal</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const buatGaya = (w) => StyleSheet.create({
  latar: { flex: 1, backgroundColor: 'rgba(2,6,23,0.6)', justifyContent: 'flex-end' },
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
  label: { fontSize: 11, fontWeight: '600', color: w.teksRedup, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: w.garisTebal, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 14,
    backgroundColor: w.permukaan2, color: w.teks,
  },
  tombolRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  tombolUtama: {
    flex: 1, backgroundColor: w.utama, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  tombolMati: { opacity: 0.5 },
  tombolUtamaTeks: { color: w.teksDiWarna, fontWeight: '700', fontSize: 14 },
  tombolBatal: { paddingHorizontal: 8, paddingVertical: 13 },
  tombolBatalTeks: { color: w.teksRedup, fontWeight: '600', fontSize: 13 },
});
