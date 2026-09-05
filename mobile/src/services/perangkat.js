import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

// ============================================================
// Penanda dan nama perangkat.
//
// Dipakai server untuk mengenali "akun ini sudah pernah dipakai dari
// sini", lalu memberi tahu pemiliknya saat muncul yang baru.
//
// Penandanya dibuat SEKALI di HP ini lalu disimpan. Ini bukan penanda
// kelas keamanan, dan tidak berpura-pura begitu: ia hilang kalau data
// aplikasi dibersihkan atau aplikasinya dipasang ulang. Tapi cara
// gagalnya aman -- penanda yang hilang membuat HP lama tampak baru,
// sehingga muncul SATU peringatan tambahan. Merepotkan sedikit, tidak
// berbahaya, dan tidak pernah membuat siapa pun gagal masuk.
//
// Android sengaja tidak menyediakan penanda permanen demi privasi, jadi
// tidak ada pilihan yang lebih baik -- dan untuk pertanyaan "pernahkah
// akun ini dipakai dari sini", ini sudah memadai.
// ============================================================

const KUNCI = 'sidik_perangkat';

// Tanpa crypto.randomUUID di React Native lama, jadi disusun tangan dari
// Math.random. Ini bukan nilai rahasia -- yang dibutuhkan hanya berbeda
// antar perangkat, bukan sulit ditebak.
function acak() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    + `-${Math.random().toString(36).slice(2, 10)}`;
}

export async function sidikPerangkat() {
  try {
    const tersimpan = await AsyncStorage.getItem(KUNCI);
    if (tersimpan) return tersimpan;
    const baru = acak();
    await AsyncStorage.setItem(KUNCI, baru);
    return baru;
  } catch {
    // Penyimpanan bermasalah. Mengembalikan null lebih baik daripada
    // penanda acak yang berganti tiap kali -- yang justru membuat setiap
    // login terbaca sebagai perangkat baru dan membanjiri pemiliknya
    // dengan peringatan palsu.
    return null;
  }
}

// Kalimat siap baca, bukan data mentah: "Samsung Galaxy S21".
// Yang membacanya pegawai, di layar pemberitahuan.
export function namaPerangkat() {
  const merek = Device.brand ? String(Device.brand) : '';
  const model = Device.modelName ? String(Device.modelName) : '';
  const gabung = [merek, model].filter(Boolean).join(' ').trim();
  if (gabung) return gabung.slice(0, 160);

  // Emulator dan sebagian perangkat tidak melaporkan merek/model.
  const os = [Device.osName, Device.osVersion].filter(Boolean).join(' ');
  return (os || 'Perangkat tidak dikenal').slice(0, 160);
}

// Untuk dikirim bersama pendaftaran token push.
export function rincianPerangkat() {
  return {
    merek: Device.brand || null,
    model: Device.modelName || null,
    os: [Device.osName, Device.osVersion].filter(Boolean).join(' ') || null,
  };
}
