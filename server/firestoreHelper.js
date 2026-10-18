/**
 * Firestore Helper Module - PPDB SD SALATIGA 03
 * Project ID: ppdb-sd-n-salatiga-03
 * Handles real-time synchronization, student CRUD, and settings sync.
 */

const fs = require('fs');
const path = require('path');
let db = null;
let FieldValue = null;
let isInitialized = false;

// Candidate paths for serviceAccountKey.json
const SERVICE_ACCOUNT_PATHS = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(__dirname, '..', 'data', 'serviceAccountKey.json'),
    path.resolve(__dirname, '..', 'serviceAccountKey.json'),
    path.resolve(__dirname, 'serviceAccountKey.json')
].filter(Boolean);

/**
 * Initialize Firebase Admin SDK
 */
function initFirestore() {
    if (isInitialized && db) return db;

    try {
        let credentialPath = null;
        for (const p of SERVICE_ACCOUNT_PATHS) {
            if (fs.existsSync(p)) {
                credentialPath = p;
                break;
            }
        }

        const { initializeApp, cert, getApps } = require('firebase-admin/app');
        const firestoreModule = require('firebase-admin/firestore');
        const { getFirestore } = firestoreModule;
        FieldValue = firestoreModule.FieldValue;

        const apps = getApps();
        if (apps.length > 0) {
            db = getFirestore(apps[0]);
            isInitialized = true;
            return db;
        }

        if (credentialPath) {
            const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
            const app = initializeApp({
                credential: cert(serviceAccount),
                projectId: serviceAccount.project_id || 'ppdb-sd-n-salatiga-03'
            });
            db = getFirestore(app);
            isInitialized = true;
            console.log(`[Firebase Firestore] Terhubung ke project "${serviceAccount.project_id || 'ppdb-sd-n-salatiga-03'}" menggunakan ${path.basename(credentialPath)}`);
            return db;
        } else {
            console.log('[Firebase Firestore] Catatan: File serviceAccountKey.json belum ditemukan di folder data/serviceAccountKey.json. Menunggu konfigurasi key.');
            return null;
        }
    } catch (err) {
        console.error('[Firebase Firestore] Inisialisasi gagal:', err.message);
        return null;
    }
}

/**
 * Check if Firestore is actively configured and connected
 */
function isFirestoreReady() {
    if (!isInitialized || !db) {
        initFirestore();
    }
    return Boolean(isInitialized && db);
}

/**
 * Save / Upsert a single student to Firestore (Collection: 'pendaftar')
 */
async function saveStudentToFirestore(studentData) {
    if (!isFirestoreReady()) return { success: false, reason: 'not_configured' };
    try {
        const docId = String(studentData.no_pendaftaran || '').trim().toUpperCase();
        if (!docId) throw new Error('Nomor pendaftaran kosong.');

        // Sanitize data copy
        const timestamp = FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString();
        const cleanData = { ...studentData, updatedAt: timestamp };
        if (!cleanData.createdAt) {
            cleanData.createdAt = timestamp;
        }

        await db.collection('pendaftar').doc(docId).set(cleanData, { merge: true });
        console.log(`[Firebase Firestore] Siswa ${docId} berhasil disimpan ke Firestore.`);
        return { success: true, docId };
    } catch (err) {
        console.error('[Firebase Firestore] Gagal menyimpan siswa:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Update an existing student in Firestore
 */
async function updateStudentInFirestore(noPendaftaran, updateFields) {
    if (!isFirestoreReady()) return { success: false, reason: 'not_configured' };
    try {
        const docId = String(noPendaftaran || '').trim().toUpperCase();
        if (!docId) throw new Error('Nomor pendaftaran kosong.');

        const timestamp = FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString();
        const cleanFields = { ...updateFields, updatedAt: timestamp };
        await db.collection('pendaftar').doc(docId).set(cleanFields, { merge: true });
        console.log(`[Firebase Firestore] Data ${docId} berhasil diperbarui di Firestore.`);
        return { success: true };
    } catch (err) {
        console.error('[Firebase Firestore] Gagal memperbarui data:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Delete a student from Firestore
 */
async function deleteStudentFromFirestore(noPendaftaran) {
    if (!isFirestoreReady()) return { success: false, reason: 'not_configured' };
    try {
        const docId = String(noPendaftaran || '').trim().toUpperCase();
        await db.collection('pendaftar').doc(docId).delete();
        console.log(`[Firebase Firestore] Data ${docId} dihapus dari Firestore.`);
        return { success: true };
    } catch (err) {
        console.error('[Firebase Firestore] Gagal menghapus:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Batch synchronize all students from array into Firestore
 */
async function batchSyncStudentsToFirestore(studentsArray) {
    if (!isFirestoreReady()) {
        return { success: false, error: 'Firebase Firestore belum terhubung. Harap letakkan file serviceAccountKey.json di folder data/.' };
    }

    try {
        const BATCH_SIZE = 400; // Firestore limit is 500 per batch
        let totalSynced = 0;
        const timestamp = FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString();

        for (let i = 0; i < studentsArray.length; i += BATCH_SIZE) {
            const chunk = studentsArray.slice(i, i + BATCH_SIZE);
            const batch = db.batch();

            chunk.forEach(s => {
                const docId = String(s.no_pendaftaran || '').trim().toUpperCase();
                if (docId) {
                    const docRef = db.collection('pendaftar').doc(docId);
                    batch.set(docRef, {
                        ...s,
                        updatedAt: timestamp
                    }, { merge: true });
                }
            });

            await batch.commit();
            totalSynced += chunk.length;
        }

        console.log(`[Firebase Firestore] Batch sync berhasil: ${totalSynced} pendaftar tersinkronisasi.`);
        return { success: true, count: totalSynced };
    } catch (err) {
        console.error('[Firebase Firestore] Gagal batch sync:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Sync school settings to Firestore (Collection: 'settings', Doc: 'general')
 */
async function saveSettingsToFirestore(settingsObj) {
    if (!isFirestoreReady()) return { success: false, reason: 'not_configured' };
    try {
        const timestamp = FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString();
        await db.collection('settings').doc('general').set({
            ...settingsObj,
            updatedAt: timestamp
        }, { merge: true });
        return { success: true };
    } catch (err) {
        console.error('[Firebase Firestore] Gagal menyimpan pengaturan:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Get Firestore Connection Status & Stats
 */
async function getFirestoreStatus() {
    if (!isFirestoreReady()) {
        return {
            connected: false,
            projectId: 'ppdb-sd-n-salatiga-03',
            message: 'Belum terhubung. Silakan unduh file serviceAccountKey.json dari Firebase Console dan simpan di folder data/serviceAccountKey.json.'
        };
    }

    try {
        const snapshot = await db.collection('pendaftar').count().get();
        const total = snapshot.data().count;
        return {
            connected: true,
            projectId: 'ppdb-sd-n-salatiga-03',
            totalPendaftarInFirestore: total,
            message: `Terhubung aktif ke Firestore! Total ${total} dokumen di koleksi pendaftar.`
        };
    } catch (err) {
        return {
            connected: false,
            projectId: 'ppdb-sd-n-salatiga-03',
            error: err.message
        };
    }
}

module.exports = {
    initFirestore,
    isFirestoreReady,
    saveStudentToFirestore,
    updateStudentInFirestore,
    deleteStudentFromFirestore,
    batchSyncStudentsToFirestore,
    saveSettingsToFirestore,
    getFirestoreStatus
};
