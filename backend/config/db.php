<?php

require_once __DIR__ . '/../vendor/autoload.php';

// Load .env if it exists (skipped in Docker where env vars are injected directly)
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->safeLoad();

// MongoDB connection — shared global
$mongoClient = new MongoDB\Client($_ENV['MONGO_URI']);
$db = $mongoClient->selectDatabase($_ENV['MONGO_DB']);

// Constants used across the app
define('JWT_SECRET', $_ENV['JWT_SECRET']);
define('JWT_EXPIRY', (int) $_ENV['JWT_EXPIRY']);
define('UPLOAD_PATH', __DIR__ . '/../' . ltrim($_ENV['UPLOAD_PATH'], './'));
