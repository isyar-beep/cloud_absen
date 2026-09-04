import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { useWarna } from '../theme';
import { formatTanggalSingkat, jamLokal } from '../utils/tanggal';

// ============================================================
// Daftar pemberitahuan pegawai.
//
// Push Expo saja tidak cukup: notifikasi yang sudah disapu dari bilah
// pemberitahuan HP hilang untuk selamanya, dan pegawai yang HP-nya sedang
// mati saat pengajuannya diputus tidak pernah menerimanya sama sekali.
// Barisnya tersimpan di server, jadi layar ini bisa menampilkannya kembali
// kapan pun -- push tinggal menjadi pengantar, bukan satu-satunya salinan.
// ============================================================

// Ikon per jenis kejadian. Dipetakan di satu tempat supaya jenis baru di
// backend cukup ditambahkan di sini, dengan cadangan yang tetap masuk akal
// bila layar ini lebih tua daripada servernya.
const IKON = {
  pengajuan_baru: 'document-text-outline',
  pengajuan_diputus: 'checkmark-circle-outline',
  koreksi_baru: 'create-outline',
  koreksi_diputus: 'checkmark-done-outline',
};

// Ke mana pemberitahuan membawa saat diketuk. Tautan dari server ditulis
// sebagai alamat web ("/leaves"); di HP alamat itu tidak berarti apa-apa,
// jadi diterjemahkan ke nama layar navigator.
const LAYAR = {
  '/leaves': 'Leaves',
  '/history': 'History',
};

function usia(waktu) {
  const detik = Math.floor((Date.now() - jamLokal(waktu).getTime()) / 1000);
  if (detik < 60) return 'baru saja';
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  return formatTanggalSingkat(waktu);
}

export default function NotifikasiScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [belum, setBelum] = useState(0);
  const [memuat, setMemuat] = useState(true);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const w = useWarna();
  const styles = useMemo(() => buatGaya(w), [w]);

  const muat = useCallback(async () => {
    try {
      const res = await api.get('/notifications/saya', { params: { limit: 50 } });
      setItems(res.data.items);
      setBelum(res.data.belum_dibaca);
    } catch {
      // Dibiarkan diam: daftar kosong dengan keterangannya sendiri sudah
      // cukup memberi tahu, dan pesan galat merah untuk pemberitahuan yang
      // gagal dimuat lebih mengganggu daripada menolong.
    } finally {
      setMemuat(false);
      setMenyegarkan(false);
    }
  }, []);

  // Dimuat ulang setiap layar dibuka, bukan sekali di awal: pegawai
  // biasanya sampai ke sini justru karena baru menerima push.
  useFocusEffect(useCallback(() => { muat(); }, [muat]));

  function buka(n) {
    if (!n.dibaca) {
      setItems((d) => d.map((x) => (x.id === n.id ? { ...x, dibaca: true } : x)));
      setBelum((v) => Math.max(0, v - 1));
      api.put(`/notifications/${n.id}/baca`).catch(() => {});
    }
    const layar = LAYAR[String(n.tautan || '').split('?')[0]];
    if (layar) navigation.navigate(layar);
  }

  function bacaSemua() {
    setItems((d) => d.map((x) => ({ ...x, dibaca: true })));
    setBelum(0);
    api.put('/notifications/baca-semua').catch(() => {});
  }

  if (memuat) {
    return (
      <View style={styles.tengah}>
        <ActivityIndicator color={w.utama} />
      </View>
    );
  }

  return (
    <View style={styles.akar}>
      {belum > 0 && (
        <View style={styles.bilah}>
          <Text style={styles.bilahTeks}>{belum} belum dibaca</Text>
          <TouchableOpacity onPress={bacaSemua}>
            <Text style={styles.bilahAksi}>Tandai semua dibaca</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={items.length === 0 ? styles.isiKosong : styles.isi}
        refreshControl={
          <RefreshControl
            refreshing={menyegarkan}
            onRefresh={() => { setMenyegarkan(true); muat(); }}
            tintColor={w.utama}
          />
        }
        ListEmptyComponent={
          <View style={styles.tengah}>
            <Ionicons name="notifications-off-outline" size={36} color={w.teksSamar} />
            <Text style={styles.kosongJudul}>Belum ada pemberitahuan</Text>
            <Text style={styles.kosongPesan}>
              Hasil pengajuan izin dan koreksi absensi akan muncul di sini.
            </Text>
          </View>
        }
        renderItem={({ item: n }) => (
          <TouchableOpacity
            style={[styles.baris, !n.dibaca && styles.barisBelum]}
            onPress={() => buka(n)}
            activeOpacity={0.7}
          >
            <View style={[styles.ikon, !n.dibaca && styles.ikonBelum]}>
              <Ionicons
                name={IKON[n.jenis] || 'notifications-outline'}
                size={18}
                color={n.dibaca ? w.teksRedup : w.utama}
              />
            </View>
            <View style={styles.teks}>
              <Text style={[styles.judul, !n.dibaca && styles.judulBelum]}>{n.judul}</Text>
              {!!n.pesan && <Text style={styles.pesan}>{n.pesan}</Text>}
              <Text style={styles.waktu}>{usia(n.created_at)}</Text>
            </View>
            {/* Titik biru hanya pada yang belum dibaca. Tanpa penanda,
                yang sudah dibuka dan yang belum terlihat sama saja. */}
            {!n.dibaca && <View style={styles.titik} />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function buatGaya(w) {
  return StyleSheet.create({
    akar: { flex: 1, backgroundColor: w.latar },
    tengah: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },

    bilah: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 10,
      backgroundColor: w.permukaan, borderBottomWidth: 1, borderBottomColor: w.garis,
    },
    bilahTeks: { fontSize: 12, color: w.teksRedup, fontWeight: '600' },
    bilahAksi: { fontSize: 12, color: w.utama, fontWeight: '700' },

    isi: { padding: 12, gap: 8 },
    isiKosong: { flexGrow: 1 },

    baris: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      backgroundColor: w.permukaan, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: w.garis,
    },
    barisBelum: { borderColor: w.utama },

    ikon: {
      width: 34, height: 34, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center', backgroundColor: w.permukaan3,
    },
    ikonBelum: { backgroundColor: w.status.izin.latar },

    teks: { flex: 1 },
    judul: { fontSize: 14, color: w.teksBadan, lineHeight: 19 },
    judulBelum: { fontWeight: '700', color: w.teks },
    pesan: { fontSize: 12.5, color: w.teksRedup, marginTop: 2, lineHeight: 17 },
    waktu: { fontSize: 11, color: w.teksSamar, marginTop: 6 },

    titik: { width: 8, height: 8, borderRadius: 4, backgroundColor: w.utama, marginTop: 6 },

    kosongJudul: { fontSize: 15, fontWeight: '700', color: w.teks, marginTop: 6 },
    kosongPesan: { fontSize: 13, color: w.teksRedup, textAlign: 'center', lineHeight: 19 },
  });
}
