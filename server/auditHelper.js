const path = require('path');
const { AUDIT_LOG_HEADERS } = require('./constants');
const { readCSVFile, writeCSVFile } = require('./csvHelper');

const AUDIT_FILE = path.join(__dirname, '..', 'data', 'audit_log.csv');

function getFormattedDateTime() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const mi = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

async function logAudit(adminUser, activity, detail, clientIp = '127.0.0.1') {
    try {
        const logs = readCSVFile(AUDIT_FILE, AUDIT_LOG_HEADERS);
        const newLog = {
            waktu: getFormattedDateTime(),
            admin: adminUser || 'anonymous',
            aktivitas: activity,
            data: detail || '-',
            ip: clientIp || '127.0.0.1'
        };
        logs.unshift(newLog); // Put newest on top
        // Keep at most 2000 recent logs to keep file light
        const trimmed = logs.slice(0, 2000);
        await writeCSVFile(AUDIT_FILE, AUDIT_LOG_HEADERS, trimmed);
    } catch (err) {
        console.error('Failed to write audit log:', err.message);
    }
}

function getAuditLogs() {
    return readCSVFile(AUDIT_FILE, AUDIT_LOG_HEADERS);
}

module.exports = {
    logAudit,
    getAuditLogs,
    getFormattedDateTime
};
