<?php
/**
 * BitBot Escape — Admin Dashboard
 * View telemetry data from students
 * Access: http://yourdomain.com/admin.php (protect with .htpasswd or VPN)
 */
declare(strict_types=1);
session_start();

// Load config
$configPath = __DIR__ . '/../config.php';
if (!file_exists($configPath)) {
    $configPath = dirname(__DIR__, 2) . '/config.php';
}
if (!file_exists($configPath)) {
    die('Config not found');
}
$cfg = require $configPath;

// Database connection
try {
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s',
        $cfg['db_host'], $cfg['db_name'], $cfg['db_charset'] ?? 'utf8mb4');
    $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    die('Database connection failed: ' . $e->getMessage());
}

// Handle filters
$where = [];
$params = [];
if (!empty($_GET['student'])) {
    $where[] = "student_code = ?";
    $params[] = $_GET['student'];
}
if (!empty($_GET['level'])) {
    $where[] = "level = ?";
    $params[] = (int)$_GET['level'];
}
if (!empty($_GET['result'])) {
    $where[] = "result = ?";
    $params[] = $_GET['result'];
}
$whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

// Stats
$stats = $pdo->query("
    SELECT
        COUNT(*) as total,
        SUM(result = 'win') as wins,
        SUM(result = 'fail') as fails,
        COUNT(DISTINCT student_code) as students
    FROM attempts
")->fetch();

// Recent attempts
$stmt = $pdo->prepare("
    SELECT * FROM attempts
    $whereSql
    ORDER BY server_received_at DESC
    LIMIT 100
");
$stmt->execute($params);
$attempts = $stmt->fetchAll();

// Level breakdown
$levelStats = $pdo->query("
    SELECT
        level,
        COUNT(*) as total,
        SUM(result = 'win') as wins,
        ROUND(AVG(score), 1) as avg_score,
        ROUND(AVG(cost), 1) as avg_cost
    FROM attempts
    GROUP BY level
    ORDER BY level
")->fetchAll();
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BitBot Escape — Admin Dashboard</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0a0e16; color: #e8ecf4; padding: 20px; }
    h1 { color: #ffd166; margin-bottom: 20px; }
    h2 { color: #93a0b8; margin: 20px 0 10px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 30px; }
    .stat-card { background: #151a26; border: 1px solid #313b54; border-radius: 12px; padding: 16px; }
    .stat-label { font-size: 12px; color: #5b657c; text-transform: uppercase; letter-spacing: 0.8px; }
    .stat-value { font-size: 28px; font-weight: 700; color: #ffd166; margin-top: 4px; }
    .filters { background: #151a26; border: 1px solid #313b54; border-radius: 12px; padding: 16px; margin-bottom: 20px; display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
    .filter-group { display: flex; flex-direction: column; gap: 4px; }
    .filter-group label { font-size: 12px; color: #5b657c; }
    .filter-group input, .filter-group select { background: #222a3d; border: 1px solid #313b54; border-radius: 6px; padding: 8px 12px; color: #e8ecf4; }
    .filter-group button { background: #3aa79d; border: none; border-radius: 6px; padding: 8px 16px; color: #0a0e16; font-weight: 600; cursor: pointer; }
    .filter-group button:hover { filter: brightness(1.1); }
    table { width: 100%; border-collapse: collapse; background: #151a26; border-radius: 12px; overflow: hidden; }
    th { background: #222a3d; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #5b657c; }
    td { padding: 12px; border-top: 1px solid #222a3d; font-size: 14px; }
    tr:hover td { background: #1a1f2e; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-win { background: rgba(47, 158, 95, 0.25); color: #7ee2a8; }
    .badge-fail { background: rgba(255, 107, 107, 0.25); color: #ff6b6b; }
    .badge-error { background: rgba(213, 128, 58, 0.25); color: #d5803a; }
    .code-block { background: #10141f; border-radius: 6px; padding: 8px; font-family: monospace; font-size: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .level-breakdown { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 30px; }
    .level-card { background: #151a26; border: 1px solid #313b54; border-radius: 12px; padding: 16px; }
    .level-card h3 { color: #ffd166; margin-bottom: 8px; }
    .level-stats { display: flex; gap: 16px; font-size: 13px; color: #93a0b8; }
    .empty { text-align: center; padding: 40px; color: #5b657c; }
    .export-link { color: #3a7bd5; text-decoration: none; }
    .export-link:hover { text-decoration: underline; }
</style>
</head>
<body>
<h1>🤖 BitBot Escape — Admin Dashboard</h1>

<div class="stats">
    <div class="stat-card">
        <div class="stat-label">Total Percobaan</div>
        <div class="stat-value"><?= number_format($stats['total']) ?></div>
    </div>
    <div class="stat-card">
        <div class="stat-label">Siswa Unique</div>
        <div class="stat-value"><?= number_format($stats['students']) ?></div>
    </div>
    <div class="stat-card">
        <div class="stat-label">Berhasil</div>
        <div class="stat-value" style="color: #7ee2a8;"><?= number_format($stats['wins']) ?></div>
    </div>
    <div class="stat-card">
        <div class="stat-label">Gagal</div>
        <div class="stat-value" style="color: #ff6b6b;"><?= number_format($stats['fails']) ?></div>
    </div>
</div>

<h2>📊 Per Level</h2>
<div class="level-breakdown">
    <?php foreach ($levelStats as $ls): ?>
    <div class="level-card">
        <h3>Level <?= $ls['level'] ?></h3>
        <div class="level-stats">
            <span>Total: <?= $ls['total'] ?></span>
            <span>Win: <?= $ls['wins'] ?></span>
            <span>Avg Score: <?= $ls['avg_score'] ?></span>
        </div>
    </div>
    <?php endforeach; ?>
    <?php if (empty($levelStats)): ?>
    <p class="empty">Belum ada data</p>
    <?php endif; ?>
</div>

<h2>🔍 Filter & Export</h2>
<form class="filters" method="GET">
    <div class="filter-group">
        <label>Kode Siswa</label>
        <input type="text" name="student" value="<?= htmlspecialchars($_GET['student'] ?? '') ?>" placeholder="X-TKJ1-07">
    </div>
    <div class="filter-group">
        <label>Level</label>
        <select name="level">
            <option value="">Semua</option>
            <?php for ($i = 1; $i <= 10; $i++): ?>
            <option value="<?= $i ?>" <?= (isset($_GET['level']) && $_GET['level'] == $i) ? 'selected' : '' ?>>Level <?= $i ?></option>
            <?php endfor; ?>
        </select>
    </div>
    <div class="filter-group">
        <label>Hasil</label>
        <select name="result">
            <option value="">Semua</option>
            <option value="win" <?= ($_GET['result'] ?? '') === 'win' ? 'selected' : '' ?>>Menang</option>
            <option value="fail" <?= ($_GET['result'] ?? '') === 'fail' ? 'selected' : '' ?>>Gagal</option>
        </select>
    </div>
    <div class="filter-group">
        <label>&nbsp;</label>
        <button type="submit">Filter</button>
    </div>
    <div class="filter-group">
        <label>&nbsp;</label>
        <a href="export.php" class="export-link" style="background: #222a3d; padding: 8px 16px; border-radius: 6px; color: #3a7bd5;">📥 Export CSV</a>
    </div>
</form>

<h2>📋 Recent Attempts (<?= count($attempts) ?> hasil)</h2>
<table>
    <thead>
        <tr>
            <th>Waktu</th>
            <th>Siswa</th>
            <th>Level</th>
            <th>Hasil</th>
            <th>Skor</th>
            <th>Cost</th>
            <th>Steps</th>
            <th>Petunjuk</th>
            <th>Durasi</th>
            <th>Browser</th>
        </tr>
    </thead>
    <tbody>
        <?php if (empty($attempts)): ?>
        <tr><td colspan="10" class="empty">Belum ada data percobaan</td></tr>
        <?php else: ?>
        <?php foreach ($attempts as $a): ?>
        <tr>
            <td><?= date('d/m H:i', strtotime($a['server_received_at'])) ?></td>
            <td><strong><?= htmlspecialchars($a['student_code']) ?></strong></td>
            <td><?= $a['level'] ?></td>
            <td>
                <?php if ($a['result'] === 'win'): ?>
                <span class="badge badge-win">Win ★<?= $a['stars'] ?></span>
                <?php elseif ($a['result'] === 'syntax_error'): ?>
                <span class="badge badge-error">Syntax</span>
                <?php else: ?>
                <span class="badge badge-fail"><?= htmlspecialchars($a['error_type'] ?? $a['result']) ?></span>
                <?php endif; ?>
            </td>
            <td><?= $a['score'] ?: '-' ?></td>
            <td><?= $a['cost'] ?: '-' ?></td>
            <td><?= $a['steps'] ?: '-' ?></td>
            <td><?= $a['hints_used'] ?: '0' ?></td>
            <td><?= isset($a['duration_ms']) ? round($a['duration_ms']/1000) . 's' : '-' ?></td>
            <td><?= htmlspecialchars($a['browser_family']) ?></td>
        </tr>
        <?php endforeach; ?>
        <?php endif; ?>
    </tbody>
</table>
</body>
</html>
