const nodemailer = require('nodemailer');
require('dotenv').config();

// Transporter email untuk notifikasi (peringatan attendance rendah, dll).
// Sama seperti Firebase: hanya aktif jika kredensial SMTP lengkap di .env,
// supaya server tetap bisa jalan tanpa konfigurasi email.
const hasSmtpCredentials =
  process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS;

const transporter = hasSmtpCredentials
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465, // port 465 = SSL, lainnya STARTTLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

// Alamat pengirim; jatuh ke SMTP_USER jika SMTP_FROM tidak diisi
const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

module.exports = { transporter, fromAddress };
