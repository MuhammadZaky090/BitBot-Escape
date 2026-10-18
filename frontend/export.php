<?php
/**
 * BitBot Escape — Export to CSV
 */
declare(strict_types=1);
$configPath = __DIR__ . '/../config.php';
if (!file_exists($configPath)) {
    $configPath = dirname(__DIR__, 2) . '/config.php';
}
if (!file_exists($configPath)) {
    die('Config not found');
}
$cfg = require $configPath;

try {
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s',
        $cfg['db_host'], $cfg['db_name'], $cfg['db_charset'] ?? 'utf8mb4');
    $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
} catch (PDOException $e) {
    die('Database connection failed');
}

$stmt = $pdo->query("SELECT * FROM attempts ORDER BY server_received_at DESC");
$attempts = $stmt->fetchAll();

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=bitbot_attempts_' . date('Y-m-d_His') . '.csv');

// UTF-8 BOM for Excel
echo "\xEF\xBB\xBF";

$headers = ['ID', 'Student Code', 'Session ID', 'Level', 'Attempt No', 'Result', 'Error Type',
            'Cost', 'Steps', 'Hints Used', 'Score', 'Stars', 'Duration (ms)',
            'Client Time', 'Build Version', 'Browser', 'Server Received'];
echo implode(',', $headers) . "\n";

foreach ($attempts as $row) {
    $line = [
        $row['id'],
        $row['student_code'],
        $row['session_id'],
        $row['level'],
        $row['attempt_no'],
        $row['result'],
        $row['error_type'] ?? '',
        $row['cost'] ?? '',
        $row['steps'] ?? '',
        $row['hints_used'] ?? 0,
        $row['score'] ?? '',
        $row['stars'] ?? '',
        $row['duration_ms'] ?? '',
        $row['client_ts'],
        $row['build_version'],
        $row['browser_family'] ?? '',
        $row['server_received_at']
    ];
    // Escape commas and quotes
    echo '"' . implode('","', array_map(function($v) {
        return str_replace(['"','\\'], ['""','\\\\'], (string)$v);
    }, $line)) . "\"\n";
}
