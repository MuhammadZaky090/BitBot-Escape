<?php
/**
 * BitBot Escape — Konfigurasi basis data (CONTOH)
 * Salin file ini sebagai config.php dan isi dengan kredensial sebenarnya.
 * JANGAN pernah commit config.php ke repositori.
 */
return [
    'db_host'     => 'localhost',
    'db_name'     => 'nama_database_anda',
    'db_user'     => 'user_database_anda',
    'db_pass'     => 'password_database_anda',
    'db_charset'  => 'utf8mb4',

    // Batas rate limiting (per menit)
    'rate_limit_per_ip'           => 1200,   // Tinggi: satu IP sekolah dipakai banyak siswa
    'rate_limit_per_student_code' => 60,     // Per kode siswa per menit

    // Batas ukuran body request (byte)
    'max_body_size' => 131072,  // 128 KB

    // Batas jumlah rekaman per batch
    'max_batch_size' => 20,

    // Kata sandi admin (hash dengan password_hash)
    // Jalankan: php -r "echo password_hash('kata_sandi_anda', PASSWORD_DEFAULT);"
    'admin_password_hash' => '$2y$10$PLACEHOLDER_HASH_GANTI_INI',
];
