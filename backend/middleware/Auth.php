<?php

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class Auth
{
    // Verify token and return decoded payload. Exits on failure.
    public static function verify(): object
    {
        $headers = getallheaders();
        $raw     = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        $token   = str_replace('Bearer ', '', $raw);

        if (!$token) {
            self::deny(401, 'No token provided');
        }

        try {
            return JWT::decode($token, new Key(JWT_SECRET, 'HS256'));
        } catch (Exception $e) {
            self::deny(401, 'Invalid or expired token');
        }

        // deny() calls exit — this line is never reached but satisfies PHP's return type check.
        exit;
    }

    // Verify token AND check that role is in the allowed list.
    public static function require(array $roles): object
    {
        $user = self::verify();
        if (!in_array($user->role, $roles)) {
            self::deny(403, 'Insufficient permissions');
        }
        return $user;
    }

    // Alias — same as verify(), reads cleaner at call sites.
    public static function user(): object
    {
        return self::verify();
    }

    // Send error JSON and stop execution.
    private static function deny(int $code, string $msg): never
    {
        http_response_code($code);
        echo json_encode(['error' => $msg, 'code' => 'AUTH_ERROR']);
        exit;
    }
}
