const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { STUDENT_CSV_HEADERS, AUDIT_LOG_HEADERS } = require('./server/constants');
const { writeCSVFile } = require('./server/csvHelper');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const STUDENTS_FILE = path.join(DATA_DIR, 'pendaftar.csv');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_log.csv');

async function initData() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Initialize users.json
    if (!fs.existsSync(USERS_FILE)) {
        const salt = bcrypt.genSaltSync(10);
        const users = [
            {
                id: 'usr_super',
                username: 'superadmin',
                name: 'Super Admin SD 03',
                email: 'superadmin@sdsalatiga03.sch.id',
                passwordHash: bcrypt.hashSync('AdminSD03@2026!', salt),
                role: 'superadmin',
                createdAt: '2026-01-01 08:00:00'
            },
            {
                id: 'usr_petugas',
                username: 'petugas',
                name: 'Petugas Verifikasi PPDB',
                email: 'petugas@sdsalatiga03.sch.id',
                passwordHash: bcrypt.hashSync('PetugasSD03@2026!', salt),
                role: 'admin',
                createdAt: '2026-01-01 08:00:00'
            }
        ];
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
        console.log('Created default users.json');
    }

    // Initialize settings.json
    if (!fs.existsSync(SETTINGS_FILE)) {
        const settings = {
            nama_sekolah: 'SD SALATIGA 03',
            slogan: 'Cerdas • Berkarakter • Berprestasi',
            tahun_ajaran: '2026/2027',
            status_pendaftaran: 'buka', // 'buka' | 'tutup'
            jadwal_mulai: '2026-01-01',
            jadwal_selesai: '2026-06-30',
            kuota_rombel: 2,
            kuota_siswa: 56,
            biaya: 'Gratis',
            alamat: 'Jl. Kalitaman No. 03, Salatiga, Jawa Tengah 50711',
            telepon: '(0298) 321033',
            whatsapp: '081234567890',
            email: 'info@sdsalatiga03.sch.id',
            maps_url: 'https://maps.google.com/?q=Salatiga'
        };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
        console.log('Created default settings.json');
    }

    // Initialize 3 dummy students in pendaftar.csv
    if (!fs.existsSync(STUDENTS_FILE)) {
        const dummyStudents = [
            {
                no_pendaftaran: 'PMB-SD03-2026-001',
                nik: '3374011205190001',
                nisn: '0192837465',
                nama_lengkap: 'Ahmad Fauzan Pratama',
                nama_panggilan: 'Fauzan',
                jenis_kelamin: 'Laki-laki',
                tempat_lahir: 'Salatiga',
                tanggal_lahir: '2019-05-12',
                agama: 'Islam',
                anak_ke: '1',
                jumlah_saudara: '2',
                no_kk: '3374012001150005',
                alamat: 'Jl. Pemuda No. 45 RT 02 RW 03',
                rt: '02',
                rw: '03',
                kelurahan: 'Sidorejo Lor',
                kecamatan: 'Sidorejo',
                kabupaten: 'Kota Salatiga',
                provinsi: 'Jawa Tengah',
                kode_pos: '50714',
                nama_ayah: 'Bambang Pratama',
                nik_ayah: '3374011002820002',
                pendidikan_ayah: 'S1',
                pekerjaan_ayah: 'Karyawan Swasta',
                penghasilan_ayah: 'Rp 4.000.000 - Rp 6.000.000',
                no_hp_ayah: '081234567891',
                nama_ibu: 'Dewi Lestari',
                nik_ibu: '3374015508850003',
                pendidikan_ibu: 'D3',
                pekerjaan_ibu: 'Ibu Rumah Tangga',
                penghasilan_ibu: 'Tidak Berpenghasilan',
                no_hp_ibu: '081298765432',
                nama_wali: '',
                nik_wali: '',
                hubungan_wali: '',
                pekerjaan_wali: '',
                no_hp_wali: '',
                sekolah_asal: 'TK Pertiwi 01 Salatiga',
                npsn_sekolah_asal: '20301122',
                tahun_lulus: '2026',
                jarak_rumah: '1.2 km',
                transportasi: 'Sepeda Motor',
                prestasi: 'Juara 2 Lomba Mewarnai Tingkat Kecamatan 2025',
                keterangan: 'Pemberkasan Akta dan KK lengkap',
                status: 'Terverifikasi',
                tanggal_daftar: '2026-01-15 09:30:00',
                catatan_verifikasi: 'Data lengkap dan valid sesuai fisik Akta Kelahiran dan Kartu Keluarga.'
            },
            {
                no_pendaftaran: 'PMB-SD03-2026-002',
                nik: '3374026008190002',
                nisn: '0193748291',
                nama_lengkap: 'Siti Aisyah Azzahra',
                nama_panggilan: 'Aisyah',
                jenis_kelamin: 'Perempuan',
                tempat_lahir: 'Salatiga',
                tanggal_lahir: '2019-08-20',
                agama: 'Islam',
                anak_ke: '2',
                jumlah_saudara: '1',
                no_kk: '3374021404160008',
                alamat: 'Perum Grogol Indah Blok B-12',
                rt: '04',
                rw: '05',
                kelurahan: 'Dukuh',
                kecamatan: 'Sidomukti',
                kabupaten: 'Kota Salatiga',
                provinsi: 'Jawa Tengah',
                kode_pos: '50722',
                nama_ayah: 'Dr. Hendra Wijaya',
                nik_ayah: '3374021503800001',
                pendidikan_ayah: 'S2',
                pekerjaan_ayah: 'PNS / Dosen',
                penghasilan_ayah: 'Lebih dari Rp 7.000.000',
                no_hp_ayah: '081322334455',
                nama_ibu: 'drg. Rina Kusumawati',
                nik_ibu: '3374025007830004',
                pendidikan_ibu: 'S1 Profesi',
                pekerjaan_ibu: 'Dokter Gigi',
                penghasilan_ibu: 'Lebih dari Rp 7.000.000',
                no_hp_ibu: '081399887766',
                nama_wali: '',
                nik_wali: '',
                hubungan_wali: '',
                pekerjaan_wali: '',
                no_hp_wali: '',
                sekolah_asal: 'RA Al-Falah Salatiga',
                npsn_sekolah_asal: '20302233',
                tahun_lulus: '2026',
                jarak_rumah: '0.8 km',
                transportasi: 'Mobil Pribadi',
                prestasi: 'Juara 1 Lomba Hafalan Surat Pendek Tingkat Kota Salatiga 2025',
                keterangan: 'Pilihan Pertama',
                status: 'Diterima',
                tanggal_daftar: '2026-01-16 11:15:00',
                catatan_verifikasi: 'Selamat! Pendaftar diterima pada Jalur Zonasi Prioritas.'
            },
            {
                no_pendaftaran: 'PMB-SD03-2026-003',
                nik: '3374031411190003',
                nisn: '',
                nama_lengkap: 'Budi Santoso',
                nama_panggilan: 'Budi',
                jenis_kelamin: 'Laki-laki',
                tempat_lahir: 'Semarang',
                tanggal_lahir: '2019-11-14',
                agama: 'Kristen',
                anak_ke: '1',
                jumlah_saudara: '0',
                no_kk: '3374031010180012',
                alamat: 'Jl. Brigjen Sudiarto No. 18',
                rt: '01',
                rw: '02',
                kelurahan: 'Mangunsari',
                kecamatan: 'Sidomukti',
                kabupaten: 'Kota Salatiga',
                provinsi: 'Jawa Tengah',
                kode_pos: '50721',
                nama_ayah: 'Santoso Wijanarko',
                nik_ayah: '3374031109840005',
                pendidikan_ayah: 'SMA / SMK',
                pekerjaan_ayah: 'Wiraswasta',
                penghasilan_ayah: 'Rp 2.500.000 - Rp 4.000.000',
                no_hp_ayah: '085712345678',
                nama_ibu: 'Maria Magdalena',
                nik_ibu: '3374036212870006',
                pendidikan_ibu: 'SMA / SMK',
                pekerjaan_ibu: 'Pedagang',
                penghasilan_ibu: 'Rp 1.000.000 - Rp 2.500.000',
                no_hp_ibu: '085787654321',
                nama_wali: '',
                nik_wali: '',
                hubungan_wali: '',
                pekerjaan_wali: '',
                no_hp_wali: '',
                sekolah_asal: 'TK Kristen Satya Wacana',
                npsn_sekolah_asal: '20303344',
                tahun_lulus: '2026',
                jarak_rumah: '2.5 km',
                transportasi: 'Sepeda Motor',
                prestasi: '-',
                keterangan: 'Menunggu kelengkapan legalisir Akta Kelahiran',
                status: 'Menunggu Verifikasi',
                tanggal_daftar: '2026-01-18 14:20:00',
                catatan_verifikasi: 'Menunggu pengecekan fisik berkas pendaftaran di sekretariat.'
            }
        ];
        await writeCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS, dummyStudents);
        console.log('Created default pendaftar.csv with 3 dummy students');
    }

    // Initialize audit_log.csv
    if (!fs.existsSync(AUDIT_FILE)) {
        const dummyLogs = [
            {
                waktu: '2026-01-15 08:00:00',
                admin: 'system',
                aktivitas: 'Inisialisasi Sistem',
                data: 'Sistem PPDB SD Salatiga 03 diinisialisasi',
                ip: '127.0.0.1'
            },
            {
                waktu: '2026-01-15 09:35:00',
                admin: 'superadmin',
                aktivitas: 'Login',
                data: 'Login Super Admin berhasil',
                ip: '127.0.0.1'
            },
            {
                waktu: '2026-01-15 10:00:00',
                admin: 'superadmin',
                aktivitas: 'Verifikasi Data',
                data: 'PMB-SD03-2026-001 diubah menjadi Terverifikasi',
                ip: '127.0.0.1'
            }
        ];
        await writeCSVFile(AUDIT_FILE, AUDIT_LOG_HEADERS, dummyLogs);
        console.log('Created default audit_log.csv');
    }
}

if (require.main === module) {
    initData().then(() => {
        console.log('Data initialization complete!');
        process.exit(0);
    }).catch(err => {
        console.error('Data initialization failed:', err);
        process.exit(1);
    });
}

module.exports = { initData };
