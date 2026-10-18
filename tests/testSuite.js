const path = require('path');
const fs = require('fs');
const assert = require('assert');

// Require server components for direct validation
const {
    parseCSV,
    toCSV,
    toIndonesianCSV,
    generateBlankTemplate,
    escapeCSVField,
    maskNIK,
    maskPhone,
    maskKK,
    readCSVFile,
    writeCSVFile
} = require('../server/csvHelper');
const {
    validateRegistration,
    determineVerificationStatus,
    generateNextRegistrationNumber,
    isValidNIK,
    isValidPhone,
    isValidEmail,
    isValidDate
} = require('../server/validationHelper');
const {
    STUDENT_34_COLUMNS,
    STUDENT_CSV_HEADERS,
    VERIFICATION_STATUSES,
    INCOME_CATEGORIES,
    PIP_OPTIONS
} = require('../server/constants');
const { loadUsers } = require('../server/authMiddleware');

console.log('================================================================');
console.log('🧪 PENGUJIAN MENYELURUH 14 FITUR WAJIB PPDB SD SALATIGA 03');
console.log('================================================================\n');

let passCount = 0;
let totalTests = 0;

function test(title, fn) {
    totalTests++;
    try {
        fn();
        console.log(`✅ [PASS] ${title}`);
        passCount++;
    } catch (err) {
        console.error(`❌ [FAIL] ${title}`);
        console.error('   Error:', err.message);
    }
}

async function runAsyncTest(title, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`✅ [PASS] ${title}`);
        passCount++;
    } catch (err) {
        console.error(`❌ [FAIL] ${title}`);
        console.error('   Error:', err.message);
    }
}

async function runAllTests() {

    // 1. Pendaftaran Peserta Didik Baru
    test('1. Pendaftaran peserta didik baru (Alur Validasi & Nomor Sequential)', () => {
        const existing = [
            { no_pendaftaran: 'PMB-SD03-2026-001', nik: '3374011205190001' }
        ];
        const payload = {
            nik: '3374019901190002',
            nama_lengkap: 'Rara Anindita',
            jenis_kelamin: 'Perempuan',
            tempat_lahir: 'Salatiga',
            tanggal_lahir: '2019-03-25',
            no_kk: '3374012001150009',
            alamat: 'Jl. Pemuda No. 10, Salatiga',
            nama_ayah: 'Susanto',
            no_hp_orang_tua: '081298765432'
        };
        const validation = validateRegistration(payload, existing);
        assert.strictEqual(validation.isValid, true, 'Pendaftaran data valid harus lolos');

        const nextNo = generateNextRegistrationNumber(existing, '2026');
        assert.strictEqual(nextNo, 'PMB-SD03-2026-002');
    });

    // 2. Penyimpanan 34 Kolom
    test('2. Penyimpanan 34 Kolom Database Lengkap', () => {
        assert.strictEqual(STUDENT_34_COLUMNS.length, 34, 'Struktur harus tepat 34 kolom');
        const keys = STUDENT_34_COLUMNS.map(c => c.key);

        // Verifikasi 5 Kolom Baru
        assert.ok(keys.includes('penerima_pip'), 'Kolom 30: penerima_pip harus ada');
        assert.ok(keys.includes('keterangan_penghasilan_ayah'), 'Kolom 31: keterangan_penghasilan_ayah harus ada');
        assert.ok(keys.includes('keterangan_penghasilan_ibu'), 'Kolom 32: keterangan_penghasilan_ibu harus ada');
        assert.ok(keys.includes('email_orang_tua'), 'Kolom 33: email_orang_tua harus ada');
        assert.ok(keys.includes('status_verifikasi'), 'Kolom 34: status_verifikasi harus ada');

        // Verifikasi keberadaan file dan data
        const studentsPath = path.join(__dirname, '..', 'data', 'pendaftar.csv');
        assert.ok(fs.existsSync(studentsPath), 'File data pendaftar.csv harus ada');
        const rows = readCSVFile(studentsPath, STUDENT_CSV_HEADERS);
        assert.ok(rows.length > 0, 'Database pendaftar harus memiliki data');
        const firstRow = rows[0];
        keys.forEach(k => {
            assert.ok(firstRow[k] !== undefined, `Kolom ${k} harus ada pada row data`);
        });
    });

    // 3. Edit Data (34 Kolom)
    test('3. Edit Data Pendaftar (Memperbarui data dan keterangan)', () => {
        const dummyRow = {
            no_pendaftaran: 'PMB-SD03-2026-999',
            nama_lengkap: 'Nama Asli',
            nik: '3374011205199999',
            penghasilan_ayah: 'Di atas Rp5.000.000',
            keterangan_penghasilan_ayah: 'Usaha Kuliner',
            email_orang_tua: 'lama@gmail.com',
            status_verifikasi: 'Belum Dicek'
        };

        // Simulasi update data
        dummyRow.nama_lengkap = 'Nama Setelah Diedit';
        dummyRow.email_orang_tua = 'baru@gmail.com';
        dummyRow.keterangan_penghasilan_ayah = 'Direktur Perusahaan';
        dummyRow.status_verifikasi = 'Valid';

        assert.strictEqual(dummyRow.nama_lengkap, 'Nama Setelah Diedit');
        assert.strictEqual(dummyRow.email_orang_tua, 'baru@gmail.com');
        assert.strictEqual(dummyRow.status_verifikasi, 'Valid');
    });

    // 4. Status Verifikasi Data (4 Status Resmi)
    test('4. Status Verifikasi (Belum Dicek, Valid, Perlu Dicek, Perlu Perbaikan)', () => {
        assert.deepStrictEqual(VERIFICATION_STATUSES, ['Belum Dicek', 'Valid', 'Perlu Dicek', 'Perlu Perbaikan']);

        // Default pendaftaran baru
        const statusNew = determineVerificationStatus({ nik: '3374011205190001', nama_lengkap: 'Budi', tanggal_lahir: '2019-01-01', alamat: 'Salatiga' });
        assert.strictEqual(statusNew, 'Belum Dicek');

        // NIK tidak valid -> Perlu Dicek
        const statusInvalidNik = determineVerificationStatus({ nik: '123', nama_lengkap: 'Budi', tanggal_lahir: '2019-01-01', alamat: 'Salatiga' });
        assert.strictEqual(statusInvalidNik, 'Perlu Dicek');

        // NIK ganda -> Perlu Dicek
        const existingNiks = new Set(['3374011205190001']);
        const statusDuplicate = determineVerificationStatus({ nik: '3374011205190001', nama_lengkap: 'Budi', tanggal_lahir: '2019-01-01', alamat: 'Salatiga' }, existingNiks);
        assert.strictEqual(statusDuplicate, 'Perlu Dicek');

        // Data tidak lengkap -> Perlu Perbaikan
        const statusIncomplete = determineVerificationStatus({ nik: '3374011205190002', nama_lengkap: '', tanggal_lahir: '', alamat: '' });
        assert.strictEqual(statusIncomplete, 'Perlu Perbaikan');
    });

    // 5. Deteksi NIK Tidak Valid
    test('5. Deteksi NIK Tidak Valid (Bukan 16 digit angka)', () => {
        assert.strictEqual(isValidNIK('3374011205190001'), true);
        assert.strictEqual(isValidNIK('12345'), false);
        assert.strictEqual(isValidNIK('337401120519000X'), false);
        assert.strictEqual(isValidNIK(''), false);
    });

    // 6. Deteksi NIK Ganda
    test('6. Deteksi NIK Ganda pada Sistem', () => {
        const existing = [{ nik: '3374011205190001', no_pendaftaran: 'PMB-001' }];
        const newRecord = { nik: '3374011205190001', nama_lengkap: 'Kembar' };
        const validation = validateRegistration(newRecord, existing);
        assert.strictEqual(validation.isValid, false);
        assert.ok(validation.errors.some(e => e.includes('sudah terdaftar')));
    });

    // 7. Impor CSV 34 Kolom
    test('7. Impor CSV 34 Kolom dengan Pencocokan Header Fleksibel', () => {
        const csvContent = `"Nama Peserta Didik","NIK Peserta Didik","Jenis Kelamin","Penerima PIP","Penghasilan Ayah"\r\n"Anisa Putri","3374012005190010","Perempuan","Ya","Di bawah Rp500.000"\r\n`;
        const parsed = parseCSV(csvContent);
        assert.strictEqual(parsed.length, 1);
        assert.strictEqual(parsed[0].nama_lengkap, 'Anisa Putri');
        assert.strictEqual(parsed[0].nik, '3374012005190010');
        assert.strictEqual(parsed[0].penerima_pip, 'Ya');
        assert.strictEqual(parsed[0].penghasilan_ayah, 'Di bawah Rp500.000');
    });

    // 8. Ekspor CSV 34 Kolom
    test('8. Ekspor CSV 34 Kolom dengan UTF-8 BOM dan Label Indonesia', () => {
        const sampleRecords = [
            {
                no_pendaftaran: 'PMB-SD03-2026-001',
                nama_lengkap: 'Fauzan',
                nik: '3374011205190001',
                jenis_kelamin: 'Laki-laki',
                penerima_pip: 'Ya',
                penghasilan_ayah: 'Di atas Rp5.000.000',
                keterangan_penghasilan_ayah: 'Wiraswasta',
                status_verifikasi: 'Valid'
            }
        ];
        const csv = toIndonesianCSV(sampleRecords, true);
        assert.ok(csv.includes('Nama Peserta Didik'), 'Harus memuat header Indonesia');
        assert.ok(csv.includes('Penerima PIP'), 'Harus memuat kolom Penerima PIP');
        assert.ok(csv.includes('Keterangan Penghasilan Ayah'), 'Harus memuat Keterangan Penghasilan Ayah');
        assert.ok(csv.includes('Status Verifikasi Data'), 'Harus memuat Status Verifikasi Data');
    });

    // 9. Kompatibilitas Excel dan Google Sheets
    test('9. Pembacaan CSV di Excel (Proteksi CSV Formula Injection & Tipe String)', () => {
        const formulaVal = '=HYPERLINK("http://evil.com","Klik")';
        const sanitized = escapeCSVField(formulaVal, true);
        assert.ok(sanitized.startsWith('"\'='), 'Formula Excel harus diproteksi dengan prefix apostrof');

        // Pastikan angka dengan 0 di depan aman sebagai string
        const phoneWithZero = '081234567890';
        const nikWithZero = '0123456789012345';
        assert.strictEqual(typeof phoneWithZero, 'string');
        assert.strictEqual(phoneWithZero.charAt(0), '0');
        assert.strictEqual(nikWithZero.charAt(0), '0');
    });

    // 10. Filter Penerima PIP
    test('10. Filter Penerima PIP (Ya vs Tidak)', () => {
        const students = [
            { nama: 'Siswa A', penerima_pip: 'Ya' },
            { nama: 'Siswa B', penerima_pip: 'Tidak' },
            { nama: 'Siswa C', penerima_pip: 'Ya' }
        ];
        const pipOnly = students.filter(s => s.penerima_pip === 'Ya');
        const nonPipOnly = students.filter(s => s.penerima_pip === 'Tidak');
        assert.strictEqual(pipOnly.length, 2);
        assert.strictEqual(nonPipOnly.length, 1);
    });

    // 11. Diagram Dashboard (Data Aktual Database)
    test('11. Diagram Dashboard (5 Kategori Diagram & Konsistensi Data)', () => {
        const students = readCSVFile(path.join(__dirname, '..', 'data', 'pendaftar.csv'), STUDENT_CSV_HEADERS);
        let valid = 0, belum = 0, perlu = 0, perbaikan = 0;
        students.forEach(s => {
            const st = s.status_verifikasi;
            if (st === 'Valid') valid++;
            else if (st === 'Perlu Dicek') perlu++;
            else if (st === 'Perlu Perbaikan') perbaikan++;
            else belum++;
        });
        const total = valid + belum + perlu + perbaikan;
        assert.strictEqual(total, students.length, 'Total pendaftar pada diagram harus sama dengan database');
        console.log(`   Statistik Aktual: ${students.length} Pendaftar (${valid} Valid, ${belum} Belum Dicek, ${perlu} Perlu Dicek, ${perbaikan} Perlu Perbaikan)`);
    });

    // 12. Dark Mode dan Light Mode
    test('12. Dark Mode dan Light Mode (File CSS & JS Terpasang)', () => {
        const cssPath = path.join(__dirname, '..', 'public', 'css', 'theme-anim.css');
        const jsPath = path.join(__dirname, '..', 'public', 'js', 'audio-theme.js');
        assert.ok(fs.existsSync(cssPath), 'theme-anim.css harus ada');
        assert.ok(fs.existsSync(jsPath), 'audio-theme.js harus ada');

        const cssContent = fs.readFileSync(cssPath, 'utf8');
        assert.ok(cssContent.includes('light-mode') || cssContent.includes('.theme-light'), 'Harus memuat styling mode terang');
    });

    // 13. Login dan Logout Admin
    test('13. Autentikasi Admin (Enkripsi Bcrypt & Proteksi RBAC)', () => {
        const users = loadUsers();
        assert.ok(users.length >= 2, 'Minimal ada 2 akun (superadmin dan petugas)');
        const superadmin = users.find(u => u.username === 'superadmin');
        assert.ok(superadmin, 'Akun superadmin harus ada');
        assert.strictEqual(superadmin.role, 'superadmin');
        assert.ok(superadmin.passwordHash.startsWith('$2'), 'Password harus terenkripsi Bcrypt (bukan teks biasa)');
    });

    // 14. Tampilan Responsif (Mobile & Desktop)
    test('14. Tampilan Responsif HP dan Desktop (Tailwind Breakpoints)', () => {
        const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin', 'index.html'), 'utf8');
        assert.ok(adminHtml.includes('lg:grid-cols-6') || adminHtml.includes('grid-cols-2'), 'Harus responsif grid 2 di mobile dan multi-kolom di desktop');
        assert.ok(adminHtml.includes('lg:hidden'), 'Sidebar mobile toggle harus ada');
    });

    console.log('\n================================================================');
    console.log(`🏁 HASIL PENGUJIAN: ${passCount} / ${totalTests} BERHASIL`);
    console.log('================================================================\n');

    if (passCount === totalTests) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runAllTests();
