/**
 * Validation and Data Helpers for PPDB SD Salatiga 03 (34 Kolom)
 */

const { INCOME_CATEGORIES, PIP_OPTIONS, VERIFICATION_STATUSES } = require('./constants');

function isValidNIK(nik) {
    if (!nik) return false;
    return /^\d{16}$/.test(String(nik).trim());
}

function isValidPhone(phone) {
    if (!phone) return false;
    const clean = String(phone).replace(/[\s\-]/g, '');
    return /^(08|\+628)[0-9]{8,13}$/.test(clean);
}

function isValidEmail(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function isValidDate(dateStr) {
    if (!dateStr) return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const d = new Date(dateStr);
    return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Validates registration payload with 34 columns
 */
function validateRegistration(data, existingStudents = []) {
    const errors = [];

    // NIK Anak
    if (!data.nik) {
        errors.push('NIK Calon Siswa wajib diisi.');
    } else if (!isValidNIK(data.nik)) {
        errors.push('NIK Calon Siswa harus berupa 16 digit angka.');
    } else {
        const isDuplicate = existingStudents.some(s => s.nik === data.nik && s.no_pendaftaran !== data.no_pendaftaran);
        if (isDuplicate) {
            errors.push(`Calon siswa dengan NIK ${data.nik} sudah terdaftar dalam sistem.`);
        }
    }

    // NISN (opsional, jika diisi harus 10 digit angka)
    if (data.nisn && !/^\d{10}$/.test(String(data.nisn).trim())) {
        errors.push('NISN harus 10 digit angka jika diisi.');
    }

    // Nama Calon Siswa
    if (!data.nama_lengkap || data.nama_lengkap.trim().length < 2) {
        errors.push('Nama Lengkap Calon Siswa wajib diisi (minimal 2 karakter).');
    }

    // Jenis Kelamin
    if (!data.jenis_kelamin || !['Laki-laki', 'Perempuan'].includes(data.jenis_kelamin)) {
        errors.push('Jenis Kelamin wajib dipilih (Laki-laki atau Perempuan).');
    }

    // Tempat & Tanggal Lahir
    if (!data.tempat_lahir || data.tempat_lahir.trim().length === 0) {
        errors.push('Tempat Lahir Calon Siswa wajib diisi.');
    }
    if (!data.tanggal_lahir || !isValidDate(data.tanggal_lahir)) {
        errors.push('Tanggal Lahir Calon Siswa tidak valid (format YYYY-MM-DD).');
    }

    // No KK
    if (!data.no_kk) {
        errors.push('Nomor Kartu Keluarga (KK) wajib diisi.');
    } else if (!isValidNIK(data.no_kk)) {
        errors.push('Nomor Kartu Keluarga (KK) harus berupa 16 digit angka.');
    }

    // Alamat
    if (!data.alamat || data.alamat.trim().length < 5) {
        errors.push('Alamat tempat tinggal wajib diisi lengkap.');
    }

    // Data Orang Tua: Minimal salah satu nama orang tua (Ayah atau Ibu) harus ada
    const hasAyah = data.nama_ayah && data.nama_ayah.trim().length > 0;
    const hasIbu = data.nama_ibu && data.nama_ibu.trim().length > 0;

    if (!hasAyah && !hasIbu) {
        errors.push('Minimal salah satu data orang tua (Nama Ayah atau Nama Ibu) wajib diisi.');
    }

    if (hasAyah && data.nik_ayah && !isValidNIK(data.nik_ayah)) {
        errors.push('NIK Ayah harus 16 digit angka jika diisi.');
    }
    if (hasIbu && data.nik_ibu && !isValidNIK(data.nik_ibu)) {
        errors.push('NIK Ibu harus 16 digit angka jika diisi.');
    }

    // No HP kontak orang tua
    const phone = data.no_hp_orang_tua || data.no_hp_ayah || data.no_hp_ibu;
    if (!phone) {
        errors.push('Nomor HP Orang Tua wajib diisi untuk konfirmasi.');
    } else if (!isValidPhone(phone)) {
        errors.push('Format Nomor HP Orang Tua tidak valid (contoh: 08123456789).');
    }

    // Email Orang Tua (opsional, jika diisi harus valid)
    if (data.email_orang_tua && !isValidEmail(data.email_orang_tua)) {
        errors.push('Format Email Orang Tua tidak valid.');
    }

    // Email Siswa (opsional, jika diisi harus valid)
    if (data.email_siswa && !isValidEmail(data.email_siswa)) {
        errors.push('Format Email Siswa tidak valid.');
    }

    // Penerima PIP
    if (data.penerima_pip && !PIP_OPTIONS.includes(data.penerima_pip)) {
        errors.push('Pilihan status Penerima PIP harus "Ya" atau "Tidak".');
    }

    // Keterangan Penghasilan Ayah jika kategori <500rb atau >5jt
    if (data.penghasilan_ayah === 'Di bawah Rp500.000' || data.penghasilan_ayah === 'Di atas Rp5.000.000') {
        if (!data.keterangan_penghasilan_ayah || data.keterangan_penghasilan_ayah.trim().length === 0) {
            // Berikan peringatan atau wajibkan keterangan jika dipilih
            // Sesuai prompt: "Jika memilih kategori di bawah Rp500.000 / di atas Rp5.000.000, tampilkan kolom Keterangan Penghasilan"
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Determine default verification status based on data quality
 */
function determineVerificationStatus(row, existingNiks = new Set(), seenFileNiks = new Set()) {
    if (!row.nik || !isValidNIK(row.nik)) {
        return 'Perlu Dicek'; // NIK tidak valid
    }
    if (existingNiks.has(row.nik) || seenFileNiks.has(row.nik)) {
        return 'Perlu Dicek'; // NIK ganda
    }
    if (!row.nama_lengkap || !row.tanggal_lahir || !row.alamat) {
        return 'Perlu Perbaikan'; // Data belum lengkap
    }
    return 'Belum Dicek'; // Default pendaftaran baru
}

/**
 * Generate sequential registration number: PMB-SD03-2026-001
 */
function generateNextRegistrationNumber(existingStudents = [], year = '2026') {
    const prefix = `PMB-SD03-${year}-`;
    let maxNum = 0;

    for (const student of existingStudents) {
        if (student.no_pendaftaran && student.no_pendaftaran.startsWith(prefix)) {
            const numPart = parseInt(student.no_pendaftaran.substring(prefix.length), 10);
            if (!isNaN(numPart) && numPart > maxNum) {
                maxNum = numPart;
            }
        }
    }

    const nextNum = maxNum + 1;
    const padded = String(nextNum).padStart(3, '0');
    return `${prefix}${padded}`;
}

module.exports = {
    isValidNIK,
    isValidPhone,
    isValidEmail,
    isValidDate,
    validateRegistration,
    determineVerificationStatus,
    generateNextRegistrationNumber
};
