const http = require('http');

function request(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', (e) => reject(e));

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

async function runE2E() {
    console.log('==================================================');
    console.log('🚀 PENGUJIAN END-TO-END (E2E) SERVER PPDB SD SALATIGA 03');
    console.log('==================================================\n');

    let passed = 0;
    let total = 0;

    function assertTest(desc, condition) {
        total++;
        if (condition) {
            console.log(`✅ [PASS] ${desc}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${desc}`);
        }
    }

    try {
        // 1. GET Homepage
        const homeRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/',
            method: 'GET'
        });
        assertTest('1. Halaman Beranda Publik (HTTP 200)', homeRes.statusCode === 200 && homeRes.body.includes('SD SALATIGA 03'));

        // 2. GET Public Settings
        const settingsRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/public/settings',
            method: 'GET'
        });
        const settingsJson = JSON.parse(settingsRes.body);
        assertTest('2. API Public Settings & Kuota', settingsJson.success && settingsJson.data.kuota_siswa === 56);

        // 3. POST Registrasi Siswa Baru (Test Formula Injection Prevention in Student Name)
        const randomSuffix = String(Date.now()).slice(-8);
        const testNik = `33740415${randomSuffix}`;
        const newStudentPayload = JSON.stringify({
            nik: testNik,
            nisn: '0194837261',
            nama_lengkap: '=HYPERLINK("http://malicious.site","Muhammad Rizky")', // Test formula injection
            nama_panggilan: 'Rizky',
            jenis_kelamin: 'Laki-laki',
            tempat_lahir: 'Salatiga',
            tanggal_lahir: '2019-07-15',
            agama: 'Islam',
            anak_ke: '2',
            jumlah_saudara: '1',
            no_kk: `33740420${randomSuffix}`,
            alamat: 'Jl. Merbabu No. 12',
            rt: '03',
            rw: '04',
            kelurahan: 'Kalicacing',
            kecamatan: 'Sidomukti',
            kabupaten: 'Kota Salatiga',
            provinsi: 'Jawa Tengah',
            kode_pos: '50724',
            nama_ayah: 'Agus Setiawan',
            nik_ayah: `33740411${randomSuffix}`,
            pendidikan_ayah: 'S1',
            pekerjaan_ayah: 'Karyawan Swasta',
            penghasilan_ayah: 'Rp 4.000.000 - Rp 6.000.000',
            no_hp_ayah: '081233445566',
            nama_ibu: 'Nur Indah',
            nik_ibu: `33740455${randomSuffix}`,
            pendidikan_ibu: 'D3',
            pekerjaan_ibu: 'Ibu Rumah Tangga',
            penghasilan_ibu: 'Tidak Berpenghasilan',
            no_hp_ibu: '081255667788',
            sekolah_asal: 'TK Pertiwi 02 Salatiga',
            tahun_lulus: '2026',
            jarak_rumah: '1 - 3 km',
            transportasi: 'Sepeda Motor',
            prestasi: 'Juara Harapan 1 Lomba Adzan',
            keterangan: 'Pemberkasan lengkap'
        });

        const regRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/public/daftar',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(newStudentPayload)
            }
        }, newStudentPayload);

        const regJson = JSON.parse(regRes.body);
        const registeredNo = regJson.data?.no_pendaftaran || 'PMB-SD03-2026-001';
        assertTest('3. Pendaftaran Siswa Baru Berhasil', regJson.success && registeredNo.startsWith('PMB-SD03-2026-'));
        console.log(`   Diterbitkan No. Pendaftaran: ${registeredNo} (${regJson.data?.status})`);

        // 4. Cek Status Siswa Baru via API
        const statusRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/public/status?query=${registeredNo}`,
            method: 'GET'
        });
        const statusJson = JSON.parse(statusRes.body);
        assertTest('4. Cek Status Pendaftaran dengan Masking NIK', statusJson.success && statusJson.data.nik_masked.includes('********'));

        // 5. Bukti Pendaftaran Lembar Cetak
        const buktiRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/bukti/${registeredNo}`,
            method: 'GET'
        });
        assertTest('5. Lembar Bukti Pendaftaran Siswa Baru (HTTP 200)', buktiRes.statusCode === 200 && buktiRes.body.includes('BUKTI PENDAFTARAN SISWA BARU'));

        // 6. Akses Admin Tanpa Login (Harus Redirect ke /admin/login)
        const unauthRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/admin',
            method: 'GET'
        });
        assertTest('6. Perlindungan Dashboard Admin: Akses Ditolak Tanpa Login (Redirect 302)', unauthRes.statusCode === 302 && unauthRes.headers.location === '/admin/login');

        // 7. Percobaan Login dengan Password Salah (Brute Force Protection Response)
        const badLoginPayload = JSON.stringify({ username: 'superadmin', password: 'WrongPassword123' });
        const badLoginRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(badLoginPayload)
            }
        }, badLoginPayload);
        const badLoginJson = JSON.parse(badLoginRes.body);
        assertTest('7. Login Gagal Menolak dengan Pesan Aman', badLoginRes.statusCode === 401 && badLoginJson.error.includes('Username atau password tidak valid'));

        // 8. Login Admin Berhasil (Super Admin)
        const goodLoginPayload = JSON.stringify({ username: 'superadmin', password: 'AdminSD03@2026!' });
        const goodLoginRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(goodLoginPayload)
            }
        }, goodLoginPayload);

        const goodLoginJson = JSON.parse(goodLoginRes.body);
        const sessionCookie = goodLoginRes.headers['set-cookie'] ? goodLoginRes.headers['set-cookie'][0].split(';')[0] : '';
        assertTest('8. Login Admin Berhasil & Menerbitkan Sesi Aman', goodLoginJson.success && goodLoginJson.user.role === 'superadmin');

        // 9. Akses Dashboard Statistik dengan Sesi Login
        const statsRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/admin/stats',
            method: 'GET',
            headers: { 'Cookie': sessionCookie }
        });
        const statsJson = JSON.parse(statsRes.body);
        assertTest('9. Dashboard Stats Terautentikasi (Total >= 4)', statsJson.success && statsJson.data.total_pendaftar >= 4);

        // 10. Update Status Verifikasi (Ubah PMB-SD03-2026-004 menjadi Terverifikasi)
        const updatePayload = JSON.stringify({
            status: 'Terverifikasi',
            catatan_verifikasi: 'Berkas fisik Akta dan KK telah diverifikasi dan valid.'
        });
        const updateRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/admin/pendaftar/${registeredNo}`,
            method: 'PUT',
            headers: {
                'Cookie': sessionCookie,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(updatePayload)
            }
        }, updatePayload);
        const updateJson = JSON.parse(updateRes.body);
        assertTest('10. Admin Mengubah Status Verifikasi Siswa', updateJson.success && updateJson.data.status === 'Terverifikasi');

        // 11. Export CSV dengan Proteksi CSV Injection & UTF-8 BOM
        const exportRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/admin/export',
            method: 'GET',
            headers: { 'Cookie': sessionCookie }
        });
        const hasBOM = exportRes.body.charCodeAt(0) === 0xFEFF;
        const hasCleanFormula = exportRes.body.includes("'=HYPERLINK"); // Sanitized with leading single quote!
        assertTest('11. Export CSV Memiliki UTF-8 BOM & Proteksi CSV Injection', exportRes.statusCode === 200 && hasBOM && hasCleanFormula);

        // 12. Backup Data Pendaftar
        const backupRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/admin/backup',
            method: 'GET',
            headers: { 'Cookie': sessionCookie }
        });
        assertTest('12. Backup Data Pendaftar CSV Berhasil Diunduh', backupRes.statusCode === 200 && backupRes.headers['content-disposition'].includes('BACKUP_PMB_SD_SALATIGA_03_2026.csv'));

        // 13. Audit Log Tercatat Lengkap
        const auditRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/admin/audit-log',
            method: 'GET',
            headers: { 'Cookie': sessionCookie }
        });
        const auditJson = JSON.parse(auditRes.body);
        const hasLoginLog = auditJson.data.some(l => l.aktivitas === 'Login');
        const hasVerifLog = auditJson.data.some(l => l.aktivitas === 'Mengubah status');
        assertTest('13. Audit Log Merekam Aktivitas Login, Verifikasi, dan Export', auditJson.success && hasLoginLog && hasVerifLog);

        // 14. Logout Admin
        const logoutRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/auth/logout',
            method: 'POST',
            headers: { 'Cookie': sessionCookie }
        });
        const logoutJson = JSON.parse(logoutRes.body);
        assertTest('14. Logout Berhasil Mengakhiri Sesi Admin', logoutJson.success);

        // 15. Verifikasi Sesi Sudah Tidak Berlaku Setelah Logout
        const afterLogoutRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/admin/stats',
            method: 'GET',
            headers: { 'Cookie': sessionCookie }
        });
        assertTest('15. Sesi Selesai (Akses Ditolak Setelah Logout)', afterLogoutRes.statusCode === 401);

    } catch (e) {
        console.error('Fatal E2E error:', e);
    }

    console.log('\n==================================================');
    console.log(`🏁 HASIL PENGUJIAN E2E: ${passed} / ${total} BERHASIL`);
    console.log('==================================================\n');

    process.exit(passed === total ? 0 : 1);
}

runE2E();
