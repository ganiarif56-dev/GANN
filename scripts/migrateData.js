/**
 * Migration Script: Migrate data/pendaftar.csv to 34 Main Columns
 */

const fs = require('fs');
const path = require('path');
const { STUDENT_CSV_HEADERS, INCOME_CATEGORIES } = require('../server/constants');
const { parseCSV, toCSV } = require('../server/csvHelper');

const DATA_FILE = path.join(__dirname, '..', 'data', 'pendaftar.csv');

function mapIncome(val) {
    if (!val) return 'Rp1.000.001–Rp2.000.000';
    const s = String(val).toLowerCase();
    if (s.includes('tidak berpenghasilan') || s.includes('kurang') || s.includes('bawah') || s.includes('500.000')) {
        return 'Di bawah Rp500.000';
    }
    if (s.includes('1.000.000') && !s.includes('2.500.000') && !s.includes('2.000.000')) {
        return 'Rp500.000–Rp1.000.000';
    }
    if (s.includes('1.000.000') || s.includes('2.000.000') || s.includes('2.500.000')) {
        return 'Rp1.000.001–Rp2.000.000';
    }
    if (s.includes('4.000.000') || s.includes('5.000.000') || s.includes('3.500.000') || s.includes('3.000.000') || s.includes('2.500.000')) {
        return 'Rp2.000.001–Rp5.000.000';
    }
    if (s.includes('7.000.000') || s.includes('7.500.000') || s.includes('lebih') || s.includes('atas')) {
        return 'Di atas Rp5.000.000';
    }
    return 'Rp1.000.001–Rp2.000.000';
}

function mapStatus(oldStatus) {
    if (!oldStatus) return 'Belum Dicek';
    if (['Terverifikasi', 'Diterima', 'Daftar Ulang', 'Valid'].includes(oldStatus)) return 'Valid';
    if (['Berkas Perlu Diperbaiki', 'Perlu Perbaikan'].includes(oldStatus)) return 'Perlu Perbaikan';
    if (['Perlu Dicek'].includes(oldStatus)) return 'Perlu Dicek';
    return 'Belum Dicek';
}

function runMigration() {
    console.log('🔄 Memulai migrasi data ke 34 Kolom...');

    if (!fs.existsSync(DATA_FILE)) {
        console.error('File data pendaftar.csv tidak ditemukan!');
        return;
    }

    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const oldRows = parseCSV(content);
    console.log(`Ditemukan ${oldRows.length} data pendaftar lama.`);

    const migratedRows = oldRows.map((r, i) => {
        const isPip = (i % 3 === 0) ? 'Ya' : 'Tidak'; // Seed realistic PIP distribution for dummy data
        const incomeAyah = mapIncome(r.penghasilan_ayah);
        const incomeIbu = mapIncome(r.penghasilan_ibu);

        return {
            no_pendaftaran: r.no_pendaftaran || `PMB-SD03-2026-${String(i + 1).padStart(3, '0')}`,
            nama_lengkap: r.nama_lengkap || '',
            nik: r.nik || '',
            jenis_kelamin: r.jenis_kelamin || 'Laki-laki',
            nisn: r.nisn || '',
            alamat: r.alamat || '',
            tempat_lahir: r.tempat_lahir || 'Salatiga',
            tanggal_lahir: r.tanggal_lahir || '2019-01-01',
            anak_ke: r.anak_ke || '1',
            tinggi_badan: r.tinggi_badan || String(110 + (i % 15)),
            berat_badan: r.berat_badan || String(19 + (i % 10)),
            hobi: r.hobi || (i % 2 === 0 ? 'Membaca & Menggambar' : 'Bermain Sepakbola'),
            cita_cita: r.cita_cita || (i % 2 === 0 ? 'Dokter' : 'Insinyur'),
            no_hp_siswa: r.no_hp_siswa || '',
            email_siswa: r.email_siswa || '',
            sekolah_asal: r.sekolah_asal || 'TK Pertiwi Salatiga',
            tahun_lulus: r.tahun_lulus || '2026',
            tanggal_daftar: r.tanggal_daftar || '2026-01-15 08:00:00',
            no_kk: r.no_kk || '',
            nama_ayah: r.nama_ayah || '',
            nik_ayah: r.nik_ayah || '',
            pekerjaan_ayah: r.pekerjaan_ayah || 'Karyawan Swasta',
            penghasilan_ayah: incomeAyah,
            pendidikan_ayah: r.pendidikan_ayah || 'S1',
            nama_ibu: r.nama_ibu || '',
            nik_ibu: r.nik_ibu || '',
            pekerjaan_ibu: r.pekerjaan_ibu || 'Ibu Rumah Tangga',
            penghasilan_ibu: incomeIbu,
            pendidikan_ibu: r.pendidikan_ibu || 'SMA',
            no_hp_orang_tua: r.no_hp_orang_tua || r.no_hp_ayah || r.no_hp_ibu || r.no_hp_wali || '081234567890',
            penerima_pip: r.penerima_pip || isPip,
            keterangan_penghasilan_ayah: r.keterangan_penghasilan_ayah || (incomeAyah === 'Di atas Rp5.000.000' ? 'Penghasilan usaha toko retail' : (incomeAyah === 'Di bawah Rp500.000' ? 'Bekerja serabutan harian' : '')),
            keterangan_penghasilan_ibu: r.keterangan_penghasilan_ibu || (incomeIbu === 'Di atas Rp5.000.000' ? 'Dokter spesialis klinik mandiri' : (incomeIbu === 'Di bawah Rp500.000' ? 'Mengurus rumah tangga' : '')),
            email_orang_tua: r.email_orang_tua || `ortu.${r.nama_lengkap.toLowerCase().replace(/[^a-z0-9]/g, '') || 'wali'}@gmail.com`,
            status_verifikasi: mapStatus(r.status_verifikasi || r.status),
            catatan_verifikasi: r.catatan_verifikasi || 'Data awal telah tersinkronisasi.'
        };
    });

    const newCSV = '\uFEFF' + toCSV(STUDENT_CSV_HEADERS, migratedRows, false);
    fs.writeFileSync(DATA_FILE, newCSV, 'utf8');
    console.log(`✅ Berhasil memigrasi ${migratedRows.length} baris ke format 34 kolom!`);
}

runMigration();
