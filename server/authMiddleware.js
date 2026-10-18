const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

// In-memory active sessions store
// sessionId -> { userId, username, role, name, lastActive, createdAt }
const activeSessions = new Map();

// In-memory failed login tracking for Brute Force protection
// key: ip_or_username -> { count, lockedUntil }
const loginAttempts = new Map();

const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

function createSession(user) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    activeSessions.set(sessionId, {
        userId: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        lastActive: now,
        createdAt: now
    });
    return sessionId;
}

function destroySession(sessionId) {
    if (sessionId) {
        activeSessions.delete(sessionId);
    }
}

function getSession(sessionId) {
    if (!sessionId) return null;
    const session = activeSessions.get(sessionId);
    if (!session) return null;

    const now = Date.now();
    // Check max age
    if (now - session.createdAt > SESSION_MAX_AGE_MS) {
        activeSessions.delete(sessionId);
        return null;
    }
    // Check idle timeout
    if (now - session.lastActive > SESSION_IDLE_TIMEOUT_MS) {
        activeSessions.delete(sessionId);
        return null;
    }

    // Refresh last active
    session.lastActive = now;
    return session;
}

function checkBruteForce(identifier) {
    const record = loginAttempts.get(identifier);
    if (!record) return { isLocked: false };

    const now = Date.now();
    if (record.lockedUntil && now < record.lockedUntil) {
        const remainingMinutes = Math.ceil((record.lockedUntil - now) / 60000);
        return { isLocked: true, remainingMinutes };
    }

    // Lockout expired, reset if needed
    if (record.lockedUntil && now >= record.lockedUntil) {
        loginAttempts.delete(identifier);
        return { isLocked: false };
    }

    return { isLocked: false };
}

function recordFailedLogin(identifier) {
    const now = Date.now();
    let record = loginAttempts.get(identifier);
    if (!record) {
        record = { count: 1, firstAttempt: now, lockedUntil: null };
    } else {
        record.count += 1;
    }

    if (record.count >= MAX_FAILED_ATTEMPTS) {
        record.lockedUntil = now + LOCKOUT_DURATION_MS;
    }
    loginAttempts.set(identifier, record);
}

function clearFailedLogin(identifier) {
    loginAttempts.delete(identifier);
}

/**
 * Middleware to require authenticated admin session
 */
function requireAuth(req, res, next) {
    // Prevent client-side / browser caching for all admin endpoints
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const sessionId = req.cookies?.ppdb_session || req.headers['x-session-token'];
    const session = getSession(sessionId);

    if (!session) {
        if (req.xhr || req.headers.accept?.includes('json') || req.path.startsWith('/api/')) {
            return res.status(401).json({ success: false, error: 'Sesi telah berakhir atau tidak valid. Silakan login kembali.' });
        }
        return res.redirect('/admin/login');
    }

    req.user = session;
    next();
}

/**
 * Middleware to require Super Admin role
 */
function requireSuperAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                error: 'Akses ditolak. Fitur ini hanya diperuntukkan bagi Super Admin.'
            });
        }
        next();
    });
}

function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

module.exports = {
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
};
