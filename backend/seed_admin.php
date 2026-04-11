<?php
require __DIR__ . '/config/db.php';

$adminEmail    = 'admin@pmml.com';
$adminPassword = 'Pmml@Admin#2026!';
$adminName     = 'Super Admin';

// Check if admin already exists
if ($db->users->findOne(['email' => $adminEmail])) {
    echo "Admin account already exists with email: {$adminEmail}\n";
    exit;
}

$db->users->insertOne([
    'name'       => $adminName,
    'email'      => $adminEmail,
    'password'   => password_hash($adminPassword, PASSWORD_BCRYPT),
    'role'       => 'admin',
    'is_active'  => true,
    'created_at' => new MongoDB\BSON\UTCDateTime(),
]);

echo "=== Admin Account Created ===\n";
echo "Email:    {$adminEmail}\n";
echo "Password: {$adminPassword}\n";
echo "=============================\n";
