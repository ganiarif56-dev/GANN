const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const {
    STUDENT_34_COLUMNS,
    STUDENT_CSV_HEADERS,
    AUDIT_LOG_HEADERS,
    VERIFICATION_STATUSES,
    VALID_STATUSES,
    INCOME_CATEGORIES,
    PIP_OPTIONS
} = require('./constants');
const {
    readCSVFile,
    writeCSVFile,
    parseCSV,
    toCSV,
    toIndonesianCSV,
    generateBlankTemplate,
    maskNIK,
    maskPhone,
    maskKK
} = require('./csvHelper');
const {
    validateRegistration,
    determineVerificationStatus,
    generateNextRegistrationNumber,
    isValidNIK,
    isValidPhone,
    isValidEmail,
    isValidDate
} = require('./validationHelper');
const {
    createSession,
    destroySession,
    getSession,
    checkBruteForce,
    recordFailedLogin,
    clearFailedLogin,
    requireAuth,
    requireSuperAdmin,
    loadUsers,
    saveUsers,
    SESSION_IDLE_TIMEOUT_MS
} = require('./authMiddleware');
const { logAudit, getAuditLogs } = require('./auditHelper');
const {
    initFirestore,
    isFirestoreReady,
    saveStudentToFirestore,
    updateStudentInFirestore,
    deleteStudentFromFirestore,
    batchSyncStudentsToFirestore,
    saveSettingsToFirestore,
    getFirestoreStatus
} = require('./firestoreHelper');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Firestore (if key is present)
initFirestore();

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const STUDENTS_FILE = path.join(DATA_DIR, 'pendaftar.csv');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data initialized
require('../initData');

// Middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// Trust proxy for IP logging
app.set('trust proxy', 1);

// Protect /admin routes before static middleware so admin pages are never accessible without authentication
app.use((req, res, next) => {
    if (req.path === '/admin/login' || req.path === '/admin/login.html') {
        const sessionId = req.cookies?.ppdb_session;
        if (sessionId && getSession(sessionId)) {
            return res.redirect('/admin');
        }
        return next();
    }
    if (req.path === '/admin' || req.path.startsWith('/admin/')) {
        return requireAuth(req, res, next);
    }
    next();
});

// Static files (public)
app.use(express.static(PUBLIC_DIR, { index: false }));

// Configure Multer for CSV uploads in memory
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv') || file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        } else {
            cb(new Error('Hanya file berformat CSV (.csv) yang diperbolehkan!'));
        }
    }
});

// Rate limiting for public endpoints
const publicSubmitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 150, // Max 150 registrations per 15 minutes per IP (supports school Wi-Fi concurrent usage)
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Terlalu banyak permintaan pendaftaran dari jaringan Anda. Silakan coba beberapa saat lagi.' }
});

const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { success: false, error: 'Terlalu banyak percobaan login. Silakan tunggu 15 menit.' }
});

function getClientIp(req) {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
}

function getSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading settings:', e);
    }
    return {
        nama_sekolah: 'SD SALATIGA 03',
        slogan: 'Cerdas • Berkarakter • Berprestasi',
        tahun_ajaran: '2026/2027',
        status_pendaftaran: 'buka',
        kuota_siswa: 56,
        kuota_rombel: 2
    };
}

// Google Sheets Integration (Google Apps Script Web App Forwarder)
async function syncToGoogleSheets(data, action = 'INSERT') {
    try {
        const settings = getSettings();
        const gasUrl = settings.google_apps_script_url;
        if (!gasUrl || !gasUrl.startsWith('https://script.google.com/')) {
            return; // Not configured yet, silently skip
        }

        const payload = action === 'BATCH_SYNC'
            ? { action: 'BATCH_SYNC', students: data }
            : { action: action, data: data };

        fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            redirect: 'follow'
        }).then(r => r.json()).then(res => {
            console.log(`[Google Sheets] ${action} success:`, res.message || res);
        }).catch(err => {
            console.error('[Google Sheets] Sync network note:', err.message);
        });
    } catch (e) {
        console.error('[Google Sheets] Error:', e.message);
    }
}

// ==========================================
// 1. PUBLIC API ROUTES
// ==========================================

// Get public settings info
app.get('/api/public/settings', (req, res) => {
    const settings = getSettings();
    const students = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);
    const validCount = students.filter(s => s.status_verifikasi === 'Valid' || s.status === 'Diterima' || s.status === 'Terverifikasi').length;
    res.json({
        success: true,
        data: {
            ...settings,
            total_terdaftar: students.length,
            total_diterima: validCount,
            sisa_kuota: Math.max(0, (settings.kuota_siswa || 56) - validCount)
        }
    });
});

// Submit registration (34 Columns)
app.post('/api/public/daftar', publicSubmitLimiter, async (req, res) => {
    try {
        const settings = getSettings();
        if (settings.status_pendaftaran === 'tutup') {
            return res.status(400).json({
                success: false,
                error: 'Pendaftaran Siswa Baru SD SALATIGA 03 saat ini sedang ditutup.'
            });
        }

        const payload = req.body;
        const students = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);

        // Validation
        const validation = validateRegistration(payload, students);
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                errors: validation.errors,
                error: validation.errors[0]
            });
        }

        // Generate automatic unique sequential registration number
        const nextNo = generateNextRegistrationNumber(students, '2026');
        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

        // Build 34 Column Object
        const newStudent = {
            no_pendaftaran: nextNo,
            nama_lengkap: String(payload.nama_lengkap || '').trim(),
            nik: String(payload.nik || '').trim(),
            jenis_kelamin: payload.jenis_kelamin || 'Laki-laki',
            nisn: payload.nisn ? String(payload.nisn).trim() : '',
            alamat: String(payload.alamat || '').trim(),
            tempat_lahir: String(payload.tempat_lahir || '').trim(),
            tanggal_lahir: payload.tanggal_lahir || '',
            anak_ke: payload.anak_ke || '1',
            tinggi_badan: payload.tinggi_badan ? String(payload.tinggi_badan).trim() : '',
            berat_badan: payload.berat_badan ? String(payload.berat_badan).trim() : '',
            hobi: payload.hobi ? String(payload.hobi).trim() : '',
            cita_cita: payload.cita_cita ? String(payload.cita_cita).trim() : '',
            no_hp_siswa: payload.no_hp_siswa ? String(payload.no_hp_siswa).trim() : '',
            email_siswa: payload.email_siswa ? String(payload.email_siswa).trim() : '',
            sekolah_asal: payload.sekolah_asal ? String(payload.sekolah_asal).trim() : '',
            tahun_lulus: payload.tahun_lulus || '2026',
            tanggal_daftar: nowStr,
            no_kk: String(payload.no_kk || '').trim(),
            nama_ayah: payload.nama_ayah ? String(payload.nama_ayah).trim() : '',
            nik_ayah: payload.nik_ayah ? String(payload.nik_ayah).trim() : '',
            pekerjaan_ayah: payload.pekerjaan_ayah || '',
            penghasilan_ayah: payload.penghasilan_ayah || '',
            pendidikan_ayah: payload.pendidikan_ayah || '',
            nama_ibu: payload.nama_ibu ? String(payload.nama_ibu).trim() : '',
            nik_ibu: payload.nik_ibu ? String(payload.nik_ibu).trim() : '',
            pekerjaan_ibu: payload.pekerjaan_ibu || '',
            penghasilan_ibu: payload.penghasilan_ibu || '',
            pendidikan_ibu: payload.pendidikan_ibu || '',
            no_hp_orang_tua: payload.no_hp_orang_tua ? String(payload.no_hp_orang_tua).trim() : (payload.no_hp_ayah || payload.no_hp_ibu || ''),
            penerima_pip: payload.penerima_pip === 'Ya' ? 'Ya' : 'Tidak',
            keterangan_penghasilan_ayah: payload.keterangan_penghasilan_ayah ? String(payload.keterangan_penghasilan_ayah).trim() : '',
            keterangan_penghasilan_ibu: payload.keterangan_penghasilan_ibu ? String(payload.keterangan_penghasilan_ibu).trim() : '',
            email_orang_tua: payload.email_orang_tua ? String(payload.email_orang_tua).trim() : '',
            status_verifikasi: 'Belum Dicek', // Pendaftaran baru default 'Belum Dicek'
            catatan_verifikasi: 'Pendaftaran berhasil dikirim. Menunggu pemeriksaan verifikasi oleh panitia PPDB.'
        };

        students.push(newStudent);
        await writeCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS, students);

        // Forward otomatis ke Google Sheets & Firebase Firestore di latar belakang
        syncToGoogleSheets(newStudent, 'INSERT');
        saveStudentToFirestore(newStudent);

        // Audit log
        await logAudit('public', 'Pendaftaran Baru', `Pendaftar baru: ${nextNo} (${newStudent.nama_lengkap})`, getClientIp(req));

        res.json({
            success: true,
            data: {
                no_pendaftaran: nextNo,
                nama_lengkap: newStudent.nama_lengkap,
                nik_masked: maskNIK(newStudent.nik),
                status_verifikasi: newStudent.status_verifikasi,
                tanggal_daftar: newStudent.tanggal_daftar,
                catatan_verifikasi: newStudent.catatan_verifikasi
            }
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem saat memproses pendaftaran.' });
    }
});

// Check status by No Pendaftaran or NIK (supports both path param and query string)
app.get(['/api/public/status', '/api/public/status/:query'], (req, res) => {
    try {
        const query = (req.params.query || req.query.query || req.query.no_pendaftaran || req.query.nik || req.query.keyword || '').trim().toUpperCase();
        if (!query) {
            return res.status(400).json({ success: false, error: 'Silakan masukkan Nomor Pendaftaran atau NIK.' });
        }
        const students = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);

        const match = students.find(s =>
            (s.no_pendaftaran && s.no_pendaftaran.toUpperCase() === query) ||
            (s.nik && s.nik === query)
        );

        if (!match) {
            return res.status(404).json({
                success: false,
                error: 'Data pendaftaran tidak ditemukan. Pastikan Nomor Pendaftaran atau NIK sudah benar.'
            });
        }

        res.json({
            success: true,
            data: {
                no_pendaftaran: match.no_pendaftaran,
                nama_lengkap: match.nama_lengkap,
                nik_masked: maskNIK(match.nik),
                jenis_kelamin: match.jenis_kelamin,
                sekolah_asal: match.sekolah_asal,
                status_verifikasi: match.status_verifikasi || 'Belum Dicek',
                tanggal_daftar: match.tanggal_daftar,
                catatan_verifikasi: match.catatan_verifikasi,
                penerima_pip: match.penerima_pip || 'Tidak'
            }
        });
    } catch (err) {
        console.error('Status check error:', err);
        res.status(500).json({ success: false, error: 'Terjadi kesalahan saat memeriksa status.' });
    }
});

// Get registration proof data for printable receipt & QR code
app.get('/api/public/bukti/:no_pendaftaran', (req, res) => {
    try {
        const noPendaftaran = req.params.no_pendaftaran.trim().toUpperCase();
        const students = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);
        const match = students.find(s => s.no_pendaftaran && s.no_pendaftaran.toUpperCase() === noPendaftaran);

        if (!match) {
            return res.status(404).json({ success: false, error: 'Data pendaftaran tidak ditemukan.' });
        }

        res.json({
            success: true,
            data: {
                no_pendaftaran: match.no_pendaftaran,
                nama_lengkap: match.nama_lengkap,
                nik_masked: maskNIK(match.nik),
                jenis_kelamin: match.jenis_kelamin,
                tempat_tanggal_lahir: `${match.tempat_lahir || '-'}, ${match.tanggal_lahir || '-'}`,
                alamat: match.alamat,
                kelurahan: '',
                kecamatan: '',
                sekolah_asal: match.sekolah_asal,
                nama_ayah: match.nama_ayah,
                nama_ibu: match.nama_ibu,
                no_hp_masked: maskPhone(match.no_hp_orang_tua),
                status: match.status_verifikasi || 'Belum Dicek',
                status_verifikasi: match.status_verifikasi || 'Belum Dicek',
                penerima_pip: match.penerima_pip || 'Tidak',
                tanggal_daftar: match.tanggal_daftar,
                catatan_verifikasi: match.catatan_verifikasi
            }
        });
    } catch (err) {
        console.error('Bukti API error:', err);
        res.status(500).json({ success: false, error: 'Terjadi kesalahan saat memuat data bukti pendaftaran.' });
    }
});

// Public Homepage Aggregated Statistics (Actual live counts, zero PII)
app.get('/api/public/stats', (req, res) => {
    try {
        const students = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);
        let validCount = 0;
        let belumDicekCount = 0;
        let perluDicekCount = 0;
        let perluPerbaikanCount = 0;
        let pipCount = 0;

        students.forEach(s => {
            const st = s.status_verifikasi || 'Belum Dicek';
            if (st === 'Valid') validCount++;
            else if (st === 'Perlu Dicek') perluDicekCount++;
            else if (st === 'Perlu Perbaikan') perluPerbaikanCount++;
            else belumDicekCount++;

            if (s.penerima_pip === 'Ya') pipCount++;
        });

        res.json({
            success: true,
            data: {
                total_pendaftar: students.length,
                data_valid: validCount,
                belum_dicek: belumDicekCount,
                perlu_dicek: perluDicekCount,
                perlu_perbaikan: perluPerbaikanCount,
                penerima_pip: pipCount
            }
        });
    } catch (err) {
        console.error('Public stats error:', err);
        res.status(500).json({ success: false, error: 'Terjadi kesalahan saat memuat data statistik.' });
    }
});

// ==========================================
// 2. ADMIN AUTHENTICATION ROUTES
// ==========================================

// Login
app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
    const { username, password } = req.body;
    const ip = getClientIp(req);

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username dan password wajib diisi.' });
    }

    const bruteCheck = checkBruteForce(username, ip);
    if (bruteCheck.blocked) {
        return res.status(429).json({
            success: false,
            error: `Terlalu banyak percobaan gagal. Akun dikunci sementara. Silakan coba lagi dalam ${bruteCheck.remainingMinutes} menit.`
        });
    }

    const users = loadUsers();
    const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());

    if (!user) {
        recordFailedLogin(username, ip);
        await logAudit(username, 'Login Gagal', 'Username tidak ditemukan', ip);
        return res.status(401).json({ success: false, error: 'Username atau password salah.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
        recordFailedLogin(username, ip);
        await logAudit(username, 'Login Gagal', 'Password salah', ip);
        return res.status(401).json({ success: false, error: 'Username atau password salah.' });
    }

    clearFailedLogin(username, ip);
    const sessionId = createSession(user);

    // Set secure cookie
    res.cookie('ppdb_session', sessionId, {
        httpOnly: true,
        secure: false, // Set to true if on HTTPS
        sameSite: 'lax',
        maxAge: SESSION_IDLE_TIMEOUT_MS
    });

    await logAudit(user.username, 'Login Berhasil', `Login sebagai ${user.role}`, ip);

    res.json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role
        }
    });
});

// Check auth status
app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    const sessionId = req.cookies?.ppdb_session;
    if (sessionId) {
        destroySession(sessionId);
    }
    res.clearCookie('ppdb_session');
    res.json({ success: true, message: 'Berhasil keluar.' });
});

// ==========================================
// 3. ADMIN DASHBOARD & CRUD ROUTES
// ==========================================

// Dashboard KPI Stats & Charts (Data Aktual 34 Kolom)
app.get('/api/admin/stats', requireAuth, (req, res) => {
    const students = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);
    const settings = getSettings();

    // Verification Status Counts
    let validCount = 0;
    let belumDicekCount = 0;
    let perluDicekCount = 0;
    let perluPerbaikanCount = 0;

    // Gender Counts
    let maleCount = 0;
    let femaleCount = 0;

    // PIP Counts
    let pipCount = 0;
    let nonPipCount = 0;

    // Income Category Counts
    const incomeCounts = {
        'Di bawah Rp500.000': 0,
        'Rp500.000–Rp1.000.000': 0,
        'Rp1.000.001–Rp2.000.000': 0,
        'Rp2.000.001–Rp5.000.000': 0,
        'Di atas Rp5.000.000': 0
    };

    students.forEach(s => {
        // Status Verifikasi
        const st = s.status_verifikasi || 'Belum Dicek';
        if (st === 'Valid') validCount++;
        else if (st === 'Belum Dicek') belumDicekCount++;
        else if (st === 'Perlu Dicek') perluDicekCount++;
        else if (st === 'Perlu Perbaikan') perluPerbaikanCount++;
        else belumDicekCount++;

        // Gender
        if (s.jenis_kelamin === 'Laki-laki') maleCount++;
        else if (s.jenis_kelamin === 'Perempuan') femaleCount++;

        // PIP
        if (s.penerima_pip === 'Ya') pipCount++;
        else nonPipCount++;

        // Income Ayah
        const inc = s.penghasilan_ayah;
        if (inc && incomeCounts[inc] !== undefined) {
            incomeCounts[inc]++;
        } else if (inc) {
            // Flexible match
            if (inc.includes('500.000') && !inc.includes('1.000.000')) incomeCounts['Di bawah Rp500.000']++;
            else if (inc.includes('1.000.000') && !inc.includes('2.000.000')) incomeCounts['Rp500.000–Rp1.000.000']++;
            else if (inc.includes('2.000.000')) incomeCounts['Rp1.000.001–Rp2.000.000']++;
            else if (inc.includes('5.000.000') && !inc.includes('atas')) incomeCounts['Rp2.000.001–Rp5.000.000']++;
            else if (inc.includes('atas') || inc.includes('7.000.000')) incomeCounts['Di atas Rp5.000.000']++;
            else incomeCounts['Rp1.000.001–Rp2.000.000']++;
        }
    });

    const quotaTotal = settings.kuota_siswa || 56;

    // Calculate weekly trend for last 6 weeks (M-5 to M-0)
    const now = new Date();
    const weeklyLabels = ['M-5', 'M-4', 'M-3', 'M-2', 'M-1', 'M-0'];
    const weeklyData = [0, 0, 0, 0, 0, 0];

    students.forEach(s => {
        if (s.tanggal_daftar) {
            const d = new Date(s.tanggal_daftar.replace(' ', 'T'));
            if (!isNaN(d.getTime())) {
                const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
                const weekIdx = 5 - Math.floor(diffDays / 7);
                if (weekIdx >= 0 && weekIdx <= 5) {
                    weeklyData[weekIdx]++;
                } else if (weekIdx < 0) {
                    weeklyData[0]++;
                }
            } else {
                weeklyData[5]++;
            }
        } else {
            weeklyData[5]++;
        }
    });

    res.json({
        success: true,
        data: {
            total_pendaftar: students.length,
            valid: validCount,
            belum_dicek: belumDicekCount,
            perlu_dicek: perluDicekCount,
            perlu_perbaikan: perluPerbaikanCount,
            penerima_pip: pipCount,
            bukan_penerima_pip: nonPipCount,
            gender: {
                laki_laki: maleCount,
                perempuan: femaleCount
            },
            kuota_total: quotaTotal,
            kuota_terisi: validCount,
            kuota_sisa: Math.max(0, quotaTotal - validCount),
            weekly_trend: {
                labels: weeklyLabels,
                data: weeklyData
            },
            status_verifikasi_chart: {
                labels: ['Belum Dicek', 'Valid', 'Perlu Dicek', 'Perlu Perbaikan'],
                data: [belumDicekCount, validCount, perluDicekCount, perluPerbaikanCount]
            },
            gender_chart: {
                labels: ['Laki-laki', 'Perempuan'],
                data: [maleCount, femaleCount]
            },
            pip_chart: {
                labels: ['Penerima PIP', 'Bukan Penerima PIP'],
                data: [pipCount, nonPipCount]
            },
            income_chart: {
                labels: INCOME_CATEGORIES,
                data: INCOME_CATEGORIES.map(cat => incomeCounts[cat] || 0)
            }
        }
    });
});

// List student applicants with filters & pagination
app.get('/api/admin/pendaftar', requireAuth, (req, res) => {
    const { search, status, pip, sort, page = 1, limit = 10 } = req.query;
    let students = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);

    // Filter by search (nama, NIK, NISN, no_pendaftaran, sekolah_asal)
    if (search && search.trim().length > 0) {
        const kw = search.trim().toLowerCase();
        students = students.filter(s =>
            (s.no_pendaftaran && s.no_pendaftaran.toLowerCase().includes(kw)) ||
            (s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(kw)) ||
            (s.nik && s.nik.includes(kw)) ||
            (s.nisn && s.nisn.includes(kw)) ||
            (s.sekolah_asal && s.sekolah_asal.toLowerCase().includes(kw))
        );
    }

    // Filter by Status Verifikasi
    if (status && status !== 'Semua') {
        students = students.filter(s => s.status_verifikasi === status);
    }

    // Filter by PIP
    if (pip && pip !== 'Semua') {
        students = students.filter(s => s.penerima_pip === pip);
    }

    // Sort order (default newest first)
    if (sort === 'oldest') {
        students.sort((a, b) => (a.tanggal_daftar || '').localeCompare(b.tanggal_daftar || ''));
    } else {
        students.sort((a, b) => (b.tanggal_daftar || '').localeCompare(a.tanggal_daftar || ''));
    }

    const totalFiltered = students.length;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = limit === 'all' ? totalFiltered : (parseInt(limit, 10) || 10);
    const totalPages = Math.ceil(totalFiltered / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = students.slice(startIndex, startIndex + limitNum);

    // Apply data privacy masking for list view table
    const maskedList = paginated.map(s => ({
        no_pendaftaran: s.no_pendaftaran,
        nama_lengkap: s.nama_lengkap,
        nik_masked: maskNIK(s.nik),
        no_kk_masked: maskKK(s.no_kk),
        nisn: s.nisn || '-',
        jenis_kelamin: s.jenis_kelamin,
        tanggal_lahir: s.tanggal_lahir,
        sekolah_asal: s.sekolah_asal,
        nama_ayah: s.nama_ayah,
        nama_ibu: s.nama_ibu,
        no_hp_masked: maskPhone(s.no_hp_orang_tua),
        penerima_pip: s.penerima_pip || 'Tidak',
        status_verifikasi: s.status_verifikasi || 'Belum Dicek',
        tanggal_daftar: s.tanggal_daftar,
        catatan_verifikasi: s.catatan_verifikasi
    }));

    res.json({
        success: true,
        count: totalFiltered,
        page: pageNum,
        limit: limitNum,
        totalPages: totalPages,
        data: maskedList
    });
});

// Get single student full unmasked detail (triggers Audit Log)
app.get('/api/admin/pendaftar/:no_pendaftaran', requireAuth, async (req, res) => {
    const noPendaftaran = req.params.no_pendaftaran.toUpperCase();
    const students = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);
    const match = students.find(s => s.no_pendaftaran.toUpperCase() === noPendaftaran);

    if (!match) {
        return res.status(404).json({ success: false, error: 'Data siswa tidak ditemukan.' });
    }

    // Record audit log for viewing full personal data
    await logAudit(req.user.username, 'Melihat data', `Melihat detail lengkap: ${match.no_pendaftaran} (${match.nama_lengkap})`, getClientIp(req));

    res.json({
        success: true,
        data: match
    });
});

// Update student data & verification status (Full 34 columns editable)
app.put('/api/admin/pendaftar/:no_pendaftaran', requireAuth, async (req, res) => {
    const noPendaftaran = req.params.no_pendaftaran.toUpperCase();
    const students = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);
    const index = students.findIndex(s => s.no_pendaftaran.toUpperCase() === noPendaftaran);

    if (index === -1) {
        return res.status(404).json({ success: false, error: 'Data siswa tidak ditemukan.' });
    }

    const payload = req.body;
    const oldStatus = students[index].status_verifikasi;

    if (payload.status_verifikasi && !VERIFICATION_STATUSES.includes(payload.status_verifikasi)) {
        return res.status(400).json({ success: false, error: 'Status verifikasi data tidak valid.' });
    }

    // Update allowed fields
    STUDENT_CSV_HEADERS.forEach(h => {
        if (h !== 'no_pendaftaran' && payload[h] !== undefined) {
            students[index][h] = String(payload[h]).trim();
        }
    });

    await writeCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS, students);

    // Update otomatis di Google Sheets & Firebase Firestore
    syncToGoogleSheets(students[index], 'UPDATE');
    updateStudentInFirestore(noPendaftaran, students[index]);

    const logMsg = payload.status_verifikasi && payload.status_verifikasi !== oldStatus
        ? `Status verifikasi ${noPendaftaran} diubah dari "${oldStatus}" menjadi "${payload.status_verifikasi}"`
        : `Data ${noPendaftaran} (${students[index].nama_lengkap}) diperbarui`;

    await logAudit(req.user.username, payload.status_verifikasi && payload.status_verifikasi !== oldStatus ? 'Mengubah status' : 'Mengedit data', logMsg, getClientIp(req));

    res.json({
        success: true,
        message: 'Data berhasil diperbarui.',
        data: students[index]
    });
});

// Sync seluruh data ke Google Sheets secara massal
app.post('/api/admin/sync-sheets', requireAuth, async (req, res) => {
    try {
        const settings = getSettings();
        const gasUrl = settings.google_apps_script_url;
        if (!gasUrl || !gasUrl.startsWith('https://script.google.com/')) {
            return res.status(400).json({
                success: false,
                error: 'URL Google Apps Script belum dikonfigurasi di file data/settings.json.'
            });
        }

        const students = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);
        const gasRes = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'BATCH_SYNC', students }),
            redirect: 'follow'
        });

        const gasData = await gasRes.json();
        await logAudit(req.user.username, 'Sinkronisasi Spreadsheet', `Sinkronisasi ${students.length} pendaftar ke Google Sheets`, getClientIp(req));

        res.json({
            success: true,
            message: `Berhasil menyinkronkan ${students.length} data pendaftar ke Google Sheets!`,
            details: gasData
        });
    } catch (err) {
        console.error('Batch sync error:', err);
        res.status(500).json({ success: false, error: 'Gagal menyinkronkan ke Google Sheets: ' + err.message });
    }
});

// Sync seluruh data ke Firebase Cloud Firestore secara massal
app.post('/api/admin/sync-firestore', requireAuth, async (req, res) => {
    try {
        const students = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);
        const result = await batchSyncStudentsToFirestore(students);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error || 'Gagal menyinkronkan ke Firebase Firestore.'
            });
        }

        await logAudit(req.user.username, 'Sinkronisasi Firestore', `Sinkronisasi ${result.count} data pendaftar ke Firebase Cloud Firestore`, getClientIp(req));

        res.json({
            success: true,
            message: `Berhasil menyinkronkan ${result.count} pendaftar ke Firebase Cloud Firestore!`,
            count: result.count
        });
    } catch (err) {
        console.error('Firestore batch sync error:', err);
        res.status(500).json({ success: false, error: 'Gagal menyinkronkan ke Firestore: ' + err.message });
    }
});

// Status koneksi Firebase Firestore
app.get('/api/admin/firestore-status', requireAuth, async (req, res) => {
    const status = await getFirestoreStatus();
    res.json({ success: true, data: status });
});

// Delete student (Super Admin only, requires confirmation)
app.delete('/api/admin/pendaftar/:no_pendaftaran', requireSuperAdmin, async (req, res) => {
    const noPendaftaran = req.params.no_pendaftaran.toUpperCase();
    const students = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);
    const index = students.findIndex(s => s.no_pendaftaran.toUpperCase() === noPendaftaran);

    if (index === -1) {
        return res.status(404).json({ success: false, error: 'Data siswa tidak ditemukan.' });
    }

    const deleted = students.splice(index, 1)[0];
    await writeCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS, students);

    // Hapus dari Firebase Firestore jika terhubung
    deleteStudentFromFirestore(noPendaftaran);

    await logAudit(req.user.username, 'Menghapus data', `Data ${noPendaftaran} (${deleted.nama_lengkap}) dihapus permanen`, getClientIp(req));

    res.json({
        success: true,
        message: `Data ${noPendaftaran} berhasil dihapus.`
    });
});

// ==========================================
// 4. CSV IMPORT & EXPORT ROUTES (34 KOLOM)
// ==========================================

// Export CSV (Full 34 Columns, UTF-8 BOM, Spreadsheet Compatible)
app.get('/api/admin/export', requireAuth, async (req, res) => {
    try {
        const { status, pip, filter, startDate, endDate, search } = req.query;
        let students = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);

        // Filter: Perlu Dicek
        if (filter === 'perlu_dicek') {
            students = students.filter(s => s.status_verifikasi === 'Perlu Dicek');
        }

        // Filter: Status Verifikasi
        if (status && status !== 'Semua') {
            students = students.filter(s => s.status_verifikasi === status);
        }

        // Filter: PIP
        if (pip && pip !== 'Semua') {
            students = students.filter(s => s.penerima_pip === pip);
        }

        // Filter: Search
        if (search && search.trim().length > 0) {
            const kw = search.trim().toLowerCase();
            students = students.filter(s =>
                (s.no_pendaftaran && s.no_pendaftaran.toLowerCase().includes(kw)) ||
                (s.nama_lengkap && s.nama_lengkap.toLowerCase().includes(kw)) ||
                (s.nik && s.nik.includes(kw))
            );
        }

        // Filter: Date Range
        if (startDate) {
            students = students.filter(s => s.tanggal_daftar >= startDate);
        }
        if (endDate) {
            students = students.filter(s => s.tanggal_daftar <= endDate + ' 23:59:59');
        }

        // Generate CSV with Indonesian headers and sanitize formula
        const csvBody = toIndonesianCSV(students, true);
        const csvWithBOM = '\uFEFF' + csvBody;

        await logAudit(req.user.username, 'Export CSV', `Export ${students.length} baris data 34 kolom`, getClientIp(req));

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="PPDB_SD_Salatiga_03_2026.csv"');
        res.send(Buffer.from(csvWithBOM, 'utf8'));
    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ success: false, error: 'Gagal mengekspor data CSV.' });
    }
});

// Download Blank CSV Template (34 Columns)
app.get('/api/admin/template-csv', requireAuth, (req, res) => {
    try {
        const templateContent = generateBlankTemplate();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="Template_PPDB_SD_Salatiga_03_34_Kolom.csv"');
        res.send(Buffer.from(templateContent, 'utf8'));
    } catch (err) {
        console.error('Template download error:', err);
        res.status(500).json({ success: false, error: 'Gagal mengunduh template CSV.' });
    }
});

// Backup CSV (full raw download)
app.get('/api/admin/backup', requireAuth, async (req, res) => {
    try {
        if (!fs.existsSync(STUDENTS_FILE)) {
            return res.status(404).json({ success: false, error: 'File data pendaftar tidak ditemukan.' });
        }

        await logAudit(req.user.username, 'Backup Data', 'Admin mengunduh backup lengkap pendaftar.csv', getClientIp(req));

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="BACKUP_PMB_SD_SALATIGA_03_2026.csv"');
        const fileStream = fs.createReadStream(STUDENTS_FILE);
        fileStream.pipe(res);
    } catch (err) {
        console.error('Backup error:', err);
        res.status(500).json({ success: false, error: 'Gagal membuat file backup.' });
    }
});

// Import CSV: Step 1 - Preview & Validate file (Matches 34 columns)
app.post('/api/admin/import/preview', requireAuth, upload.single('csvFile'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Silakan pilih file CSV yang valid.' });
        }

        const fileContent = req.file.buffer.toString('utf8');
        const parsedRows = parseCSV(fileContent);

        if (parsedRows.length === 0) {
            return res.status(400).json({ success: false, error: 'File CSV kosong atau format tidak sesuai.' });
        }

        const existingStudents = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);
        const existingNiks = new Set(existingStudents.map(s => s.nik).filter(Boolean));
        const existingNos = new Set(existingStudents.map(s => s.no_pendaftaran).filter(Boolean));

        const seenFileNiks = new Set();
        const validRows = [];
        const flaggedRows = []; // Perlu Dicek
        const duplicateRows = [];
        const invalidRows = [];

        parsedRows.forEach((row, idx) => {
            const rowNumber = idx + 2; // Line 1 is header
            const rowIssues = [];
            let isFlagged = false;
            let isDuplicate = false;

            // 1. Check NIK
            if (!row.nik || !isValidNIK(row.nik)) {
                rowIssues.push('NIK tidak valid (harus 16 digit angka).');
                isFlagged = true;
            } else if (existingNiks.has(row.nik)) {
                rowIssues.push(`NIK ${row.nik} sudah ada di database.`);
                isDuplicate = true;
                isFlagged = true;
            } else if (seenFileNiks.has(row.nik)) {
                rowIssues.push(`NIK ${row.nik} ganda dalam file CSV ini.`);
                isDuplicate = true;
                isFlagged = true;
            }

            // 2. Check NISN (if filled)
            if (row.nisn && !/^\d{10}$/.test(String(row.nisn).trim())) {
                rowIssues.push('NISN harus 10 digit angka jika diisi.');
                isFlagged = true;
            }

            // 3. Check No KK
            if (row.no_kk && !isValidNIK(row.no_kk)) {
                rowIssues.push('Nomor KK harus 16 digit angka jika diisi.');
                isFlagged = true;
            }

            // 4. Check Nama Lengkap
            if (!row.nama_lengkap || row.nama_lengkap.trim().length < 2) {
                rowIssues.push('Nama peserta didik kosong atau kurang dari 2 karakter.');
                isFlagged = true;
            }

            // 5. Check Tanggal Lahir
            if (row.tanggal_lahir && !isValidDate(row.tanggal_lahir)) {
                rowIssues.push('Format tanggal lahir tidak valid (gunakan YYYY-MM-DD).');
                isFlagged = true;
            }

            // 6. Check Email
            if (row.email_orang_tua && !isValidEmail(row.email_orang_tua)) {
                rowIssues.push('Format Email Orang Tua tidak valid.');
                isFlagged = true;
            }
            if (row.email_siswa && !isValidEmail(row.email_siswa)) {
                rowIssues.push('Format Email Siswa tidak valid.');
                isFlagged = true;
            }

            if (row.nik && isValidNIK(row.nik)) {
                seenFileNiks.add(row.nik);
            }

            const itemReport = {
                row: rowNumber,
                nama: row.nama_lengkap || '(Tanpa Nama)',
                nik: row.nik || '-',
                issues: rowIssues,
                isDuplicate: isDuplicate,
                suggestedStatus: isFlagged ? 'Perlu Dicek' : 'Valid'
            };

            if (isDuplicate) {
                duplicateRows.push(itemReport);
            } else if (isFlagged) {
                flaggedRows.push(itemReport);
            } else {
                validRows.push(row);
            }
        });

        res.json({
            success: true,
            summary: {
                totalRows: parsedRows.length,
                validCount: validRows.length,
                flaggedCount: flaggedRows.length,
                duplicateCount: duplicateRows.length,
                failedCount: 0 // Tidak digagalkan, dapat diimpor dengan penanda Perlu Dicek
            },
            preview: parsedRows.slice(0, 5).map(r => ({
                nama_lengkap: r.nama_lengkap,
                nik: r.nik,
                jenis_kelamin: r.jenis_kelamin,
                sekolah_asal: r.sekolah_asal,
                penerima_pip: r.penerima_pip,
                penghasilan_ayah: r.penghasilan_ayah,
                penghasilan_ibu: r.penghasilan_ibu
            })),
            flaggedRows: flaggedRows,
            duplicateRows: duplicateRows
        });
    } catch (err) {
        console.error('Import preview error:', err);
        res.status(500).json({ success: false, error: 'Gagal memproses file CSV: ' + err.message });
    }
});

// Import CSV: Step 2 - Confirm & Insert with duplicate strategies
app.post('/api/admin/import/confirm', requireAuth, upload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'File CSV tidak ditemukan.' });
        }

        const duplicateStrategy = req.body.duplicateStrategy || 'skip'; // 'skip' | 'import_flagged' | 'overwrite'
        const fileContent = req.file.buffer.toString('utf8');
        const parsedRows = parseCSV(fileContent);

        const students = readCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS);
        const existingNiksMap = new Map();
        students.forEach((s, idx) => {
            if (s.nik) existingNiksMap.set(s.nik, idx);
        });

        let importedCount = 0;
        let flaggedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

        for (const row of parsedRows) {
            const hasDuplicateInDb = row.nik && existingNiksMap.has(row.nik);

            // Duplicate Handling:
            if (hasDuplicateInDb) {
                if (duplicateStrategy === 'skip') {
                    skippedCount++;
                    continue;
                } else if (duplicateStrategy === 'overwrite') {
                    // Update existing record
                    const targetIdx = existingNiksMap.get(row.nik);
                    STUDENT_34_COLUMNS.forEach(col => {
                        if (row[col.key] !== undefined && row[col.key] !== '') {
                            students[targetIdx][col.key] = String(row[col.key]).trim();
                        }
                    });
                    students[targetIdx].status_verifikasi = row.status_verifikasi || 'Perlu Dicek';
                    students[targetIdx].catatan_verifikasi = 'Data diperbarui melalui impor CSV.';
                    updatedCount++;
                    continue;
                }
                // 'import_flagged' falls through to import as new with Perlu Dicek
            }

            // Generate Registration Number if missing
            let noPend = row.no_pendaftaran;
            if (!noPend || students.some(s => s.no_pendaftaran === noPend)) {
                noPend = generateNextRegistrationNumber(students, '2026');
            }

            // Determine verification status
            let finalStatus = row.status_verifikasi;
            if (!finalStatus || !VERIFICATION_STATUSES.includes(finalStatus)) {
                if (!isValidNIK(row.nik) || hasDuplicateInDb) {
                    finalStatus = 'Perlu Dicek';
                    flaggedCount++;
                } else if (!row.nama_lengkap || !row.tanggal_lahir) {
                    finalStatus = 'Perlu Perbaikan';
                    flaggedCount++;
                } else {
                    finalStatus = 'Valid';
                }
            } else if (finalStatus === 'Perlu Dicek' || finalStatus === 'Perlu Perbaikan') {
                flaggedCount++;
            }

            const cleanRow = {
                no_pendaftaran: noPend,
                nama_lengkap: row.nama_lengkap ? String(row.nama_lengkap).trim() : '',
                nik: row.nik ? String(row.nik).trim() : '',
                jenis_kelamin: row.jenis_kelamin || 'Laki-laki',
                nisn: row.nisn ? String(row.nisn).trim() : '',
                alamat: row.alamat ? String(row.alamat).trim() : '',
                tempat_lahir: row.tempat_lahir || 'Salatiga',
                tanggal_lahir: row.tanggal_lahir || '',
                anak_ke: row.anak_ke || '1',
                tinggi_badan: row.tinggi_badan || '',
                berat_badan: row.berat_badan || '',
                hobi: row.hobi || '',
                cita_cita: row.cita_cita || '',
                no_hp_siswa: row.no_hp_siswa || '',
                email_siswa: row.email_siswa || '',
                sekolah_asal: row.sekolah_asal || '',
                tahun_lulus: row.tahun_lulus || '2026',
                tanggal_daftar: row.tanggal_daftar || nowStr,
                no_kk: row.no_kk ? String(row.no_kk).trim() : '',
                nama_ayah: row.nama_ayah || '',
                nik_ayah: row.nik_ayah || '',
                pekerjaan_ayah: row.pekerjaan_ayah || '',
                penghasilan_ayah: row.penghasilan_ayah || '',
                pendidikan_ayah: row.pendidikan_ayah || '',
                nama_ibu: row.nama_ibu || '',
                nik_ibu: row.nik_ibu || '',
                pekerjaan_ibu: row.pekerjaan_ibu || '',
                penghasilan_ibu: row.penghasilan_ibu || '',
                pendidikan_ibu: row.pendidikan_ibu || '',
                no_hp_orang_tua: row.no_hp_orang_tua || '',
                penerima_pip: row.penerima_pip === 'Ya' ? 'Ya' : 'Tidak',
                keterangan_penghasilan_ayah: row.keterangan_penghasilan_ayah || '',
                keterangan_penghasilan_ibu: row.keterangan_penghasilan_ibu || '',
                email_orang_tua: row.email_orang_tua || '',
                status_verifikasi: finalStatus,
                catatan_verifikasi: hasDuplicateInDb ? 'Diimpor dengan penanda NIK terdeteksi ganda.' : (row.catatan_verifikasi || 'Data diimpor dari file CSV.')
            };

            students.push(cleanRow);
            importedCount++;
            if (cleanRow.nik) existingNiksMap.set(cleanRow.nik, students.length - 1);
        }

        await writeCSVFile(STUDENTS_FILE, STUDENT_CSV_HEADERS, students);

        const summaryMsg = `Berhasil mengimpor ${importedCount} data (${flaggedCount} bertanda Perlu Dicek, ${updatedCount} diperbarui, ${skippedCount} dilewati).`;
        await logAudit(req.user.username, 'Import CSV', summaryMsg, getClientIp(req));

        res.json({
            success: true,
            summary: {
                importedCount,
                flaggedCount,
                updatedCount,
                skippedCount
            },
            message: summaryMsg
        });
    } catch (err) {
        console.error('Import confirm error:', err);
        res.status(500).json({ success: false, error: 'Gagal menyelesaikan impor data: ' + err.message });
    }
});

// Audit Logs
app.get('/api/admin/audit-logs', requireAuth, (req, res) => {
    const logs = getAuditLogs();
    res.json({
        success: true,
        data: logs.slice(0, 100)
    });
});

// Update Settings & Jadwal Pendaftaran
app.put('/api/admin/settings', requireAuth, async (req, res) => {
    try {
        const payload = req.body;
        const current = getSettings();
        const updated = {
            ...current,
            ...payload
        };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8');

        // Sync settings to Firebase Firestore
        saveSettingsToFirestore(updated);

        await logAudit(req.user.username, 'Mengubah Pengaturan', 'Pengaturan sistem PPDB diperbarui', getClientIp(req));

        res.json({
            success: true,
            message: 'Pengaturan berhasil disimpan.',
            data: updated
        });
    } catch (e) {
        res.status(500).json({ success: false, error: 'Gagal menyimpan pengaturan.' });
    }
});

// ==========================================
// 5. HTML PAGE ROUTES
// ==========================================

// Public Home
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: PUBLIC_DIR });
});

// Public Form Pendaftaran
app.get('/daftar', (req, res) => {
    res.sendFile('daftar.html', { root: PUBLIC_DIR });
});

// Public Cek Status
app.get('/status', (req, res) => {
    res.sendFile('status.html', { root: PUBLIC_DIR });
});

// Public Cetak Bukti Pendaftaran
app.get('/bukti/:no_pendaftaran', (req, res) => {
    res.sendFile('bukti.html', { root: PUBLIC_DIR });
});

// Admin Login
app.get('/admin/login', (req, res) => {
    res.sendFile('admin/login.html', { root: PUBLIC_DIR });
});

// Admin Dashboard SPA
app.get(/^\/admin(\/.*)?$/, (req, res) => {
    res.sendFile('admin/index.html', { root: PUBLIC_DIR });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <title>404 - Halaman Tidak Ditemukan</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="min-h-screen bg-[#0B192C] text-white flex items-center justify-center p-4 text-center font-sans">
            <div>
                <h1 class="text-6xl font-black text-[#F97316]">404</h1>
                <p class="text-xl mt-3 font-semibold">Halaman Tidak Ditemukan</p>
                <p class="text-slate-400 text-sm mt-1">Halaman yang Anda tuju tidak tersedia di PPDB SD SALATIGA 03.</p>
                <a href="/" class="inline-block mt-6 px-6 py-2.5 bg-[#F97316] text-white rounded-xl text-sm font-bold shadow-lg hover:bg-orange-600 transition">
                    Kembali ke Beranda
                </a>
            </div>
        </body>
        </html>
    `);
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server PPDB SD SALATIGA 03 berjalan di http://localhost:${PORT}`);
    });
}

module.exports = app;
