<?php

// All 18 routes defined here.
/** @var \Bramus\Router\Router $router */
/** @var \MongoDB\Database $db */

// ── HELPERS ───────────────────────────────────────────────────────
// Instantiate controllers with the DB connection.
function authCtrl($db): AuthController       { return new AuthController($db); }
function apptCtrl($db): AppointmentController       { return new AppointmentController($db); }
function queueCtrl($db): QueueController      { return new QueueController($db); }
function doctorCtrl($db): DoctorController     { return new DoctorController($db); }
function dashCtrl($db): DashboardController       { return new DashboardController($db); }
function adminCtrl($db): AdminController      { return new AdminController($db); }


// ── AUTH — 3 endpoints ────────────────────────────────────────────
$router->post('/api/auth/register', function () use ($db) {
    authCtrl($db)->register();
});

$router->post('/api/auth/login', function () use ($db) {
    authCtrl($db)->login();
});

$router->get('/api/auth/me', function () use ($db) {
    authCtrl($db)->me();
});

// ── APPOINTMENTS — 5 endpoints ────────────────────────────────────

// NOTE: /appointments/my and /appointments/reschedule must be defined
// BEFORE /appointments/{id} to avoid the router catching them as an :id param.

$router->get('/api/appointments/my', function () use ($db) {
    apptCtrl($db)->my();
});

$router->post('/api/appointments/reschedule', function () use ($db) {
    apptCtrl($db)->reschedule();
});

$router->post('/api/appointments', function () use ($db) {
    apptCtrl($db)->book();
});

$router->put('/api/appointments/(\w+)/status', function ($id) use ($db) {
    apptCtrl($db)->updateStatus($id);
});

$router->get('/api/appointments/date/([0-9\-]+)', function ($date) use ($db) {
    apptCtrl($db)->byDate($date);
});

// ── QUEUE — 3 endpoints ───────────────────────────────────────────
$router->get('/api/queue/(\w+)', function ($doctorId) use ($db) {
    queueCtrl($db)->getQueue($doctorId);
});

$router->post('/api/queue/next', function () use ($db) {
    queueCtrl($db)->next();
});

$router->post('/api/queue/skip/(\w+)', function ($appointmentId) use ($db) {
    queueCtrl($db)->skip($appointmentId);
});

// ── DOCTORS — 4 endpoints ─────────────────────────────────────────

// NOTE: /doctors/assign must come BEFORE /doctors/{id}
$router->get('/api/doctors/assign', function () use ($db) {
    doctorCtrl($db)->assign();
});

$router->get('/api/doctors', function () use ($db) {
    doctorCtrl($db)->list();
});

$router->post('/api/doctors', function () use ($db) {
    doctorCtrl($db)->add();
});

$router->put('/api/doctors/(\w+)', function ($id) use ($db) {
    doctorCtrl($db)->update($id);
});

// ── DASHBOARD + ADMIN — 3 endpoints ──────────────────────────────
$router->get('/api/dashboard', function () use ($db) {
    dashCtrl($db)->index();
});

$router->get('/api/admin/users', function () use ($db) {
    adminCtrl($db)->listUsers();
});

$router->post('/api/admin/users', function () use ($db) {
    adminCtrl($db)->addUser();
});

$router->put('/api/admin/users/(\w+)', function ($id) use ($db) {
    adminCtrl($db)->updateUser($id);
});
