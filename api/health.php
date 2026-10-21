<?php
/**
 * BitBot Escape — Health Check Endpoint
 * Endpoint: GET /api/health.php
 * Mengembalikan 200 JSON jika koneksi database berhasil
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$possiblePaths = [
    __DIR__ . '/config.php',
    __DIR__ . '/../config.php',
    dirname(__DIR__) . '/backend/config.php',
];
$configPath = null;
foreach ($possiblePaths as $p) {
    if (file_exists($p)) { $configPath = $p; break; }
}
if (!$configPath) {
    http_response_code(503);
    echo json_encode(['status' => 'error', 'message' => 'config.php tidak ditemukan']);
    exit;
}
$cfg = require $configPath;

try {
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s',
        $cfg['db_host'], $cfg['db_name'], $cfg['db_charset'] ?? 'utf8mb4');
    $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    $row = $pdo->query('SELECT COUNT(*) AS total FROM `attempts`')->fetch(PDO::FETCH_ASSOC);
    echo json_encode([
        'status'         => 'ok',
        'total_attempts' => (int)$row['total'],
        'server_time'    => date('c'),
    ]);
} catch (PDOException $e) {
    http_response_code(503);
    echo json_encode(['status' => 'error', 'message' => 'Database tidak merespons']);
}
