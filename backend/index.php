<?php

// ── 1. Bootstrap (must load env() helper before CORS) ─────────────────
require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/config/db.php';  // loads .env, $db, constants, env() helper

// ── 2. CORS Headers — Dynamic origin from ALLOWED_ORIGINS env var ─────
$allowedOriginsRaw = env('ALLOWED_ORIGINS', '*');
$allowedOrigins = array_filter(array_map('trim', explode(',', $allowedOriginsRaw)));
$requestOrigin  = $_SERVER['HTTP_ORIGIN'] ?? '';

// Determine which origin to send back
if (in_array('*', $allowedOrigins)) {
    // Dev mode: allow all
    header('Access-Control-Allow-Origin: *');
} elseif (in_array($requestOrigin, $allowedOrigins)) {
    // Production: exact match
    header("Access-Control-Allow-Origin: {$requestOrigin}");
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
} else {
    // Origin not allowed — still respond but without CORS header
    // Browser will block the response on the client side
    header("Access-Control-Allow-Origin: {$allowedOrigins[0]}");
    header('Vary: Origin');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json');
ini_set('display_errors', 0); // Prevent PHP errors from breaking JSON/CORS headers

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── 3. Autoload middleware, controllers, services ─────────────────────
require_once __DIR__ . '/middleware/Auth.php';

require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/AppointmentController.php';
require_once __DIR__ . '/controllers/QueueController.php';
require_once __DIR__ . '/controllers/DoctorController.php';
require_once __DIR__ . '/controllers/DashboardController.php';
require_once __DIR__ . '/controllers/AdminController.php';

require_once __DIR__ . '/services/QueueService.php';
require_once __DIR__ . '/services/DoctorAssign.php';

// ── Router setup ───────────────────────────────────────────────────
$router = new Bramus\Router\Router();

// 404 fallback
$router->set404(function () {
    http_response_code(404);
    echo json_encode(['error' => 'Route not found', 'code' => 'NOT_FOUND']);
});

// ── Register all routes ────────────────────────────────────────────
require_once __DIR__ . '/routes.php';

// ── Global error wrapper — no raw PHP errors exposed ──────────────
try {
    $router->run();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'code'  => 'SERVER_ERROR',
        // Uncomment below in development for debugging:
        // 'detail' => $e->getMessage(),
    ]);
}
