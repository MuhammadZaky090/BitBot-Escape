<?php
/**
 * BitBot Escape — API: Terima batch percobaan siswa
 * Endpoint: POST /api/submit.php
 * Content-Type: application/json
 * Body: { "records": [ { id, student_code, ... }, ... ] }
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// Hanya terima POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// Muat konfigurasi - cari di berbagai lokasi
$possiblePaths = [
    __DIR__ . '/config.php',                           // frontend/config.php
    __DIR__ . '/../config.php',                        // root config.php
    dirname(__DIR__) . '/backend/config.php',           // backend/config.php
];
$configPath = null;
foreach ($possiblePaths as $p) {
    if (file_exists($p)) { $configPath = $p; break; }
}
if (!$configPath) {
    http_response_code(500);
    echo json_encode(['error' => 'Konfigurasi server belum dipasang. Buat config.php dari config.sample.php']);
    exit;
}
$cfg = require $configPath;

// Baca body dan cek ukuran
$rawBody = file_get_contents('php://input');
if (strlen($rawBody) > ($cfg['max_body_size'] ?? 131072)) {
    http_response_code(413);
    echo json_encode(['error' => 'Payload terlalu besar (maks 128 KB)']);
    exit;
}

// Validasi Content-Type
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($ct, 'application/json') === false) {
    http_response_code(415);
    echo json_encode(['error' => 'Content-Type harus application/json']);
    exit;
}

// Parse JSON
$payload = json_decode($rawBody, true);
if (!is_array($payload) || !isset($payload['records']) || !is_array($payload['records'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Format JSON tidak valid: butuh { "records": [...] }']);
    exit;
}

$records = $payload['records'];
$maxBatch = $cfg['max_batch_size'] ?? 20;
if (count($records) === 0) {
    echo json_encode(['accepted' => [], 'duplicates' => [], 'errors' => []]);
    exit;
}
if (count($records) > $maxBatch) {
    http_response_code(400);
    echo json_encode(['error' => "Maksimal $maxBatch rekaman per batch"]);
    exit;
}

// --- Rate limiting sederhana berbasis file (kompatibel shared hosting) ---
$rateLimitDir = sys_get_temp_dir() . '/bitbot_ratelimit';
if (!is_dir($rateLimitDir)) @mkdir($rateLimitDir, 0755, true);

/**
 * Cek rate limit: tulis timestamp ke file, hitung yang masih dalam jendela waktu
 */
function checkRateLimit(string $key, int $maxPerMinute, string $dir): bool {
    $file = $dir . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '_', $key) . '.log';
    $now = time();
    $window = 60;

    // Baca entri yang ada
    $entries = [];
    if (file_exists($file)) {
        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $ts = (int)$line;
            if ($now - $ts < $window) $entries[] = $ts;
        }
    }

    if (count($entries) >= $maxPerMinute) return false;

    // Tambah entri baru
    $entries[] = $now;
    file_put_contents($file, implode("\n", $entries) . "\n", LOCK_EX);
    return true;
}

$clientIp = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if (!checkRateLimit('ip_' . $clientIp, $cfg['rate_limit_per_ip'] ?? 1200, $rateLimitDir)) {
    http_response_code(429);
    echo json_encode(['error' => 'Rate limit per IP terlampaui, coba lagi nanti']);
    exit;
}

// Cek rate limit per student_code (ambil dari rekaman pertama)
$firstStudentCode = $records[0]['student_code'] ?? '';
if ($firstStudentCode !== '') {
    if (!checkRateLimit('sc_' . $firstStudentCode, $cfg['rate_limit_per_student_code'] ?? 60, $rateLimitDir)) {
        http_response_code(429);
        echo json_encode(['error' => 'Rate limit per kode siswa terlampaui, coba lagi nanti']);
        exit;
    }
}

// --- Koneksi Database ---
try {
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s',
        $cfg['db_host'], $cfg['db_name'], $cfg['db_charset'] ?? 'utf8mb4');
    $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(['error' => 'Database tidak tersedia, coba lagi nanti', 'retryable' => true]);
    exit;
}

// --- Validasi dan Insert ---
$accepted   = [];
$duplicates = [];
$errors     = [];

// Daftar nilai yang valid
$validResults    = ['win', 'fail', 'syntax_error', 'quota_lock'];
$validErrorTypes = [
    null, '', 'sintaks', 'tabrak_dinding', 'tidak_ada_item',
    'loop_tak_berujung', 'tidak_sampai', 'item_tersisa', 'melebihi_kuota'
];

/**
 * Validasi satu rekaman. Mengembalikan array [bool $valid, string $errorMsg, array $clean]
 */
function validateRecord(array $r): array {
    global $validResults, $validErrorTypes;

    // id: UUID string
    if (empty($r['id']) || !is_string($r['id']) || strlen($r['id']) > 36) {
        return [false, 'id tidak valid', []];
    }
    $id = substr(trim($r['id']), 0, 36);

    // student_code: 3-20 karakter alfanumerik + tanda hubung
    if (empty($r['student_code']) || !is_string($r['student_code']) ||
        !preg_match('/^[A-Za-z0-9\-]{3,20}$/', $r['student_code'])) {
        return [false, 'student_code tidak valid', []];
    }
    $studentCode = $r['student_code'];

    // session_id
    if (empty($r['session_id']) || !is_string($r['session_id']) || strlen($r['session_id']) > 36) {
        return [false, 'session_id tidak valid', []];
    }
    $sessionId = substr(trim($r['session_id']), 0, 36);

    // level: 1-3
    if (!isset($r['level']) || !is_numeric($r['level']) || $r['level'] < 1 || $r['level'] > 10) {
        return [false, 'level tidak valid', []];
    }
    $level = (int)$r['level'];

    // attempt_no
    $attemptNo = isset($r['attempt_no']) ? (int)$r['attempt_no'] : 1;
    if ($attemptNo < 1 || $attemptNo > 9999) $attemptNo = 1;

    // result
    if (empty($r['result']) || !in_array($r['result'], $validResults, true)) {
        return [false, 'result tidak valid (harus: ' . implode(', ', $validResults) . ')', []];
    }
    $result = $r['result'];

    // error_type (opsional)
    $errorType = $r['error_type'] ?? null;
    if ($errorType !== null && $errorType !== '') {
        $errorType = substr((string)$errorType, 0, 30);
    } else {
        $errorType = null;
    }

    // Numerik opsional
    $cost     = isset($r['cost'])     ? max(0, min(9999, (int)$r['cost']))     : null;
    $steps    = isset($r['steps'])    ? max(0, min(9999, (int)$r['steps']))    : null;
    $hints    = isset($r['hints_used']) ? max(0, min(10, (int)$r['hints_used'])) : 0;
    $score    = isset($r['score'])    ? max(0, min(100, (int)$r['score']))     : null;
    $stars    = isset($r['stars'])    ? max(0, min(3, (int)$r['stars']))       : null;
    $duration = isset($r['duration_ms']) ? max(0, min(3600000, (int)$r['duration_ms'])) : null;

    // client_ts: ISO 8601 string
    if (empty($r['client_ts']) || !is_string($r['client_ts'])) {
        return [false, 'client_ts tidak valid', []];
    }
    $clientTs = substr($r['client_ts'], 0, 30);

    // build_version
    if (empty($r['build_version']) || !is_string($r['build_version'])) {
        return [false, 'build_version tidak valid', []];
    }
    $buildVersion = substr($r['build_version'], 0, 20);

    // program_src: base64 encoded, maks 4KB setelah decode
    $programSrc = null;
    if (!empty($r['program_src']) && is_string($r['program_src'])) {
        $decoded = base64_decode($r['program_src'], true);
        if ($decoded !== false && strlen($decoded) <= 4096) {
            $programSrc = $r['program_src']; // Simpan bentuk base64
        }
        // Kalau terlalu besar atau tidak valid, abaikan saja (bukan error)
    }

    // browser_family
    $browserFamily = null;
    if (!empty($r['browser_family']) && is_string($r['browser_family'])) {
        $browserFamily = substr(preg_replace('/[^a-zA-Z0-9 .\/]/', '', $r['browser_family']), 0, 30);
    }

    return [true, '', [
        'id'            => $id,
        'student_code'  => $studentCode,
        'session_id'    => $sessionId,
        'level'         => $level,
        'attempt_no'    => $attemptNo,
        'result'        => $result,
        'error_type'    => $errorType,
        'cost'          => $cost,
        'steps'         => $steps,
        'hints_used'    => $hints,
        'score'         => $score,
        'stars'         => $stars,
        'duration_ms'   => $duration,
        'client_ts'     => $clientTs,
        'build_version' => $buildVersion,
        'program_src'   => $programSrc,
        'browser_family' => $browserFamily,
    ]];
}

// Proses semua rekaman dalam satu transaksi
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO `attempts`
         (`id`, `student_code`, `session_id`, `level`, `attempt_no`, `result`, `error_type`,
          `cost`, `steps`, `hints_used`, `score`, `stars`, `duration_ms`, `client_ts`,
          `build_version`, `program_src`, `browser_family`)
         VALUES
         (:id, :student_code, :session_id, :level, :attempt_no, :result, :error_type,
          :cost, :steps, :hints_used, :score, :stars, :duration_ms, :client_ts,
          :build_version, :program_src, :browser_family)'
    );

    foreach ($records as $idx => $rec) {
        if (!is_array($rec)) {
            $errors[] = ['index' => $idx, 'error' => 'Rekaman bukan objek'];
            continue;
        }
        [$valid, $errMsg, $clean] = validateRecord($rec);
        if (!$valid) {
            $errors[] = ['index' => $idx, 'id' => $rec['id'] ?? null, 'error' => $errMsg];
            continue;
        }

        $stmt->execute([
            ':id'            => $clean['id'],
            ':student_code'  => $clean['student_code'],
            ':session_id'    => $clean['session_id'],
            ':level'         => $clean['level'],
            ':attempt_no'    => $clean['attempt_no'],
            ':result'        => $clean['result'],
            ':error_type'    => $clean['error_type'],
            ':cost'          => $clean['cost'],
            ':steps'         => $clean['steps'],
            ':hints_used'    => $clean['hints_used'],
            ':score'         => $clean['score'],
            ':stars'         => $clean['stars'],
            ':duration_ms'   => $clean['duration_ms'],
            ':client_ts'     => $clean['client_ts'],
            ':build_version' => $clean['build_version'],
            ':program_src'   => $clean['program_src'],
            ':browser_family' => $clean['browser_family'],
        ]);

        if ($stmt->rowCount() > 0) {
            $accepted[] = $clean['id'];
        } else {
            $duplicates[] = $clean['id'];
        }
    }

    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    http_response_code(503);
    echo json_encode(['error' => 'Gagal menyimpan data, coba lagi nanti', 'retryable' => true]);
    exit;
}

echo json_encode([
    'accepted'   => $accepted,
    'duplicates' => $duplicates,
    'errors'     => $errors,
]);
