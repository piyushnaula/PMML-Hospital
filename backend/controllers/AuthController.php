<?php

use Firebase\JWT\JWT;

class AuthController
{
    private $users;

    public function __construct($db)
    {
        $this->users = $db->users;
    }

    // POST /auth/register
    // Public — creates a patient account and returns a JWT.
    public function register(): void
    {
        $body = json_decode(file_get_contents('php://input'), true);

        $name     = trim($body['name'] ?? '');
        $email    = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';
        $phone    = trim($body['phone'] ?? '');

        if (!$name || !$email || !$password) {
            $this->error(422, 'name, email, and password are required');
            return;
        }

        // Duplicate email check
        if ($this->users->findOne(['email' => $email])) {
            $this->error(409, 'Email already registered');
            return;
        }

        $doc = [
            'name'       => $name,
            'email'      => $email,
            'password'   => password_hash($password, PASSWORD_BCRYPT),
            'role'       => 'patient',
            'phone'      => $phone,
            'is_active'  => true,
            'created_at' => new MongoDB\BSON\UTCDateTime(),
        ];

        $result = $this->users->insertOne($doc);
        $userId = (string) $result->getInsertedId();

        $token = $this->makeToken($userId, 'patient', $name);

        http_response_code(201);
        echo json_encode([
            'token' => $token,
            'user'  => ['_id' => $userId, 'name' => $name, 'role' => 'patient'],
        ]);
    }

    // POST /auth/login
    // Public — works for all roles.
    public function login(): void
    {
        $body = json_decode(file_get_contents('php://input'), true);

        $email    = trim($body['email'] ?? '');
        $password = $body['password'] ?? '';

        if (!$email || !$password) {
            $this->error(422, 'email and password are required');
            return;
        }

        $user = $this->users->findOne(['email' => $email]);

        if (!$user || !password_verify($password, $user['password'])) {
            $this->error(401, 'Invalid credentials');
            return;
        }

        if (!$user['is_active']) {
            $this->error(403, 'Account is deactivated');
            return;
        }

        $userId = (string) $user['_id'];
        $token  = $this->makeToken($userId, $user['role'], $user['name']);

        echo json_encode([
            'token' => $token,
            'user'  => [
                '_id'  => $userId,
                'name' => $user['name'],
                'role' => $user['role'],
            ],
        ]);
    }

    // GET /auth/me
    // Returns decoded JWT payload — no DB call needed.
    public function me(): void
    {
        $user = Auth::user();

        echo json_encode([
            '_id'  => $user->sub,
            'name' => $user->name,
            'role' => $user->role,
        ]);
    }

    // Build and sign a JWT.
    private function makeToken(string $id, string $role, string $name): string
    {
        $payload = [
            'sub'  => $id,
            'role' => $role,
            'name' => $name,
            'iat'  => time(),
            'exp'  => time() + JWT_EXPIRY,
        ];
        return JWT::encode($payload, JWT_SECRET, 'HS256');
    }

    private function error(int $code, string $msg): void
    {
        http_response_code($code);
        echo json_encode(['error' => $msg]);
    }
}
