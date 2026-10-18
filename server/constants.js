/**
 * Database & System Constants for PPDB SD SALATIGA 03
 * Struktur 34 Kolom Utama + No. Pendaftaran (Primary Key)
 */

const STUDENT_34_COLUMNS = [
    { key: 'nama_lengkap', label: 'Nama Peserta Didik' },
    { key: 'nik', label: 'NIK Peserta Didik' },
    { key: 'jenis_kelamin', label: 'Jenis Kelamin' },
    { key: 'nisn', label: 'NISN' },
    { key: 'alamat', label: 'Alamat Rumah' },
    { key: 'tempat_lahir', label: 'Tempat Lahir' },
    { key: 'tanggal_lahir', label: 'Tanggal Lahir' },
    { key: 'anak_ke', label: 'Anak Ke-' },
    { key: 'tinggi_badan', label: 'Tinggi Badan' },
    { key: 'berat_badan', label: 'Berat Badan' },
    { key: 'hobi', label: 'Hobi' },
    { key: 'cita_cita', label: 'Cita-Cita' },
    { key: 'no_hp_siswa', label: 'No. HP Peserta Didik' },
    { key: 'email_siswa', label: 'Alamat Email Aktif Peserta Didik' },
    { key: 'sekolah_asal', label: 'Nama Sekolah Asal' },
    { key: 'tahun_lulus', label: 'Tahun Lulus' },
    { key: 'tanggal_daftar', label: 'Tanggal Pendaftaran' },
    { key: 'no_kk', label: 'No. Kartu Keluarga' },
    { key: 'nama_ayah', label: 'Nama Ayah' },
    { key: 'nik_ayah', label: 'NIK Ayah' },
    { key: 'pekerjaan_ayah', label: 'Pekerjaan Ayah' },
    { key: 'penghasilan_ayah', label: 'Penghasilan Ayah' },
    { key: 'pendidikan_ayah', label: 'Pendidikan Terakhir Ayah' },
    { key: 'nama_ibu', label: 'Nama Ibu' },
    { key: 'nik_ibu', label: 'NIK Ibu' },
    { key: 'pekerjaan_ibu', label: 'Pekerjaan Ibu' },
    { key: 'penghasilan_ibu', label: 'Penghasilan Ibu' },
    { key: 'pendidikan_ibu', label: 'Pendidikan Terakhir Ibu' },
    { key: 'no_hp_orang_tua', label: 'No. HP Orang Tua' },
    { key: 'penerima_pip', label: 'Penerima PIP' },
    { key: 'keterangan_penghasilan_ayah', label: 'Keterangan Penghasilan Ayah' },
    { key: 'keterangan_penghasilan_ibu', label: 'Keterangan Penghasilan Ibu' },
    { key: 'email_orang_tua', label: 'Email Orang Tua' },
    { key: 'status_verifikasi', label: 'Status Verifikasi Data' }
];

// Internal CSV storage headers: no_pendaftaran + 34 columns + catatan_verifikasi
const STUDENT_CSV_HEADERS = [
    'no_pendaftaran',
    ...STUDENT_34_COLUMNS.map(c => c.key),
    'catatan_verifikasi'
];

// Audit log headers
const AUDIT_LOG_HEADERS = [
    'waktu',
    'admin',
    'aktivitas',
    'data',
    'ip'
];

// 4 Nilai Status Verifikasi Data resmi
const VERIFICATION_STATUSES = [
    'Belum Dicek',
    'Valid',
    'Perlu Dicek',
    'Perlu Perbaikan'
];

// Backward-compatible statuses for student tracking
const VALID_STATUSES = [
    'Belum Dicek',
    'Valid',
    'Perlu Dicek',
    'Perlu Perbaikan',
    'Baru',
    'Menunggu Verifikasi',
    'Berkas Perlu Diperbaiki',
    'Terverifikasi',
    'Diterima',
    'Tidak Diterima',
    'Daftar Ulang'
];

// 5 Kategori Pilihan Penghasilan Orang Tua
const INCOME_CATEGORIES = [
    'Di bawah Rp500.000',
    'Rp500.000–Rp1.000.000',
    'Rp1.000.001–Rp2.000.000',
    'Rp2.000.001–Rp5.000.000',
    'Di atas Rp5.000.000'
];

// Opsi Penerima PIP
const PIP_OPTIONS = [
    'Ya',
    'Tidak'
];

// Flexible Header Aliases for CSV Import matching
const HEADER_ALIAS_MAP = {
    // 1. Nama
    'nama peserta didik': 'nama_lengkap',
    'nama lengkap': 'nama_lengkap',
    'nama': 'nama_lengkap',
    'nama_lengkap': 'nama_lengkap',

    // 2. NIK Siswa
    'nik peserta didik': 'nik',
    'nik calon siswa': 'nik',
    'nik siswa': 'nik',
    'nik anak': 'nik',
    'nik': 'nik',

    // 3. Jenis Kelamin
    'jenis kelamin': 'jenis_kelamin',
    'jk': 'jenis_kelamin',
    'gender': 'jenis_kelamin',
    'jenis_kelamin': 'jenis_kelamin',

    // 4. NISN
    'nisn': 'nisn',

    // 5. Alamat
    'alamat rumah': 'alamat',
    'alamat tinggal': 'alamat',
    'alamat lengkap': 'alamat',
    'alamat': 'alamat',

    // 6. Tempat Lahir
    'tempat lahir': 'tempat_lahir',
    'tempat_lahir': 'tempat_lahir',

    // 7. Tanggal Lahir
    'tanggal lahir': 'tanggal_lahir',
    'tgl lahir': 'tanggal_lahir',
    'tanggal_lahir': 'tanggal_lahir',

    // 8. Anak Ke-
    'anak ke-': 'anak_ke',
    'anak ke': 'anak_ke',
    'anak_ke': 'anak_ke',

    // 9. Tinggi Badan
    'tinggi badan': 'tinggi_badan',
    'tb': 'tinggi_badan',
    'tinggi_badan': 'tinggi_badan',

    // 10. Berat Badan
    'berat badan': 'berat_badan',
    'bb': 'berat_badan',
    'berat_badan': 'berat_badan',

    // 11. Hobi
    'hobi': 'hobi',
    'kegemaran': 'hobi',

    // 12. Cita-Cita
    'cita-cita': 'cita_cita',
    'cita cita': 'cita_cita',
    'cita_cita': 'cita_cita',

    // 13. No HP Peserta Didik
    'no. hp peserta didik': 'no_hp_siswa',
    'no hp peserta didik': 'no_hp_siswa',
    'no hp siswa': 'no_hp_siswa',
    'no_hp_siswa': 'no_hp_siswa',

    // 14. Email Peserta Didik
    'alamat email aktif peserta didik': 'email_siswa',
    'email peserta didik': 'email_siswa',
    'email siswa': 'email_siswa',
    'email_siswa': 'email_siswa',

    // 15. Sekolah Asal
    'nama sekolah asal': 'sekolah_asal',
    'sekolah asal': 'sekolah_asal',
    'asal sekolah': 'sekolah_asal',
    'sekolah_asal': 'sekolah_asal',

    // 16. Tahun Lulus
    'tahun lulus': 'tahun_lulus',
    'tahun_lulus': 'tahun_lulus',

    // 17. Tanggal Pendaftaran
    'tanggal pendaftaran': 'tanggal_daftar',
    'tgl pendaftaran': 'tanggal_daftar',
    'tanggal daftar': 'tanggal_daftar',
    'tanggal_daftar': 'tanggal_daftar',

    // 18. No KK
    'no. kartu keluarga': 'no_kk',
    'no kartu keluarga': 'no_kk',
    'nomor kk': 'no_kk',
    'no kk': 'no_kk',
    'no_kk': 'no_kk',

    // 19. Nama Ayah
    'nama ayah': 'nama_ayah',
    'nama_ayah': 'nama_ayah',

    // 20. NIK Ayah
    'nik ayah': 'nik_ayah',
    'nik_ayah': 'nik_ayah',

    // 21. Pekerjaan Ayah
    'pekerjaan ayah': 'pekerjaan_ayah',
    'pekerjaan_ayah': 'pekerjaan_ayah',

    // 22. Penghasilan Ayah
    'penghasilan ayah': 'penghasilan_ayah',
    'penghasilan_ayah': 'penghasilan_ayah',

    // 23. Pendidikan Terakhir Ayah
    'pendidikan terakhir ayah': 'pendidikan_ayah',
    'pendidikan ayah': 'pendidikan_ayah',
    'pendidikan_ayah': 'pendidikan_ayah',

    // 24. Nama Ibu
    'nama ibu': 'nama_ibu',
    'nama_ibu': 'nama_ibu',

    // 25. NIK Ibu
    'nik ibu': 'nik_ibu',
    'nik_ibu': 'nik_ibu',

    // 26. Pekerjaan Ibu
    'pekerjaan ibu': 'pekerjaan_ibu',
    'pekerjaan_ibu': 'pekerjaan_ibu',

    // 27. Penghasilan Ibu
    'penghasilan ibu': 'penghasilan_ibu',
    'penghasilan_ibu': 'penghasilan_ibu',

    // 28. Pendidikan Terakhir Ibu
    'pendidikan terakhir ibu': 'pendidikan_ibu',
    'pendidikan ibu': 'pendidikan_ibu',
    'pendidikan_ibu': 'pendidikan_ibu',

    // 29. No HP Orang Tua
    'no. hp orang tua': 'no_hp_orang_tua',
    'no hp orang tua': 'no_hp_orang_tua',
    'no hp ayah': 'no_hp_orang_tua',
    'no hp ibu': 'no_hp_orang_tua',
    'no_hp_orang_tua': 'no_hp_orang_tua',

    // 30. Penerima PIP
    'penerima pip': 'penerima_pip',
    'pip': 'penerima_pip',
    'status pip': 'penerima_pip',
    'penerima_pip': 'penerima_pip',

    // 31. Keterangan Penghasilan Ayah
    'keterangan penghasilan ayah': 'keterangan_penghasilan_ayah',
    'ket penghasilan ayah': 'keterangan_penghasilan_ayah',
    'keterangan_penghasilan_ayah': 'keterangan_penghasilan_ayah',

    // 32. Keterangan Penghasilan Ibu
    'keterangan penghasilan ibu': 'keterangan_penghasilan_ibu',
    'ket penghasilan ibu': 'keterangan_penghasilan_ibu',
    'keterangan_penghasilan_ibu': 'keterangan_penghasilan_ibu',

    // 33. Email Orang Tua
    'email orang tua': 'email_orang_tua',
    'email wali': 'email_orang_tua',
    'email_orang_tua': 'email_orang_tua',

    // 34. Status Verifikasi Data
    'status verifikasi data': 'status_verifikasi',
    'status verifikasi': 'status_verifikasi',
    'verifikasi': 'status_verifikasi',
    'status': 'status_verifikasi',
    'status_verifikasi': 'status_verifikasi',

    // Optional Registration No
    'no. pendaftaran': 'no_pendaftaran',
    'no pendaftaran': 'no_pendaftaran',
    'nomor pendaftaran': 'no_pendaftaran',
    'no_pendaftaran': 'no_pendaftaran'
};

module.exports = {
    STUDENT_34_COLUMNS,
    STUDENT_CSV_HEADERS,
    AUDIT_LOG_HEADERS,
    VERIFICATION_STATUSES,
    VALID_STATUSES,
    INCOME_CATEGORIES,
    PIP_OPTIONS,
    HEADER_ALIAS_MAP
};
