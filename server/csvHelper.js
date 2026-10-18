const fs = require('fs');
const path = require('path');
const { HEADER_ALIAS_MAP, STUDENT_34_COLUMNS } = require('./constants');

// Ensure directory exists
function ensureDirExists(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Simple async mutex for atomic file writing
class Mutex {
    constructor() {
        this.queue = [];
        this.locked = false;
    }

    async acquire() {
        return new Promise(resolve => {
            if (!this.locked) {
                this.locked = true;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    release() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            next();
        } else {
            this.locked = false;
        }
    }
}

const fileMutex = new Mutex();

/**
 * Escape a CSV field according to RFC 4180
 * Also sanitizes against CSV Formula Injection
 */
function escapeCSVField(val, sanitizeFormula = false) {
    if (val === undefined || val === null) return '""';
    let str = String(val).trim();

    // CSV Formula Injection Prevention:
    // Characters =, +, -, @ at the start of a formula can trigger execution in Excel
    if (sanitizeFormula && str.length > 0) {
        const firstChar = str.charAt(0);
        if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@') {
            str = "'" + str; // Prepend single quote so spreadsheet engines treat as string literal
        }
    }

    // Double quotes must be escaped by another quote
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        str = '"' + str.replace(/"/g, '""') + '"';
    } else {
        str = '"' + str + '"';
    }
    return str;
}

/**
 * Robust RFC 4180 compliant CSV line parser
 */
function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
        const char = line[i];
        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i += 2;
                    continue;
                } else {
                    inQuotes = false;
                    i++;
                    continue;
                }
            } else {
                current += char;
                i++;
                continue;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
                i++;
                continue;
            } else if (char === ',') {
                fields.push(current.trim());
                current = '';
                i++;
                continue;
            } else {
                current += char;
                i++;
                continue;
            }
        }
    }
    fields.push(current.trim());
    return fields;
}

/**
 * Normalizes raw CSV header names to canonical database keys
 */
function normalizeHeaderName(rawHeader) {
    if (!rawHeader) return '';
    const clean = String(rawHeader).replace(/^"|"$/g, '').trim().toLowerCase();
    if (HEADER_ALIAS_MAP[clean]) {
        return HEADER_ALIAS_MAP[clean];
    }
    // Try alphanumeric without punctuation
    const simple = clean.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    if (HEADER_ALIAS_MAP[simple]) {
        return HEADER_ALIAS_MAP[simple];
    }
    return clean.replace(/\s+/g, '_');
}

/**
 * Parse full CSV file content into array of objects based on header row
 */
function parseCSV(content, customHeaderMapper = null) {
    if (!content) return [];
    // Remove UTF-8 BOM if present
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }

    // Split lines handling CRLF and LF, but respect multiline quotes
    const lines = [];
    let currentLine = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '"') {
            inQuotes = !inQuotes;
            currentLine += char;
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && content[i + 1] === '\n') {
                i++; // Skip \n
            }
            if (currentLine.trim().length > 0) {
                lines.push(currentLine);
            }
            currentLine = '';
        } else {
            currentLine += char;
        }
    }
    if (currentLine.trim().length > 0) {
        lines.push(currentLine);
    }

    if (lines.length === 0) return [];

    const rawHeaders = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    const canonicalHeaders = rawHeaders.map(h => {
        if (customHeaderMapper) return customHeaderMapper(h);
        return normalizeHeaderName(h);
    });

    const records = [];

    for (let i = 1; i < lines.length; i++) {
        const rawFields = parseCSVLine(lines[i]);
        if (rawFields.length === 1 && rawFields[0] === '') continue; // skip blank line

        const record = {};
        for (let j = 0; j < canonicalHeaders.length; j++) {
            let val = rawFields[j] !== undefined ? rawFields[j] : '';
            // Unquote if wrapped in quotes
            if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
                val = val.substring(1, val.length - 1).replace(/""/g, '"');
            }
            // Strip leading injection quote for internal usage
            if (val.startsWith("'") && (val.charAt(1) === '=' || val.charAt(1) === '+' || val.charAt(1) === '-' || val.charAt(1) === '@')) {
                val = val.substring(1);
            }
            // Handle ="0123" Excel text wrapper if imported from Excel
            if (val.startsWith('="') && val.endsWith('"')) {
                val = val.substring(2, val.length - 1);
            }
            record[canonicalHeaders[j]] = String(val).trim();
        }
        records.push(record);
    }

    return records;
}

/**
 * Convert array of objects to CSV string
 */
function toCSV(headers, records, sanitizeFormula = false) {
    const headerRow = headers.map(h => `"${h}"`).join(',');
    const rows = records.map(rec => {
        return headers.map(h => escapeCSVField(rec[h] !== undefined ? rec[h] : '', sanitizeFormula)).join(',');
    });
    return [headerRow, ...rows].join('\r\n');
}

/**
 * Generate CSV with Indonesian headers (as requested for Export and Template)
 */
function toIndonesianCSV(records, sanitizeFormula = false) {
    const headerLabels = ['No. Pendaftaran', ...STUDENT_34_COLUMNS.map(c => c.label)];
    const keys = ['no_pendaftaran', ...STUDENT_34_COLUMNS.map(c => c.key)];

    const headerRow = headerLabels.map(l => `"${l}"`).join(',');
    const rows = records.map(rec => {
        return keys.map(k => {
            let val = rec[k] !== undefined ? rec[k] : '';
            return escapeCSVField(val, sanitizeFormula);
        }).join(',');
    });

    return [headerRow, ...rows].join('\r\n');
}

/**
 * Generate Blank CSV Template with the 34 Columns
 */
function generateBlankTemplate() {
    const headerLabels = STUDENT_34_COLUMNS.map(c => c.label);
    const sampleRow = [
        'Ahmad Fauzan',              // 1. Nama Peserta Didik
        '3374011205190001',          // 2. NIK Peserta Didik
        'Laki-laki',                 // 3. Jenis Kelamin
        '0192837465',                // 4. NISN
        'Jl. Pemuda No. 45',         // 5. Alamat Rumah
        'Salatiga',                  // 6. Tempat Lahir
        '2019-05-12',                // 7. Tanggal Lahir
        '1',                         // 8. Anak Ke-
        '115',                       // 9. Tinggi Badan
        '20',                        // 10. Berat Badan
        'Membaca',                   // 11. Hobi
        'Dokter',                    // 12. Cita-Cita
        '081234567890',              // 13. No. HP Peserta Didik
        'siswa@gmail.com',           // 14. Alamat Email Aktif Peserta Didik
        'TK Pertiwi 01 Salatiga',    // 15. Nama Sekolah Asal
        '2026',                      // 16. Tahun Lulus
        '2026-01-15',                // 17. Tanggal Pendaftaran
        '3374012001150005',          // 18. No. Kartu Keluarga
        'Bambang Pratama',           // 19. Nama Ayah
        '3374011002820002',          // 20. NIK Ayah
        'Karyawan Swasta',           // 21. Pekerjaan Ayah
        'Rp2.000.001–Rp5.000.000',   // 22. Penghasilan Ayah
        'S1',                        // 23. Pendidikan Terakhir Ayah
        'Dewi Lestari',              // 24. Nama Ibu
        '3374015508850003',          // 25. NIK Ibu
        'Ibu Rumah Tangga',          // 26. Pekerjaan Ibu
        'Di bawah Rp500.000',        // 27. Penghasilan Ibu
        'D3',                        // 28. Pendidikan Terakhir Ibu
        '081298765432',              // 29. No. HP Orang Tua
        'Ya',                        // 30. Penerima PIP
        '',                          // 31. Keterangan Penghasilan Ayah
        'Mengurus rumah tangga',     // 32. Keterangan Penghasilan Ibu
        'orangtua@gmail.com',        // 33. Email Orang Tua
        'Belum Dicek'                // 34. Status Verifikasi Data
    ];

    const headerLine = headerLabels.map(l => `"${l}"`).join(',');
    const sampleLine = sampleRow.map(v => `"${v}"`).join(',');

    return '\uFEFF' + [headerLine, sampleLine].join('\r\n');
}

/**
 * Thread-safe read CSV file
 */
function readCSVFile(filePath, defaultHeaders = []) {
    ensureDirExists(filePath);
    if (!fs.existsSync(filePath)) {
        if (defaultHeaders && defaultHeaders.length > 0) {
            const initialContent = defaultHeaders.map(h => `"${h}"`).join(',') + '\r\n';
            fs.writeFileSync(filePath, '\uFEFF' + initialContent, 'utf8');
        } else {
            return [];
        }
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return parseCSV(content);
}

/**
 * Thread-safe write CSV file using temporary file and atomic rename
 */
async function writeCSVFile(filePath, headers, records, sanitizeFormula = false) {
    await fileMutex.acquire();
    try {
        ensureDirExists(filePath);
        const csvContent = '\uFEFF' + toCSV(headers, records, sanitizeFormula);
        const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
        fs.writeFileSync(tempPath, csvContent, 'utf8');
        fs.renameSync(tempPath, filePath);
    } finally {
        fileMutex.release();
    }
}

/**
 * Privacy Masking
 */
function maskNIK(nik) {
    if (!nik) return '-';
    const str = String(nik).trim();
    if (str.length <= 8) return str;
    return str.substring(0, 4) + '*'.repeat(Math.max(4, str.length - 8)) + str.substring(str.length - 4);
}

function maskPhone(phone) {
    if (!phone) return '-';
    const str = String(phone).trim();
    if (str.length <= 6) return str;
    return str.substring(0, 4) + '*'.repeat(Math.max(4, str.length - 6)) + str.substring(str.length - 2);
}

function maskKK(kk) {
    if (!kk) return '-';
    const str = String(kk).trim();
    if (str.length <= 8) return str;
    return str.substring(0, 4) + '*'.repeat(Math.max(4, str.length - 8)) + str.substring(str.length - 4);
}

module.exports = {
    parseCSV,
    toCSV,
    toIndonesianCSV,
    generateBlankTemplate,
    normalizeHeaderName,
    readCSVFile,
    writeCSVFile,
    escapeCSVField,
    maskNIK,
    maskPhone,
    maskKK
};
