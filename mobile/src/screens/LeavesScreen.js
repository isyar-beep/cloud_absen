import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useWarna } from '../theme';
import * as DocumentPicker from 'expo-document-picker';
import api from '../services/api';
import { formatTanggal } from '../utils/tanggal';

// Format & batas ukuran lampiran. Angkanya harus sama dengan
// backend/src/middleware/uploadDocument.js -- diperiksa di sini lebih dulu
// supaya pegawai di lapangan tidak menghabiskan kuota mengunggah berkas
// 20MB hanya untuk ditolak server.
const FORMAT_LAMPIRAN = ['application/pdf', 'image/jpeg', 'image/png'];
const MAKS_LAMPIRAN = 5 * 1024 * 1024;

const JENIS = [
  { key: 'izin', label: 'Izin' },
  { key: 'sakit', label: 'Sakit' },
  { key: 'cuti', label: 'Cuti' },
];

const LABEL_JENIS = { izin: 'Izin', sakit: 'Sakit', cuti: 'Cuti' };

const LABEL_STATUS = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' };

export default function LeavesScreen() {
  const [leaves, setLeaves] = useState([]);
  const [form, setForm] = useState({ type: 'izin', start_date: '', end_date: '', reason: '' });
  const [berkas, setBerkas] = useState(null);
  const [loading, setLoading] = useState(false);
  const w = useWarna();
  const styles = useMemo(() => buatGaya(w), [w]);

  async function pilihBerkas() {
    try {
      const hasil = await DocumentPicker.getDocumentAsync({
        type: FORMAT_LAMPIRAN,
        copyToCacheDirectory: true,
      });
      if (hasil.canceled) return;

      const file = hasil.assets?.[0];
      if (!file) return;

      if (file.size && file.size > MAKS_LAMPIRAN) {
        Alert.alert(
          'Berkas terlalu besar',
          `Ukuran lampiran maksimal 5MB. Berkas Anda ${(file.size / 1024 / 1024).toFixed(1)}MB.`
        );
        return;
      }
      setBerkas(file);
    } catch (err) {
      Alert.alert('Gagal', 'Tidak bisa membuka pemilih berkas.');
    }
  }

  const fetchLeaves = useCallback(async () => {
    try {
      const res = await api.get('/leaves/me');
      setLeaves(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  async function handleSubmit() {
    // Validasi format tanggal sederhana (YYYY-MM-DD) sebelum dikirim ke backend
    const formatTanggalValid = /^\d{4}-\d{2}-\d{2}$/;
    if (!formatTanggalValid.test(form.start_date) || !formatTanggalValid.test(form.end_date)) {
      Alert.alert('Perhatian', 'Isi tanggal dengan format YYYY-MM-DD, contoh: 2026-07-25');
      return;
    }
    if (!form.reason.trim()) {
      Alert.alert('Perhatian', 'Alasan pengajuan wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      // Tanpa lampiran tetap dikirim sebagai JSON biasa. Dengan lampiran
      // harus multipart, karena berkasnya tidak bisa dititipkan di JSON.
      let res;
      if (berkas) {
        const data = new FormData();
        Object.entries(form).forEach(([kunci, nilai]) => data.append(kunci, nilai));
        data.append('document', {
          uri: berkas.uri,
          name: berkas.name,
          type: berkas.mimeType || 'application/octet-stream',
        });
        res = await api.post('/leaves', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await api.post('/leaves', form);
      }

      Alert.alert('Berhasil', res.data.message);
      setForm({ type: 'izin', start_date: '', end_date: '', reason: '' });
      setBerkas(null);
      fetchLeaves();
    } catch (err) {
      Alert.alert('Gagal', err.response?.data?.message || 'Gagal mengirim pengajuan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>Ajukan Izin / Sakit / Cuti</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Jenis pengajuan</Text>
        <View style={styles.jenisRow}>
          {JENIS.map((j) => (
            <TouchableOpacity
              key={j.key}
              style={[styles.jenisChip, form.type === j.key && styles.jenisChipActive]}
              onPress={() => setForm({ ...form, type: j.key })}
            >
              <Text style={[styles.jenisText, form.type === j.key && styles.jenisTextActive]}>
                {j.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.label}>Dari (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-07-25"
              value={form.start_date}
              onChangeText={(v) => setForm({ ...form, start_date: v })}
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.label}>Sampai (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-07-26"
              value={form.end_date}
              onChangeText={(v) => setForm({ ...form, end_date: v })}
            />
          </View>
        </View>
        <Text style={styles.label}>Alasan</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Contoh: keperluan keluarga, sakit, dll."
          multiline
          numberOfLines={3}
          value={form.reason}
          onChangeText={(v) => setForm({ ...form, reason: v })}
        />

        <Text style={styles.label}>Lampiran (opsional)</Text>
        {berkas ? (
          <View style={styles.berkasBaris}>
            <Text style={styles.berkasNama} numberOfLines={1}>{berkas.name}</Text>
            <TouchableOpacity onPress={() => setBerkas(null)} hitSlop={8}>
              <Text style={styles.berkasHapus}>Hapus</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.berkasPilih} onPress={pilihBerkas}>
            <Text style={styles.berkasPilihTeks}>+ Pilih berkas (PDF/JPG/PNG, maks 5MB)</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.petunjuk}>
          Mis. surat dokter untuk pengajuan sakit. Boleh dikosongkan.
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonText}>
            {loading ? 'Mengirim...' : `Ajukan ${LABEL_JENIS[form.type]}`}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Riwayat Pengajuan</Text>
      {leaves.map((item) => {
        const info = w.status[item.status] || w.status.pending;
        const jns = w.status[item.type] || w.status.izin;
        return (
          <View key={item.id} style={styles.card}>
            <View style={styles.leaveHeader}>
              <View style={[styles.badge, { backgroundColor: jns.latar, marginRight: 6 }]}>
                <Text style={[styles.badgeText, { color: jns.teks }]}>
                  {LABEL_JENIS[item.type] || LABEL_JENIS.izin}
                </Text>
              </View>
              <Text style={[styles.leaveDate, { flex: 1 }]}>
                {formatTanggal(item.start_date)}
                {item.start_date !== item.end_date ? ` — ${formatTanggal(item.end_date)}` : ''}
              </Text>
              <View style={[styles.badge, { backgroundColor: info.latar }]}>
                <Text style={[styles.badgeText, { color: info.teks }]}>
                  {LABEL_STATUS[item.status] || LABEL_STATUS.pending}
                </Text>
              </View>
            </View>
            <Text style={styles.leaveReason}>{item.reason}</Text>
            {item.document_name ? (
              // Berkasnya sendiri dibuka lewat web: menampilkan PDF di sini
              // butuh penampil tersendiri, sementara admin memang meninjau
              // lampiran dari web.
              <Text style={styles.lampiran}>Lampiran: {item.document_name}</Text>
            ) : null}
            {item.admin_note ? (
              <Text style={styles.adminNote}>Catatan admin: {item.admin_note}</Text>
            ) : null}
          </View>
        );
      })}
      {leaves.length === 0 && (
        <Text style={styles.empty}>Belum ada pengajuan.</Text>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const buatGaya = (w) => StyleSheet.create({
  container: { flex: 1, backgroundColor: w.latar, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: w.teks, marginBottom: 8, marginTop: 8 },
  card: {
    backgroundColor: w.permukaan, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: w.garis, marginBottom: 10,
  },
  row: { flexDirection: 'row', gap: 10 },
  jenisRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  jenisChip: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: w.garisTebal, backgroundColor: w.latar,
  },
  jenisChipActive: { backgroundColor: w.utama, borderColor: w.utama },
  jenisText: { fontSize: 13, fontWeight: '600', color: w.teksBadan },
  jenisTextActive: { color: w.permukaan },
  lampiran: { fontSize: 11, color: w.teksRedup, marginTop: 4, fontStyle: 'italic' },
  berkasPilih: {
    borderWidth: 1, borderColor: w.utama, borderStyle: 'dashed', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', backgroundColor: w.permukaan2,
  },
  berkasPilihTeks: { fontSize: 12, color: w.aksen.biru, fontWeight: '600' },
  berkasBaris: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: w.garis, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, backgroundColor: w.latar,
  },
  berkasNama: { flex: 1, fontSize: 12, color: w.teks },
  berkasHapus: { fontSize: 12, color: w.aksen.merah, fontWeight: '600' },
  petunjuk: { fontSize: 11, color: w.teksSamar, marginTop: 6, marginBottom: 12 },
  half: { flex: 1 },
  label: { fontSize: 12, color: w.teksBadan, marginBottom: 4, fontWeight: '500' },
  input: {
    borderWidth: 1, borderColor: w.garisTebal, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 14, backgroundColor: w.permukaan,
  },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  button: { backgroundColor: w.utama, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: w.permukaan, fontWeight: '600', fontSize: 14 },
  leaveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  leaveDate: { fontSize: 14, color: w.teks, fontWeight: '500', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  leaveReason: { fontSize: 13, color: w.teksRedup },
  adminNote: { fontSize: 12, color: w.teksSamar, marginTop: 4 },
  empty: { fontSize: 13, color: w.teksSamar, textAlign: 'center', paddingVertical: 24 },
});
