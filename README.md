# Official Website PPDB SD SALATIGA 03 — TA 2026/2027

Website resmi **Pendaftaran Siswa Baru SD SALATIGA 03** Tahun Ajaran 2026/2027. Didesain secara modern, elegan, profesional, ramah orang tua/wali murid, dan responsif untuk smartphone, tablet, maupun desktop.

Sistem ini dirancang khusus **tanpa ketergantungan pada server database eksternal** (seperti MySQL, PostgreSQL, Firebase, Supabase, atau MongoDB). Seluruh data pendaftaran dikelola menggunakan format **CSV terpusat (thread-safe)** yang dapat langsung dibuka dan diolah di **Microsoft Excel** atau **Google Sheets**.

---

## 🌟 Identitas Sekolah & Desain

- **Nama Sekolah**: SD SALATIGA 03
- **Judul**: Pendaftaran Siswa Baru SD Salatiga 03
- **Tahun Ajaran**: 2026/2027
- **Slogan**: Cerdas • Berkarakter • Berprestasi
- **Nuansa Tampilan**: Tema Navy & Orange (`#0B192C` & `#F97316`) sesuai panduan visual resmi SD Salatiga 03.

---

## 🚀 Fitur Utama

### 👨‍👩‍👧 1. Sisi Orang Tua / Wali Murid (Publik)
1. **Halaman Beranda (`/`)**:
   - Hero Section dengan ringkasan kuota, jadwal (1 Jan – 30 Jun 2026), rombel (2 Rombel · 56 Siswa), dan biaya (Gratis).
   - 4 Kartu Fitur: Jadwal, Persyaratan, Alur 6 Langkah, dan Informasi Daftar Ulang.
   - Mengapa Memilih SD SALATIGA 03 (Keunggulan, karakter, fasilitas, tenaga pendidik).
   - Kontak lengkap & alamat resmi sekolah (Jl. Kalitaman No. 03, Salatiga).
2. **Formulir Pendaftaran Multi-Step (`/daftar`)**:
   - **Tahap 1**: Data Calon Siswa (NIK 16 digit, NISN, Nama Lengkap, TTL, JK, Agama, No. KK 16 digit, Alamat, RT/RW, Kelurahan, Kecamatan).
   - **Tahap 2**: Data Ayah Kandung (Nama, NIK, Tempat/Tgl Lahir, Pendidikan, Pekerjaan, Penghasilan, No. HP/WA).
   - **Tahap 3**: Data Ibu Kandung (Nama, NIK, Tempat/Tgl Lahir, Pendidikan, Pekerjaan, Penghasilan, No. HP/WA).
   - **Tahap 4**: Data Wali (Opsional / jika tinggal bersama wali).
   - **Tahap 5**: Sekolah Asal (Nama TK/RA/PAUD, NPSN, Tahun Lulus).
   - **Tahap 6**: Data Tambahan (Jarak rumah, transportasi, prestasi, keterangan tambahan).
   - **Tahap 7 (Konfirmasi)**: Ringkasan lengkap isian pendaftar + Pernyataan kebenaran data bermaterai moral sebelum pengiriman.
   - **Nomor Pendaftaran Otomatis**: Format `PMB-SD03-2026-001`, `PMB-SD03-2026-002`, dst.
3. **Cek Status Pendaftaran (`/status`)**:
   - Pencarian berdasarkan **Nomor Pendaftaran** atau **NIK Calon Siswa**.
   - Menampilkan status verifikasi berkas, tanggal daftar, dan catatan resmi dari panitia.
   - Perlindungan data pribadi (NIK dan HP dimasking, data sensitif keluarga tidak dibocorkan ke publik).
4. **Cetak Bukti Pendaftaran Resmi (`/bukti/:no_pendaftaran`)**:
   - Kop Surat Resmi SD SALATIGA 03.
   - Dilengkapi **QR Code** yang memuat nomor pendaftaran resmi (bukan data pribadi).
   - Petunjuk dokumen verifikasi fisik.
   - Tanda tangan orang tua dan panitia.
   - Siap cetak (A4 print-optimized via `window.print()`).

---

### 🛡️ 2. Sisi Admin (Dashboard Terproteksi)
1. **Autentikasi & Keamanan Sesi**:
   - URL Admin Login: `/admin/login`.
   - Akses langsung tanpa login otomatis diarahkan (redirect 302) ke halaman login.
   - Password di-hash menggunakan **Bcrypt** (tidak pernah disimpan plaintext).
   - Sesi terenkripsi dengan HttpOnly cookies & automatic idle timeout (30 menit).
   - Header `Cache-Control: no-store` mencegah pembukaan data lewat tombol *Back* browser setelah logout.
   - **Brute Force Protection**: Pembatasan percobaan login (maks. 5 kali gagal per 15 menit), pesan error generik *"Username atau password tidak valid"*.
2. **Perlindungan Data Pribadi (Privacy Masking)**:
   - Pada tabel utama dashboard, NIK dimasking (`3374********1234`) dan No HP dimasking (`0812******89`).
   - Admin harus menekan tombol **Detail** untuk melihat data lengkap, yang langsung tercatat di **Audit Log**.
3. **Role-Based Access Control**:
   - **SUPER ADMIN**: Akses penuh ke semua data, pengelolaan kuota & jadwal, hapus pendaftar, import, export, dan lihat audit log.
   - **ADMIN / PETUGAS**: Melihat data, memverifikasi berkas, mengubah status, dan memberikan catatan verifikasi.
4. **Verifikasi Data & Catatan Panitia**:
   - Status pendaftaran: `Baru`, `Menunggu Verifikasi`, `Berkas Perlu Diperbaiki`, `Terverifikasi`, `Diterima`, `Tidak Diterima`, `Daftar Ulang`.
   - Catatan verifikasi langsung terhubung ke halaman Cek Status orang tua.
5. **Import CSV**:
   - Upload file CSV dengan validasi header, jumlah kolom, pengecekan NIK 16 digit, dan deteksi duplikasi sebelum disimpan.
   - Dilengkapi pratinjau data valid vs tidak valid beserta alasan error.
   - Memerlukan konfirmasi admin sebelum data dimasukkan.
6. **Export CSV**:
   - Nama file: `PPDB_SD_Salatiga_03_2026.csv`.
   - Menggunakan encoding **UTF-8 with BOM (`\uFEFF`)** sehingga file langsung terbuka dengan rapi di Microsoft Excel.
   - Pilihan filter: Semua data, Berdasarkan status, Berdasarkan rentang tanggal, Data diterima, Data belum diverifikasi.
   - **Proteksi CSV Injection (Formula Injection)**: Input yang diawali karakter `=`, `+`, `-`, atau `@` disanitasi secara otomatis.
7. **Backup Data**:
   - Menu unduh langsung `BACKUP_PMB_SD_SALATIGA_03_2026.csv` disertai peringatan keamanan data pribadi.
8. **Audit Log**:
   - Pencatatan seluruh aktivitas admin: Login, Logout, Melihat data lengkap, Mengubah status, Export, Import, dan Perubahan pengaturan.

---

## 🔑 Akun Pengujian Resmi

| Akun | Username | Password | Role | Kewenangan |
|---|---|---|---|---|
| **Super Admin** | `superadmin` | `AdminSD03@2026!` | Super Admin | Akses penuh, Hapus data, Pengaturan sistem, User management |
| **Petugas PPDB** | `petugas` | `PetugasSD03@2026!` | Admin / Petugas | Verifikasi berkas, Ubah status, Input catatan, Export |

---

## 📁 Struktur Data CSV (`data/pendaftar.csv`)

Kolom standar yang tersimpan:
```csv
no_pendaftaran,nik,nisn,nama_lengkap,nama_panggilan,jenis_kelamin,tempat_lahir,tanggal_lahir,agama,anak_ke,jumlah_saudara,no_kk,alamat,rt,rw,kelurahan,kecamatan,kabupaten,provinsi,kode_pos,nama_ayah,nik_ayah,pendidikan_ayah,pekerjaan_ayah,penghasilan_ayah,no_hp_ayah,nama_ibu,nik_ibu,pendidikan_ibu,pekerjaan_ibu,penghasilan_ibu,no_hp_ibu,nama_wali,nik_wali,hubungan_wali,pekerjaan_wali,no_hp_wali,sekolah_asal,npsn_sekolah_asal,tahun_lulus,jarak_rumah,transportasi,prestasi,keterangan,status,tanggal_daftar,catatan_verifikasi
```

---

## 💻 Cara Menjalankan Sistem

### 1. Menjalankan Server
```bash
npm start
```
Buka browser di: **http://localhost:3000**

### 2. Menjalankan Pengujian Otomatis
```bash
# Pengujian unit & helper functions (validasi, format, csv injection, auto number)
node tests/testSuite.js

# Pengujian End-to-End (E2E) terhadap seluruh alur HTTP, auth, dan CSV
node tests/e2eTest.js
```
"# GANN" 
"# GANN" 
"# GANN" 
