<?php
/**
 * BitBot Escape — Konfigurasi basis data (CONTOH / TEMPLAT)
 *
 * Cara pakai:
 *   1. Salin file ini menjadi `backend/config.php` (tanpa "sample").
 *   2. Isi nilai di bawah sesuai server Anda.
 *   3. JANGAN pernah commit `config.php` — sudah masuk .gitignore.
 *
 * --- Nilai untuk Laragon (Windows, bawaan) -------------------------
 *   db_host = 127.0.0.1
 *   db_name = bitbot_escape
 *   db_user = root
 *   db_pass = ''            (kosong — Laragon tidak memberi password default)
 *
 * --- Nilai untuk XAMPP (bawaan) ------------------------------------
 *   db_host = 127.0.0.1
 *   db_name = bitbot_escape
 *   db_user = root
 *   db_pass = ''            (kosong, atau password MySQL yang Anda set)
 *
 * --- Nilai untuk cPanel / hosting berbayar -------------------------
 *   db_host = localhost
 *   db_name = cpanel_akun_bitbot_escape
 *   db_user = cpanel_akun_bitbot
 *   db_pass = (password dari cPanel > MySQL Databases)
 *
 * Lihat backend/PANDUAN-LARAGON.md untuk panduan lengkap pemula.
 */
return [
    'db_host'     => '127.0.0.1',
    'db_name'     => 'bitbot_escape',
    'db_user'     => 'root',
    'db_pass'     => '',
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
