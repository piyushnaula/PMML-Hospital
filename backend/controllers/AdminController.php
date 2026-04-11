<?php

class AdminController
{
    private $users;

    public function __construct($db)
    {
        $this->users = $db->users;
    }

    // GET /admin/users
    // Returns all users with role and active status.
    public function listUsers(): void
    {
        Auth::require(['admin']);

        $cursor = $this->users->find([], ['sort' => ['created_at' => -1]]);

        $list = [];
        foreach ($cursor as $u) {
            $list[] = [
                '_id'       => (string) $u['_id'],
                'name'      => $u['name'],
                'email'     => $u['email'],
                'role'      => $u['role'],
                'is_active' => $u['is_active'],
            ];
        }

        echo json_encode(['users' => $list]);
    }

    // POST /admin/users
    // Admin only - create user directly with optional document
    public function addUser(): void
    {
        Auth::require(['admin']);
        
        $isMultipart = strpos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') !== false;
        
        if ($isMultipart) {
            $name  = trim($_POST['name'] ?? '');
            $email = trim($_POST['email'] ?? '');
            $role  = trim($_POST['role'] ?? '');
        } else {
            $body  = json_decode(file_get_contents('php://input'), true);
            $name  = trim($body['name'] ?? '');
            $email = trim($body['email'] ?? '');
            $role  = trim($body['role'] ?? '');
        }

        $allowedRoles = ['front_desk', 'queue_manager', 'admin'];
        if (!$name || !$email || !$role || !in_array($role, $allowedRoles)) {
            $this->error(422, 'name, email, and valid staff role required');
            return;
        }

        if ($this->users->findOne(['email' => $email])) {
            $this->error(409, 'Email already registered');
            return;
        }
        
        $documents = [];
        if (!empty($_FILES['document']) && $_FILES['document']['error'] !== UPLOAD_ERR_NO_FILE) {
            $file     = $_FILES['document'];
            $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
            $filename = 'doc_' . uniqid() . '.' . $ext;
            $dest     = UPLOAD_PATH . $filename;

            if (move_uploaded_file($file['tmp_name'], $dest)) {
                $documents[] = [
                    'filename'      => $filename,
                    'original_name' => $file['name'],
                    'uploaded_at'   => new MongoDB\BSON\UTCDateTime(),
                ];
            }
        }
        
        $defaultPassword = 'pmml@' . rand(1000, 9999);
        $userDoc = [
            'name'       => $name,
            'email'      => $email,
            'password'   => password_hash($defaultPassword, PASSWORD_BCRYPT),
            'role'       => $role,
            'is_active'  => true,
            'documents'  => $documents,
            'created_at' => new MongoDB\BSON\UTCDateTime(),
        ];
        
        $result = $this->users->insertOne($userDoc);
        $userId = (string)$result->getInsertedId();
        
        http_response_code(201);
        echo json_encode([
            'user' => [
                '_id'   => $userId,
                'name'  => $name,
                'email' => $email,
                'role'  => $role
            ]
        ]);
    }

    // PUT /admin/users/:id
    // Change role OR toggle active status — determined by which field is sent.
    public function updateUser(string $id): void
    {
        Auth::require(['admin']);

        $body = json_decode(file_get_contents('php://input'), true);

        $allowedRoles = ['patient', 'front_desk', 'queue_manager', 'doctor', 'admin'];
        $setFields    = [];

        if (isset($body['role'])) {
            if (!in_array($body['role'], $allowedRoles)) {
                $this->error(422, 'Invalid role');
                return;
            }
            $setFields['role'] = $body['role'];
        }

        if (isset($body['is_active'])) {
            $setFields['is_active'] = (bool) $body['is_active'];
        }

        if (empty($setFields)) {
            $this->error(422, 'Provide role or is_active to update');
            return;
        }

        $userId = new MongoDB\BSON\ObjectId($id);
        $user   = $this->users->findOne(['_id' => $userId]);

        if (!$user) {
            $this->error(404, 'User not found');
            return;
        }

        $this->users->updateOne(['_id' => $userId], ['$set' => $setFields]);
        $updated = $this->users->findOne(['_id' => $userId]);

        echo json_encode([
            'user' => [
                '_id'       => (string) $updated['_id'],
                'name'      => $updated['name'],
                'email'     => $updated['email'],
                'role'      => $updated['role'],
                'is_active' => $updated['is_active'],
            ],
        ]);
    }

    private function error(int $code, string $msg): void
    {
        http_response_code($code);
        echo json_encode(['error' => $msg]);
    }
}
