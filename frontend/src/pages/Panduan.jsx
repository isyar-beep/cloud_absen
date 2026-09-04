import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import { ArrowLeftIcon } from '../components/Icons';
import { useAuthStore } from '../store/authStore';
import { namaPeran } from '../utils/peran';

// ============================================================
// Petunjuk penggunaan, dibaca dari dalam sistem.
//
// Panduan yang hanya ada sebagai berkas terpisah tidak pernah terbaca:
// orang yang bingung sedang menatap layar, bukan sedang membuka folder
// dokumen. Karena itu ia ditaruh di sini, di tempat kebingungannya
// terjadi.
//
// Isinya mengikuti PERAN. Dinas, konsultan, dan pegawai memakai sistem
// yang sama tapi mengerjakan hal berbeda; panduan yang mencampur
// ketiganya memaksa tiap orang melewati dua pertiga isi yang bukan
// urusannya, dan bagian yang dilewati itu biasanya termasuk yang
// dibutuhkannya.
//
// Yang ditulis di sini adalah hal-hal yang TIDAK BISA DITEBAK dari
// layar: aturan yang tersembunyi di belakang tombol. Menerangkan bahwa
// tombol "Simpan" menyimpan hanya menambah panjang tanpa menambah tahu.
// ============================================================

function Bagian({ judul, anak }) {
  return (
    <section className="kartu-kaca p-5 mb-4">
      <h2 className="text-[17px] font-bold text-strong tracking-[-0.01em] mb-3">{judul}</h2>
      <div className="space-y-3 text-sm text-body leading-relaxed">{anak}</div>
    </section>
  );
}

function Tanya({ t, children }) {
  return (
    <div>
      <p className="font-semibold text-strong">{t}</p>
      <div className="text-body mt-1">{children}</div>
    </div>
  );
}

const UMUM = (
  <>
    <Bagian
      judul="Aturan yang tidak terlihat di layar"
      anak={
        <>
          <Tanya t="Tanggal absensi mengikuti tanggal SHIFT, bukan tanggal saat tombol ditekan.">
            Untuk shift malam 22.00–06.00, absen masuk Jumat malam dan absen pulang
            Sabtu pagi tercatat pada tanggal yang sama, yaitu Jumat. Jadi laporan
            harian tidak terpecah dua.
          </Tanya>
          <Tanya t="Absen punya jendela waktu, bukan bebas sepanjang hari.">
            Tiap shift punya batas sendiri — misalnya masuk 07.30–08.30. Di luar
            jendela itu tombolnya mati dan menyebutkan pukul berapa ia dibuka.
            Batasnya diatur di menu Shift &amp; WFA.
          </Tanya>
          <Tanya t="Terlambat tetap dihitung hadir.">
            Terlambat itu soal disiplin jam, bukan soal hadir atau tidak. Ia tidak
            menurunkan angka kehadiran, tapi tercatat terpisah agar bisa ditegur.
          </Tanya>
          <Tanya t="Izin, sakit, dan cuti yang disetujui tidak menurunkan angka kehadiran.">
            Ketidakhadiran yang sah dikeluarkan dari perhitungan, bukan dihitung
            sebagai hari bolos. Rumusnya: (hadir + terlambat) ÷ (hadir + terlambat + alpha).
          </Tanya>
          <Tanya t="Sistem ini TIDAK membatasi lokasi absen.">
            Koordinat direkam dan ditampilkan sebagai keterangan tempat, tapi absen
            tidak pernah ditolak karena posisi. Penandaan WFA juga untuk pelaporan,
            bukan untuk melonggarkan batasan yang memang tidak ada.
          </Tanya>
        </>
      }
    />
  </>
);

const ISI = {
  admin: (
    <>
      <Bagian
        judul="Yang menjadi tanggung jawab dinas"
        anak={
          <>
            <Tanya t="Daftar personel dipegang dinas, bukan konsultan.">
              Menambah, menonaktifkan, dan memindahkan pegawai antar proyek hanya
              bisa dilakukan dari akun dinas di menu Pengguna. Konsultan memantau
              dan menyetujui, tapi tidak menyusun daftarnya.
            </Tanya>
            <Tanya t="Satu pegawai aktif di satu proyek saja.">
              Absensi dicap dengan proyek pada saat absen dilakukan. Kalau pegawai
              dipindah, riwayat lamanya tetap menempel pada proyek tempat kehadiran
              itu sungguh terjadi — jadi laporan lama tidak berubah surut.
            </Tanya>
            <Tanya t="Pegawai tanpa proyek hanya bisa diurus dinas.">
              Pengajuannya tidak akan sampai ke konsultan mana pun, karena tidak ada
              yang berhak menerimanya. Pastikan setiap pegawai punya proyek.
            </Tanya>
            <Tanya t="Alpha ditandai otomatis tiap dini hari.">
              Pegawai yang tidak absen dan tidak punya izin ditandai alpha untuk hari
              sebelumnya. Akhir pekan menurut shift masing-masing dan hari libur
              terdaftar dilewati.
            </Tanya>
            <Tanya t="Hari libur bisa diisi sekaligus untuk rentang panjang.">
              Di menu Hari Libur, isi tanggal mulai dan selesai — cuti bersama tidak
              perlu dimasukkan satu per satu.
            </Tanya>
          </>
        }
      />
      {UMUM}
    </>
  ),

  konsultan: (
    <>
      <Bagian
        judul="Yang menjadi tanggung jawab konsultan"
        anak={
          <>
            <Tanya t="Anda hanya melihat pegawai di proyek Anda.">
              Riwayat, galeri foto, statistik, dan pengajuan semuanya sudah tersaring.
              Pegawai proyek lain tidak akan pernah muncul, termasuk lewat alamat
              yang diketik langsung.
            </Tanya>
            <Tanya t="Anda yang biasanya memutuskan pengajuan izin.">
              Konsultanlah yang tahu apakah pekerjaan lapangan bisa ditinggal hari
              itu. Dinas juga bisa memutuskan bila Anda berhalangan — jadi periksa
              menu Pengajuan secara berkala agar tidak menumpuk.
            </Tanya>
            <Tanya t="Pemberitahuan memberi tahu Anda tanpa perlu membuka menu.">
              Angka merah di menu Pemberitahuan muncul begitu ada pengajuan masuk
              dari pegawai proyek Anda.
            </Tanya>
            <Tanya t="Koreksi absensi mengubah data, jadi ia tercatat.">
              Setiap perubahan jam menyimpan siapa yang mengubah dan alasannya.
              Ini yang membuat data kehadiran bisa dipertanggungjawabkan.
            </Tanya>
          </>
        }
      />
      {UMUM}
    </>
  ),

  staff: (
    <>
      <Bagian
        judul="Cara memakai"
        anak={
          <>
            <Tanya t="Absen masuk dan pulang memakai foto.">
              Buka menu Absen, ambil foto, kirim. Jam dan koordinat tercatat
              otomatis — tidak perlu diisi.
            </Tanya>
            <Tanya t="Lupa absen pulang tidak menghanguskan kehadiran Anda.">
              Hari itu tetap terhitung hadir, hanya ditandai belum lengkap. Ajukan
              koreksi dari menu Riwayat, dan tuliskan alasannya.
            </Tanya>
            <Tanya t="Izin, sakit, dan cuti diajukan dari menu Pengajuan Izin.">
              Lampiran seperti surat dokter boleh dilampirkan, tapi tidak wajib.
              Hasil keputusannya akan muncul sebagai pemberitahuan.
            </Tanya>
            <Tanya t="Cuti tidak punya jatah tahunan di sistem ini.">
              Yang menentukan disetujui atau tidak adalah pertimbangan konsultan dan
              dinas, bukan sisa hitungan hari.
            </Tanya>
          </>
        }
      />
      {UMUM}
    </>
  ),
};

export default function Panduan() {
  const { user } = useAuthStore();
  const [peran, setPeran] = useState(user?.role || 'staff');
  const navigate = useNavigate();

  const versi = typeof __VERSI_APLIKASI__ !== 'undefined' ? __VERSI_APLIKASI__ : '-';

  // Pegawai memakai tata letak sendiri di web -- tanpa sidebar admin.
  // Memasang AdminSidebar untuk mereka akan menampilkan deretan menu yang
  // tidak boleh mereka buka, dan setiap tautannya berujung ditolak.
  const pegawai = user?.role === 'staff';

  if (pegawai) {
    return (
      <div className="min-h-screen px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-strong transition mb-5"
          >
            <ArrowLeftIcon className="w-4 h-4" /> Kembali
          </button>

          <h1 className="text-xl font-bold text-strong tracking-tight mb-1">Petunjuk Penggunaan</h1>
          <p className="text-sm text-muted mb-6">Aturan yang tidak terlihat langsung di layar</p>

          {ISI.staff}

          <p className="text-xs text-faint mt-6">
            Absensi Konsultan versi {versi} — PERCIPKAR
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-[padding] duration-200 lg:pl-[var(--lebar-sidebar)]">
      <AdminSidebar />

      <div className="wadah-petak px-5 lg:px-8 py-7">
        <div className="mb-6">
          <h1 className="text-[1.75rem] leading-tight font-extrabold text-strong tracking-[-0.02em]">
            Petunjuk Penggunaan
          </h1>
          <p className="text-sm text-body mt-0.5">
            Aturan yang tidak terlihat langsung di layar
          </p>
        </div>

        {/* Dinas boleh membaca panduan peran lain: saat melatih orang baru,
            yang dibutuhkan justru panduan orang itu, bukan panduannya sendiri. */}
        {user?.role === 'admin' && (
          <div className="flex flex-wrap gap-2 mb-5">
            {['admin', 'konsultan', 'staff'].map((p) => (
              <button
                key={p}
                onClick={() => setPeran(p)}
                className={`text-sm px-4 py-2 rounded-full font-medium transition ${
                  peran === p
                    ? 'bg-primary-600 text-white shadow-glow'
                    : 'bg-surface/75 backdrop-blur-xl border border-line text-body hover:border-line-strong'
                }`}
              >
                {namaPeran(p)}
              </button>
            ))}
          </div>
        )}

        <div className="max-w-3xl">
          {ISI[peran] || ISI.staff}

          <p className="text-xs text-faint mt-6">
            Absensi Konsultan versi {versi} — PERCIPKAR
          </p>
        </div>
      </div>
    </div>
  );
}
