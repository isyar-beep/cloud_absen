import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../components/AdminSidebar';
import {
  ArrowLeftIcon, BellIcon, BookIcon, BriefcaseIcon, CalendarIcon,
  CameraIcon, CheckBadgeIcon, CheckIcon, ClipboardIcon, ClockIcon,
  DocumentIcon, UsersIcon,
} from '../components/Icons';
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

function Bagian({ judul, keterangan, icon: Ikon = BookIcon, anak }) {
  return (
    <section className="kartu-kaca p-5 sm:p-6 mb-4">
      <div className="flex items-start gap-3.5 mb-5">
        <span className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-300 flex items-center justify-center shrink-0">
          <Ikon className="w-5 h-5" />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-[18px] leading-tight font-bold text-strong tracking-[-0.015em]">{judul}</h2>
          {keterangan && <p className="text-[13px] text-muted mt-1 leading-relaxed">{keterangan}</p>}
        </div>
      </div>
      <div className="space-y-4 text-sm text-body leading-[1.7]">{anak}</div>
    </section>
  );
}

function Tanya({ t, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-6 h-6 rounded-lg bg-surface-2 text-primary-600 dark:text-primary-300 flex items-center justify-center shrink-0 mt-0.5">
        <CheckIcon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-strong leading-[1.55]">{t}</p>
        <div className="text-body mt-1 leading-[1.7]">{children}</div>
      </div>
    </div>
  );
}

const UMUM = (
  <>
    <Bagian
      judul="Aturan yang tidak terlihat di layar"
      keterangan="Cara sistem menentukan waktu, status, dan lokasi absensi."
      icon={ClockIcon}
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

    {/* Bagian ini ditujukan kepada orang yang datanya diambil, bukan kepada
        yang memasang sistemnya. Kebijakan privasi yang hanya hidup sebagai
        berkas di repositori tidak pernah dibaca pegawai; yang dibacanya
        adalah layar yang ada di depannya. */}
    <Bagian
      judul="Data Anda"
      keterangan="Apa yang direkam, siapa yang dapat melihat, dan bagaimana data dilindungi."
      icon={CheckBadgeIcon}
      anak={
        <>
          <Tanya t="Foto dan lokasi diambil hanya saat Anda menekan tombol absen.">
            Aplikasi tidak melacak posisi Anda di latar belakang dan tidak membuka
            kamera di luar layar absensi. Di luar dua saat itu, tidak ada apa pun
            yang direkam.
          </Tanya>
          <Tanya t="Foto absensi tidak terbuka untuk umum.">
            Foto tidak bisa dibuka dengan menebak alamatnya. Setiap pembukaan
            memerlukan izin berumur pendek yang diperiksa kepemilikannya, jadi
            tautan yang terlanjur bocor keluar akan mati dengan sendirinya.
          </Tanya>
          <Tanya t="Kata sandi Anda tidak bisa dilihat siapa pun, termasuk admin.">
            Yang disimpan bukan kata sandinya, melainkan hasil pengacakannya. Admin
            hanya bisa menetapkan yang baru — tidak pernah membaca yang lama.
          </Tanya>
          <Tanya t="Siapa yang bisa melihat data Anda.">
            Anda sendiri; konsultan penanggung jawab proyek tempat Anda ditugaskan;
            dan admin dinas. Konsultan proyek lain tidak bisa, walau ia mengetik
            alamatnya langsung.
          </Tanya>
          <Tanya t="Riwayat absensi tidak ikut terhapus saat akun dinonaktifkan.">
            Riwayat itu dasar pembayaran yang sudah terjadi dan bisa diperiksa
            kemudian, jadi ia tetap tersimpan. Yang berhenti adalah aksesnya, dan
            itu berlaku seketika.
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
        keterangan="Pengelolaan personel, proyek, kalender kerja, dan ketertiban data."
        icon={UsersIcon}
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
        keterangan="Pemantauan proyek, keputusan pengajuan, dan koreksi absensi."
        icon={BriefcaseIcon}
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
        keterangan="Langkah utama untuk absensi, izin, dan koreksi kehadiran."
        icon={CameraIcon}
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

const RINGKASAN = {
  admin: {
    judul: 'Peran Dinas',
    deskripsi: 'Menjaga struktur organisasi dan aturan kerja tetap benar.',
    poin: [
      { icon: UsersIcon, label: 'Kelola personel' },
      { icon: BriefcaseIcon, label: 'Susun proyek' },
      { icon: ClipboardIcon, label: 'Atur shift kerja' },
      { icon: CalendarIcon, label: 'Tentukan hari libur' },
    ],
  },
  konsultan: {
    judul: 'Peran Konsultan',
    deskripsi: 'Memantau pekerjaan dan mengambil keputusan untuk proyeknya.',
    poin: [
      { icon: BriefcaseIcon, label: 'Pantau proyek' },
      { icon: DocumentIcon, label: 'Putuskan pengajuan' },
      { icon: BellIcon, label: 'Tindak pemberitahuan' },
      { icon: ClockIcon, label: 'Periksa koreksi' },
    ],
  },
  staff: {
    judul: 'Peran Pegawai',
    deskripsi: 'Mencatat kehadiran dan mengelola pengajuan pribadi.',
    poin: [
      { icon: CameraIcon, label: 'Absen berfoto' },
      { icon: DocumentIcon, label: 'Ajukan izin' },
      { icon: ClockIcon, label: 'Periksa riwayat' },
      { icon: CheckBadgeIcon, label: 'Lengkapi koreksi' },
    ],
  },
};

function KontenPanduan({ peran, versi }) {
  const info = RINGKASAN[peran] || RINGKASAN.staff;

  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_19rem] gap-5 items-start">
      <main className="min-w-0">{ISI[peran] || ISI.staff}</main>

      <aside className="space-y-4 xl:sticky xl:top-6">
        <section className="kartu-kaca p-5">
          <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-300 flex items-center justify-center mb-4">
            <BookIcon className="w-5 h-5" />
          </div>
          <h2 className="text-[17px] font-bold text-strong tracking-[-0.01em]">{info.judul}</h2>
          <p className="text-[13px] text-muted leading-relaxed mt-1.5 mb-4">{info.deskripsi}</p>
          <div className="space-y-2.5">
            {info.poin.map((item) => (
              <div key={item.label} className="flex items-center gap-2.5 text-sm font-medium text-body">
                <item.icon className="w-[17px] h-[17px] text-primary-600 dark:text-primary-300 shrink-0" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <p className="text-xs text-faint px-1">
          Absensi Konsultan versi {versi} — PERCIPKAR
        </p>
      </aside>
    </div>
  );
}

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
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-strong transition mb-5"
          >
            <ArrowLeftIcon className="w-4 h-4" /> Kembali
          </button>

          <h1 className="text-2xl sm:text-[1.75rem] leading-tight font-extrabold text-strong tracking-[-0.02em] mb-1">Petunjuk Penggunaan</h1>
          <p className="text-sm text-muted mb-6">Panduan penggunaan sistem berdasarkan peran dan tanggung jawab</p>

          <KontenPanduan peran="staff" versi={versi} />
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
            Panduan penggunaan sistem berdasarkan peran dan tanggung jawab
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

        <KontenPanduan peran={peran} versi={versi} />
      </div>
    </div>
  );
}
