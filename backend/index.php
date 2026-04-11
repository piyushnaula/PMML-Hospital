<?php

// ── 1. CORS Headers — Must be sent before any potential bootstrap errors ──
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── 2. Bootstrap ──────────────────────────────────────────────────
require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/config/db.php';  // loads .env, $db, constants

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
