const test = require('node:test');
const assert = require('node:assert/strict');
const { adaBasisData, siapkan, bersihkan, tutup, ambilPool } = require('./bantuan/basisData');

// ============================================================
// Deteksi titip absen.
//
// Yang diuji di sini bukan "apakah pelanggarnya diblokir" -- memang tidak
// ada yang diblokir, dan itu keputusan yang disengaja. Yang diuji:
// apakah keadaan yang perlu dilihat manusia benar-benar MUNCUL di
// daftarnya, dan yang wajar TIDAK ikut muncul.
//
// Sisi kedua itu sama pentingnya. Daftar yang penuh tuduhan palsu akan
// berhenti dipercaya, dan setelah itu yang sungguhan ikut terlewat --
// persis seperti pemantauan yang peringatannya tidak pernah dibaca.
// ============================================================

test('deteksi absensi yang perlu ditinjau', async (t) => {
  if (!(await adaBasisData())) {
    t.skip('PostgreSQL tidak tersedia atau skemanya belum dimigrasi');
    return;
  }

  const d = await siapkan('curiga');
  const p = ambilPool();
  const { perangkatDipakaiBersama, absenBerdempet } = require('../src/utils/kecurigaan');
  t.after(async () => { await bersihkan(); await tutup(); });

  const admin = { id: d.admin, role: 'admin' };
  const konsultanA = { id: d.konsultanA, role: 'konsultan' };
  const konsultanB = { id: d.konsultanB, role: 'konsultan' };

  const kosongkan = () =>
    p.query('DELETE FROM attendance WHERE user_id = ANY($1::int[])',
      [[d.pegawaiA, d.pegawaiB, d.pegawaiLepas]]);

  const absen = ({ user, tanggal, jam = '08:00:00', sidik = null, lat = null, lon = null, proyek }) =>
    p.query(
      `INSERT INTO attendance (user_id, date, check_in_time, status, sidik_perangkat, latitude, longitude, project_id)
       VALUES ($1, $2, ($2::date + $3::time), 'hadir', $4, $5, $6, $7)`,
      [user, tanggal, jam, sidik, lat, lon, proyek ?? null]
    );

  // --- Sinyal kuat: satu perangkat, dua pegawai, hari sama ---

  await t.test('SATU PERANGKAT DIPAKAI DUA PEGAWAI pada hari sama tertangkap', async () => {
    await kosongkan();
    await absen({ user: d.pegawaiA, tanggal: '2026-05-04', sidik: 'hp-andi', proyek: d.proyekA });
    await absen({ user: d.pegawaiB, tanggal: '2026-05-04', jam: '08:05:00', sidik: 'hp-andi', proyek: d.proyekA });

    const hasil = await perangkatDipakaiBersama(admin, {});
    assert.equal(hasil.length, 1);
    assert.equal(hasil[0].jumlah_pegawai, 2);
    assert.equal(hasil[0].tanggal, '2026-05-04');
  });

  await t.test('satu pegawai absen masuk DAN pulang dari HP sendiri tidak ditandai', async () => {
    // Keadaan paling normal yang ada: dua baris pada perangkat yang sama.
    // Kalau COUNT-nya tidak DISTINCT per pegawai, setiap orang yang absen
    // lengkap akan tertuduh setiap hari.
    await kosongkan();
    await absen({ user: d.pegawaiA, tanggal: '2026-05-05', sidik: 'hp-andi', proyek: d.proyekA });
    await p.query(
      `UPDATE attendance SET check_out_time = date + time '17:00:00'
       WHERE user_id = $1 AND date = '2026-05-05'`, [d.pegawaiA]
    );

    assert.deepEqual(await perangkatDipakaiBersama(admin, {}), []);
  });

  await t.test('perangkat berbeda pada hari sama tidak ditandai', async () => {
    await kosongkan();
    await absen({ user: d.pegawaiA, tanggal: '2026-05-06', sidik: 'hp-andi', proyek: d.proyekA });
    await absen({ user: d.pegawaiB, tanggal: '2026-05-06', sidik: 'hp-budi', proyek: d.proyekA });

    assert.deepEqual(await perangkatDipakaiBersama(admin, {}), []);
  });

  await t.test('perangkat sama tapi hari BERBEDA tidak ditandai', async () => {
    // HP bekas yang berpindah tangan antar pegawai adalah keadaan yang
    // sah. Yang mencurigakan hanya pemakaian pada hari yang sama.
    await kosongkan();
    await absen({ user: d.pegawaiA, tanggal: '2026-05-07', sidik: 'hp-bekas', proyek: d.proyekA });
    await absen({ user: d.pegawaiB, tanggal: '2026-06-20', sidik: 'hp-bekas', proyek: d.proyekA });

    assert.deepEqual(await perangkatDipakaiBersama(admin, {}), []);
  });

  await t.test('absensi tanpa penanda perangkat tidak pernah ditandai', async () => {
    // Absensi lama dan aplikasi versi lama tidak mengirimkannya. Kalau
    // NULL dianggap sama dengan NULL, SELURUH absensi lama akan tertuduh
    // sekaligus pada hari migrasi dipasang.
    await kosongkan();
    await absen({ user: d.pegawaiA, tanggal: '2026-05-08', sidik: null, proyek: d.proyekA });
    await absen({ user: d.pegawaiB, tanggal: '2026-05-08', sidik: null, proyek: d.proyekA });

    assert.deepEqual(await perangkatDipakaiBersama(admin, {}), []);
  });

  // --- Lingkup proyek tetap dijaga ---

  await t.test('konsultan hanya melihat temuan di proyeknya', async () => {
    await kosongkan();
    await absen({ user: d.pegawaiA, tanggal: '2026-05-09', sidik: 'hp-x', proyek: d.proyekA });
    await absen({ user: d.pegawaiB, tanggal: '2026-05-09', sidik: 'hp-x', proyek: d.proyekA });

    assert.equal((await perangkatDipakaiBersama(konsultanA, {})).length, 1, 'konsultan A berhak');
    assert.equal((await perangkatDipakaiBersama(konsultanB, {})).length, 0, 'konsultan B tidak');
  });

  await t.test('konsultan tanpa proyek tidak melihat apa pun', async () => {
    await kosongkan();
    await absen({ user: d.pegawaiA, tanggal: '2026-05-10', sidik: 'hp-y', proyek: d.proyekA });
    await absen({ user: d.pegawaiB, tanggal: '2026-05-10', sidik: 'hp-y', proyek: d.proyekA });

    const kosong = { id: d.konsultanKosong, role: 'konsultan' };
    assert.deepEqual(await perangkatDipakaiBersama(kosong, {}), []);
  });

  await t.test('rentang tanggal menyaring', async () => {
    await kosongkan();
    await absen({ user: d.pegawaiA, tanggal: '2026-05-11', sidik: 'hp-z', proyek: d.proyekA });
    await absen({ user: d.pegawaiB, tanggal: '2026-05-11', sidik: 'hp-z', proyek: d.proyekA });

    assert.equal((await perangkatDipakaiBersama(admin, { dari: '2026-05-11' })).length, 1);
    assert.equal((await perangkatDipakaiBersama(admin, { dari: '2026-05-12' })).length, 0);
    assert.equal((await perangkatDipakaiBersama(admin, { sampai: '2026-05-10' })).length, 0);
  });

  // --- Sinyal lemah: koordinat berdempet ---

  await t.test('dua absensi dari titik dan detik yang sama tertangkap', async () => {
    await kosongkan();
    await absen({ user: d.pegawaiA, tanggal: '2026-05-12', jam: '08:00:00', lat: -5.147665, lon: 119.432732, proyek: d.proyekA });
    await absen({ user: d.pegawaiB, tanggal: '2026-05-12', jam: '08:00:20', lat: -5.147666, lon: 119.432733, proyek: d.proyekA });

    const hasil = await absenBerdempet(admin, {});
    assert.equal(hasil.length, 1);
    assert.equal(hasil[0].selisih_detik, 20);
  });

  await t.test('tiap pasangan muncul sekali, bukan dua kali', async () => {
    // Tanpa syarat a.user_id < b.user_id, setiap pasangan terhitung dari
    // kedua sisinya dan daftarnya penuh baris kembar.
    await kosongkan();
    await absen({ user: d.pegawaiA, tanggal: '2026-05-13', jam: '08:00:00', lat: -5.1, lon: 119.4, proyek: d.proyekA });
    await absen({ user: d.pegawaiB, tanggal: '2026-05-13', jam: '08:00:10', lat: -5.1, lon: 119.4, proyek: d.proyekA });

    assert.equal((await absenBerdempet(admin, {})).length, 1);
  });

  await t.test('jarak yang cukup jauh tidak ditandai', async () => {
    await kosongkan();
    await absen({ user: d.pegawaiA, tanggal: '2026-05-14', jam: '08:00:00', lat: -5.147, lon: 119.432, proyek: d.proyekA });
    await absen({ user: d.pegawaiB, tanggal: '2026-05-14', jam: '08:00:10', lat: -5.200, lon: 119.500, proyek: d.proyekA });

    assert.deepEqual(await absenBerdempet(admin, {}), []);
  });

  await t.test('selisih waktu yang jauh tidak ditandai walau titiknya sama', async () => {
    // Dua pegawai di satu proyek memang absen dari titik yang sama
    // sepanjang hari. Tanpa batas waktu, seluruh kru akan tertuduh
    // setiap hari.
    await kosongkan();
    await absen({ user: d.pegawaiA, tanggal: '2026-05-15', jam: '07:00:00', lat: -5.1, lon: 119.4, proyek: d.proyekA });
    await absen({ user: d.pegawaiB, tanggal: '2026-05-15', jam: '09:30:00', lat: -5.1, lon: 119.4, proyek: d.proyekA });

    assert.deepEqual(await absenBerdempet(admin, {}), []);
  });

  await t.test('absensi tanpa koordinat tidak ditandai', async () => {
    await kosongkan();
    await absen({ user: d.pegawaiA, tanggal: '2026-05-16', jam: '08:00:00', proyek: d.proyekA });
    await absen({ user: d.pegawaiB, tanggal: '2026-05-16', jam: '08:00:05', proyek: d.proyekA });

    assert.deepEqual(await absenBerdempet(admin, {}), []);
  });
});
