const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { query } = require('../config/db');
const { hitungRate } = require('../utils/attendanceRate');
const { zonaWaktu } = require('../utils/date');

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// Ambil data rekap per pegawai + detail absensi untuk satu bulan.
// Dipakai bersama oleh export Excel dan PDF supaya query tidak duplikat.
async function ambilDataLaporan(month, year, departmentId) {
  const filterDepartemen = departmentId ? 'AND u.department_id = $3' : '';
  const params = departmentId ? [month, year, departmentId] : [month, year];

  const rekap = await query(
    `SELECT u.id, u.name, d.name AS department,
            COUNT(a.*) FILTER (WHERE a.status = 'hadir') AS hadir,
            COUNT(a.*) FILTER (WHERE a.status = 'terlambat') AS terlambat,
            COUNT(a.*) FILTER (WHERE a.status = 'izin') AS izin,
            COUNT(a.*) FILTER (WHERE a.status = 'alpha') AS alpha,
            COUNT(a.*) AS total_record
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     LEFT JOIN attendance a ON a.user_id = u.id
       AND EXTRACT(MONTH FROM a.date) = $1
       AND EXTRACT(YEAR FROM a.date) = $2
     WHERE u.role != 'admin' AND u.is_active = TRUE ${filterDepartemen}
     GROUP BY u.id, u.name, d.name
     ORDER BY u.name ASC`,
    params
  );

  const detail = await query(
    `SELECT a.date, a.check_in_time, a.check_out_time, a.status, a.reason,
            u.name, d.name AS department
     FROM attendance a
     JOIN users u ON a.user_id = u.id
     LEFT JOIN departments d ON u.department_id = d.id
     WHERE EXTRACT(MONTH FROM a.date) = $1
       AND EXTRACT(YEAR FROM a.date) = $2
       AND u.role != 'admin' AND u.is_active = TRUE ${filterDepartemen}
     ORDER BY a.date ASC, u.name ASC`,
    params
  );

  return { rekap: rekap.rows, detail: detail.rows };
}

// Rumusnya ada di utils/attendanceRate.js supaya sama persis dengan statistik

function formatJam(timestamp) {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: zonaWaktu(),
  });
}

function formatTanggal(date) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: zonaWaktu(),
  });
}

// GET /api/reports/attendance/excel?month=&year=&department_id= -- admin only
async function exportExcel(req, res, next) {
  try {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const departmentId = req.query.department_id || null;

    const { rekap, detail } = await ambilDataLaporan(month, year, departmentId);

    const workbook = new ExcelJS.Workbook();
    const judul = `Laporan Absensi ${NAMA_BULAN[month - 1]} ${year}`;

    // Sheet 1: Rekap per pegawai
    const sheetRekap = workbook.addWorksheet('Rekap');
    sheetRekap.addRow([judul]);
    sheetRekap.getRow(1).font = { bold: true, size: 14 };
    sheetRekap.addRow([]);
    const headerRekap = sheetRekap.addRow([
      'No', 'Nama', 'Departemen', 'Hadir', 'Terlambat', 'Izin', 'Alpha', 'Tingkat Kehadiran (%)',
    ]);
    headerRekap.font = { bold: true };

    rekap.forEach((row, i) => {
      sheetRekap.addRow([
        i + 1,
        row.name,
        row.department || '-',
        Number(row.hadir),
        Number(row.terlambat),
        Number(row.izin),
        Number(row.alpha),
        Number(hitungRate(row)),
      ]);
    });

    sheetRekap.columns = [
      { width: 5 }, { width: 30 }, { width: 20 }, { width: 10 },
      { width: 12 }, { width: 10 }, { width: 10 }, { width: 20 },
    ];

    // Sheet 2: Detail harian
    const sheetDetail = workbook.addWorksheet('Detail');
    const headerDetail = sheetDetail.addRow([
      'Tanggal', 'Nama', 'Departemen', 'Jam Masuk', 'Jam Pulang', 'Status', 'Keterangan',
    ]);
    headerDetail.font = { bold: true };

    detail.forEach((row) => {
      sheetDetail.addRow([
        formatTanggal(row.date),
        row.name,
        row.department || '-',
        formatJam(row.check_in_time),
        formatJam(row.check_out_time),
        row.status,
        row.reason || '',
      ]);
    });

    sheetDetail.columns = [
      { width: 12 }, { width: 30 }, { width: 20 }, { width: 12 },
      { width: 12 }, { width: 12 }, { width: 30 },
    ];

    const namaFile = `laporan-absensi-${year}-${String(month).padStart(2, '0')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${namaFile}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

// GET /api/reports/attendance/pdf?month=&year=&department_id= -- admin only
async function exportPdf(req, res, next) {
  try {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const departmentId = req.query.department_id || null;

    const { rekap } = await ambilDataLaporan(month, year, departmentId);

    const namaFile = `laporan-absensi-${year}-${String(month).padStart(2, '0')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${namaFile}"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text(`Laporan Absensi ${NAMA_BULAN[month - 1]} ${year}`);
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').fillColor('#666666')
      .text(`Dibuat: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    doc.moveDown(1);

    // Tabel rekap sederhana: posisi kolom tetap
    const kolom = [
      { label: 'No', x: 40, width: 25 },
      { label: 'Nama', x: 65, width: 150 },
      { label: 'Departemen', x: 215, width: 90 },
      { label: 'Hadir', x: 305, width: 40 },
      { label: 'Telat', x: 345, width: 40 },
      { label: 'Izin', x: 385, width: 35 },
      { label: 'Alpha', x: 420, width: 40 },
      { label: 'Rate (%)', x: 460, width: 60 },
    ];

    function gambarHeaderTabel(y) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      kolom.forEach((k) => doc.text(k.label, k.x, y, { width: k.width }));
      doc.moveTo(40, y + 14).lineTo(555, y + 14).strokeColor('#cccccc').stroke();
      return y + 20;
    }

    let y = gambarHeaderTabel(doc.y);

    doc.font('Helvetica').fontSize(9);
    rekap.forEach((row, i) => {
      // Ganti halaman jika hampir mencapai batas bawah A4
      if (y > 780) {
        doc.addPage();
        y = gambarHeaderTabel(40);
        doc.font('Helvetica').fontSize(9);
      }

      const nilai = [
        String(i + 1),
        row.name,
        row.department || '-',
        String(row.hadir),
        String(row.terlambat),
        String(row.izin),
        String(row.alpha),
        hitungRate(row),
      ];
      nilai.forEach((v, idx) => {
        doc.fillColor('#000000').text(v, kolom[idx].x, y, { width: kolom[idx].width, ellipsis: true });
      });
      y += 18;
    });

    if (rekap.length === 0) {
      doc.fillColor('#666666').text('Tidak ada data untuk periode ini.', 40, y);
    }

    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { exportExcel, exportPdf };
