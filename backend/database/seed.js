// Script untuk membuat akun admin pertama kali
// Jalankan dengan: npm run seed
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, pool } = require('../src/config/db');
require('dotenv').config();

// ============================================================
// Sandi admin pertama TIDAK LAGI ditanam di dalam kode.
//
// Sebelumnya berkas ini memasang 'admin123' -- tertulis di sini, di
// schema.sql, dan di README yang bisa dibaca siapa saja. Selama ada satu
// pemasangan yang lupa menggantinya, sandi admin sistem absensi itu
// sudah diketahui umum sejak menit pertama, dan tidak ada satu pun
// gejala yang akan memberi tahu.
//
// Sekarang: dipakai ADMIN_PASSWORD dari .env kalau ada, dan kalau tidak
// ada dibuatkan yang acak lalu DICETAK SEKALI di layar. Sandi yang
// dicetak sekali memaksa orang menyimpannya sekarang; sandi yang
// tertulis di README tidak memaksa siapa pun melakukan apa pun.
// ============================================================

// Tanpa huruf/angka yang mudah tertukar saat disalin dari layar (0/O, 1/l/I).
const ABJAD = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function sandiAcak(panjang = 16) {
  const b = crypto.randomBytes(panjang);
  let s = '';
  for (let i = 0; i < panjang; i += 1) s += ABJAD[b[i] % ABJAD.length];
  return s;
}

async function seed() {
  try {
    const email = process.env.ADMIN_EMAIL || 'admin@company.com';
    const dariEnv = process.env.ADMIN_PASSWORD;
    const plainPassword = dariEnv || sandiAcak();

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log('Akun admin sudah ada, seed dilewati.');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(plainPassword, 10);

    await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')`,
      ['Administrator', email, passwordHash]
    );

    console.log('============================================');
    console.log('Akun admin berhasil dibuat!');
    console.log('Email    :', email);
    if (dariEnv) {
      console.log('Password : (dari ADMIN_PASSWORD di .env)');
    } else {
      console.log('Password :', plainPassword);
      console.log('');
      console.log('CATAT SEKARANG. Sandi ini dibuat acak dan tidak');
      console.log('tersimpan di mana pun -- tidak bisa ditampilkan lagi.');
    }
    console.log('PENTING  : Segera ganti password setelah login pertama.');
    console.log('============================================');
    process.exit(0);
  } catch (err) {
    console.error('Gagal membuat akun admin:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
