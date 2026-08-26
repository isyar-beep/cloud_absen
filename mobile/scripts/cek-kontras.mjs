// ============================================================
// Periksa kontras tiap pasangan teks/latar di kedua tema mobile.
//
// Dua palet berarti dua kali lipat peluang salah, dan kesalahannya tidak
// pernah terlihat di mesin pengembang yang temanya cuma satu -- baru
// ketahuan saat pegawai membuka aplikasinya di lapangan dan melapor
// "tulisannya tidak kelihatan". Berkas ini mengubah keluhan itu jadi
// angka yang bisa diperiksa sebelum dikirim.
//
// Ambang WCAG AA: 4.5:1 untuk teks biasa, 3:1 untuk teks pembantu.
//
// Jalankan: npm run cek:kontras
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const akar = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(akar, 'src', 'theme.js'), 'utf8');
function ambilPalet(nama) {
  const m = src.match(new RegExp(`const ${nama} = \\{([\\s\\S]*?)\\n\\};`));
  const teks = m[1];
  const obj = {};
  for (const g of teks.matchAll(/(\w+):\s*'([^']+)'/g)) obj[g[1]] = g[2];
  for (const g of teks.matchAll(/(\w+):\s*\{\s*teks:\s*'([^']+)',\s*latar:\s*'([^']+)'/g)) {
    obj[g[1]] = { teks: g[2], latar: g[3] };
  }
  return obj;
}

function keRgb(c) {
  if (c.startsWith('#')) {
    const h = c.slice(1);
    const p = h.length === 3 ? h.split('').map((x) => x + x) : h.match(/../g);
    return [parseInt(p[0], 16), parseInt(p[1], 16), parseInt(p[2], 16), 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  const [r, g, b, a = 1] = m[1].split(',').map(Number);
  return [r, g, b, a];
}
function komposit(atas, bawah) {
  const [r1, g1, b1, a] = keRgb(atas);
  const [r2, g2, b2] = keRgb(bawah);
  return [r1 * a + r2 * (1 - a), g1 * a + g2 * (1 - a), b1 * a + b2 * (1 - a), 1];
}
function luminansi([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function rasio(teks, latar, dasar) {
  const t = komposit(teks, dasar);
  const l = komposit(latar, dasar);
  const [a, b] = [luminansi(t), luminansi(l)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

let gagal = 0;
for (const nama of ['TERANG', 'GELAP']) {
  const p = ambilPalet(nama);
  const dasar = p.permukaan;
  const uji = [
    ['teks pada permukaan', p.teks, p.permukaan, 4.5],
    ['teksBadan pada permukaan', p.teksBadan, p.permukaan, 4.5],
    ['teksRedup pada permukaan', p.teksRedup, p.permukaan, 4.5],
    ['teksSamar pada permukaan', p.teksSamar, p.permukaan, 3],
    ['teks pada latar', p.teks, p.latar, 4.5],
    ['teksRedup pada latar', p.teksRedup, p.latar, 4.5],
    ['teks pada permukaan2', p.teks, p.permukaan2, 4.5],
    ['teksDiWarna pada utama', p.teksDiWarna, p.utama, 4.5],
  ];
  for (const k of ['hadir', 'terlambat', 'izin', 'alpha']) {
    if (p[k]) uji.push([`status ${k}`, p[k].teks, p[k].latar, 4.5]);
  }
  for (const k of ['ungu', 'kuning', 'merah', 'hijau']) {
    if (p[k]) uji.push([`kotak ${k}`, p[k].teks, p[k].latar, 4.5]);
  }

  console.log(`\n--- ${nama} ---`);
  for (const [label, teks, latar, ambang] of uji) {
    const r = rasio(teks, latar, dasar);
    const ok = r >= ambang;
    if (!ok) gagal += 1;
    console.log(`${ok ? 'ok  ' : 'GAGAL'} ${label.padEnd(28)} ${r.toFixed(2)}:1 (min ${ambang})`);
  }
}
if (gagal) {
  console.log(`\n${gagal} pasangan di bawah ambang.`);
  process.exitCode = 1;
} else {
  console.log('\nSemua pasangan lolos ambang kontras.');
}
