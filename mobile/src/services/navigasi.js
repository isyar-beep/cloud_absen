import { createNavigationContainerRef } from '@react-navigation/native';

// ============================================================
// Rujukan navigasi yang bisa dipakai dari LUAR pohon komponen.
//
// Dibutuhkan karena penyadap 401 di services/api.js berjalan di dalam
// axios, bukan di dalam sebuah layar -- di sana tidak ada useNavigation.
//
// Ditaruh di berkasnya sendiri, bukan di App.js, semata-mata untuk
// memutus impor melingkar: App.js memuat layar-layar, layar memuat
// api.js, dan api.js yang memuat App.js akan menutup lingkarannya. Pada
// Metro lingkaran seperti itu tidak berhenti dengan galat yang jelas --
// yang muncul cuma modul yang isinya undefined di saat dipakai.
// ============================================================

export const rujukanNavigasi = createNavigationContainerRef();

/**
 * Pulangkan ke layar login dan buang seluruh riwayat layar sebelumnya.
 *
 * reset, bukan navigate: dengan navigate, layar dashboard tetap tertumpuk
 * di belakang dan tombol kembali perangkat mengembalikan pegawai ke sana
 * -- ke layar yang seluruh isinya sudah tidak bisa dimuat lagi.
 */
export function pulangKeLogin() {
  if (rujukanNavigasi.isReady()) {
    rujukanNavigasi.reset({ index: 0, routes: [{ name: 'Login' }] });
  }
}
