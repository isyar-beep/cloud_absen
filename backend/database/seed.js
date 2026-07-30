// Script untuk membuat akun admin pertama kali
// Jalankan dengan: npm run seed
const bcrypt = require('bcryptjs');
const { query, pool } = require('../src/config/db');
require('dotenv').config();

async function seed() {
  try {
    const email = 'admin@company.com';
    const plainPassword = 'admin123'; // WAJIB diganti setelah login pertama kali

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
    console.log('Password :', plainPassword);
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
