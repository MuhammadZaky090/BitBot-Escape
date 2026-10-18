-- BitBot Escape — Skema basis data percobaan siswa
-- Kompatibel: MySQL 5.7+ / MariaDB 10.3+ (cPanel shared hosting)
-- Charset: utf8mb4 untuk dukungan emoji dan karakter multibahasa

CREATE TABLE IF NOT EXISTS `attempts` (
  `id`              CHAR(36)        NOT NULL COMMENT 'UUID dari client (crypto.randomUUID)',
  `student_code`    VARCHAR(20)     NOT NULL COMMENT 'Kode pseudonim siswa (misal X-TKJ1-07)',
  `session_id`      CHAR(36)        NOT NULL COMMENT 'UUID unik per sesi pemuatan halaman',
  `level`           TINYINT UNSIGNED NOT NULL COMMENT 'Nomor level (1-3)',
  `attempt_no`      SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Percobaan ke-N per siswa+level',
  `result`          ENUM('win','fail','syntax_error','quota_lock') NOT NULL COMMENT 'Hasil eksekusi',
  `error_type`      VARCHAR(30)     DEFAULT NULL COMMENT 'Jenis error engine (tabrak_dinding, loop_tak_berujung, dll)',
  `cost`            SMALLINT UNSIGNED DEFAULT NULL COMMENT 'Jumlah pernyataan (biaya AST)',
  `steps`           SMALLINT UNSIGNED DEFAULT NULL COMMENT 'Total langkah robot',
  `hints_used`      TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Jumlah petunjuk yang dibuka',
  `score`           TINYINT UNSIGNED DEFAULT NULL COMMENT 'Skor Berpikir Komputasional (0-100)',
  `stars`           TINYINT UNSIGNED DEFAULT NULL COMMENT 'Jumlah bintang (0-3)',
  `duration_ms`     INT UNSIGNED    DEFAULT NULL COMMENT 'Durasi pengerjaan dalam milidetik',
  `client_ts`       DATETIME(3)     NOT NULL COMMENT 'Timestamp klien saat percobaan selesai',
  `build_version`   VARCHAR(20)     NOT NULL COMMENT 'Versi build game (misal 0.4.0)',
  `program_src`     TEXT            DEFAULT NULL COMMENT 'Kode Python yang dihasilkan (base64, maks 4KB)',
  `browser_family`  VARCHAR(30)     DEFAULT NULL COMMENT 'Keluarga browser terpotong (Chrome, Firefox, dll)',
  `server_received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Waktu server menerima data',
  PRIMARY KEY (`id`),
  INDEX `idx_student_level` (`student_code`, `level`),
  INDEX `idx_received` (`server_received_at`),
  INDEX `idx_build` (`build_version`),
  INDEX `idx_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Rekaman percobaan siswa BitBot Escape untuk penelitian pretest/posttest';
