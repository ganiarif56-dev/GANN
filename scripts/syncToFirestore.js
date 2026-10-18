/**
 * Migration Script: Push all CSV data to Firebase Cloud Firestore
 * Usage: node scripts/syncToFirestore.js
 */

const path = require('path');
const { readCSVFile } = require('../server/csvHelper');
const { STUDENT_CSV_HEADERS } = require('../server/constants');
const { initFirestore, batchSyncStudentsToFirestore, isFirestoreReady } = require('../server/firestoreHelper');

async function run() {
    console.log('====================================================');
    console.log('🚀 MIGRATION: CSV TO FIREBASE CLOUD FIRESTORE');
    console.log('Project: ppdb-sd-n-salatiga-03');
    console.log('====================================================\n');

    initFirestore();

    if (!isFirestoreReady()) {
        console.error('❌ GAGAL: Firebase Admin SDK belum dapat terhubung.');
        console.error('Penyebab: File data/serviceAccountKey.json belum ditemukan.');
        console.error('\nLangkah:');
        console.error('1. Buka Firebase Console: https://console.firebase.google.com/u/1/project/ppdb-sd-n-salatiga-03/settings/serviceaccounts/adminsdk');
        console.error('2. Klik tombol "Generate new private key" (Buat kunci privat baru).');
        console.error('3. Simpan file JSON tersebut dengan nama: serviceAccountKey.json di folder data/');
        console.error('4. Jalankan kembali: node scripts/syncToFirestore.js');
        process.exit(1);
    }

    const csvFile = path.resolve(__dirname, '..', 'data', 'pendaftar.csv');
    const students = readCSVFile(csvFile, STUDENT_CSV_HEADERS);

    console.log(`📊 Ditemukan ${students.length} data pendaftar di data/pendaftar.csv`);
    console.log('⏳ Mengunggah ke koleksi Firestore "pendaftar"...');

    const result = await batchSyncStudentsToFirestore(students);

    if (result.success) {
        console.log(`\n✅ SUKSES! Sebanyak ${result.count} data pendaftar berhasil masuk ke Firestore!`);
        console.log('Buka konsol Firebase Anda untuk melihat data:');
        console.log('https://console.firebase.google.com/u/1/project/ppdb-sd-n-salatiga-03/firestore/databases/-default-/data\n');
    } else {
        console.error('❌ Error saat sinkronisasi:', result.error);
    }
}

run().catch(err => {
    console.error('Fatal error:', err);
});
