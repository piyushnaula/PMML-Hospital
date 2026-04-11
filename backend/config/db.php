<?php

require_once __DIR__ . '/../vendor/autoload.php';

// Load .env if it exists (skipped in Docker where env vars are injected directly)
if (file_exists(__DIR__ . '/../.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
    $dotenv->safeLoad();
}

// ── Helper: read env from $_ENV first, then getenv() (Render/Docker inject via system env) ──
function env(string $key, $default = null): ?string
{
    return $_ENV[$key] ?? (getenv($key) ?: $default);
}

// MongoDB connection — shared global
$mongoUri = env('MONGO_URI');
$mongoDb  = env('MONGO_DB', 'pmml_hospital');

if (!$mongoUri) {
    http_response_code(500);
    echo json_encode(['error' => 'MONGO_URI not configured', 'code' => 'CONFIG_ERROR']);
    exit;
}

$mongoClient = new MongoDB\Client($mongoUri);
$db = $mongoClient->selectDatabase($mongoDb);

// Constants used across the app
define('JWT_SECRET', env('JWT_SECRET', 'fallback-dev-secret-change-me'));
define('JWT_EXPIRY', (int) env('JWT_EXPIRY', '86400'));
define('UPLOAD_PATH', __DIR__ . '/../' . ltrim(env('UPLOAD_PATH', './uploads/certs/'), './'));
