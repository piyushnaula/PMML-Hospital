<?php

class DoctorController
{
    private $doctors;
    private $users;
    private $db;

    public function __construct($db)
    {
        $this->db      = $db;
        $this->doctors = $db->doctors;
        $this->users   = $db->users;
    }

    // GET /doctors
    // Public — list all doctors with status and certificates.
    public function list(): void
    {
        $cursor = $this->doctors->find([], ['sort' => ['name' => 1]]);

        $list = [];
        foreach ($cursor as $doc) {
            $list[] = $this->formatDoctor($doc);
        }

        echo json_encode(['doctors' => $list]);
    }

    // POST /doctors
    // Admin only — creates user account + doctor profile.
    public function add(): void
    {
        Auth::require(['admin']);
        
        $isMultipart = strpos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') !== false;
        
        if ($isMultipart) {
            $name           = trim($_POST['name'] ?? '');
            $email          = trim($_POST['email'] ?? '');
            $specialization = trim($_POST['specialization'] ?? '');
            $department     = trim($_POST['department'] ?? '');
            $slots          = !empty($_POST['available_slots']) ? json_decode($_POST['available_slots'], true) : [['start' => '09:00', 'end' => '13:00']];
        } else {
            $body = json_decode(file_get_contents('php://input'), true);
            $name           = trim($body['name'] ?? '');
            $email          = trim($body['email'] ?? '');
            $specialization = trim($body['specialization'] ?? '');
            $department     = trim($body['department'] ?? '');
            $slots          = $body['available_slots'] ?? [['start' => '09:00', 'end' => '13:00']];
        }

        if (!$name || !$email || !$specialization || !$department) {
            $this->error(422, 'name, email, specialization, and department are required');
            return;
        }

        if ($this->users->findOne(['email' => $email])) {
            $this->error(409, 'Email already registered');
            return;
        }

        // --- Handle Certificate Upload if provided ---
        $certificates = [];
        if (!empty($_FILES['certificate']) && $_FILES['certificate']['error'] !== UPLOAD_ERR_NO_FILE) {
            $file     = $_FILES['certificate'];
            $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
            $filename = 'cert_' . uniqid() . '.' . $ext;
            $dest     = UPLOAD_PATH . $filename;

            if (move_uploaded_file($file['tmp_name'], $dest)) {
                $certificates[] = [
                    'filename'      => $filename,
                    'original_name' => $file['name'],
                    'uploaded_at'   => new MongoDB\BSON\UTCDateTime(),
                    'verified'      => false,
                    'verified_by'   => null,
                    'verified_at'   => null,
                ];
            }
        }

        // Generate a default password (in real app: send via email)
        $defaultPassword = 'pmml@' . rand(1000, 9999);

        // Create user account
        $userDoc = [
            'name'       => $name,
            'email'      => $email,
            'password'   => password_hash($defaultPassword, PASSWORD_BCRYPT),
            'role'       => 'doctor',
            'is_active'  => true,
            'created_at' => new MongoDB\BSON\UTCDateTime(),
        ];
        $userResult = $this->users->insertOne($userDoc);
        $userId     = $userResult->getInsertedId();

        // Create doctor profile
        $doctorDoc = [
            'user_id'         => $userId,
            'name'            => $name,
            'specialization'  => $specialization,
            'department'      => $department,
            'certificates'    => $certificates,
            'available_slots' => $slots,
            'status'          => 'off_duty',
            'created_at'      => new MongoDB\BSON\UTCDateTime(),
        ];
        $doctorResult = $this->doctors->insertOne($doctorDoc);
        $doctorId     = $doctorResult->getInsertedId();

        http_response_code(201);
        echo json_encode([
            'doctor'  => ['_id' => (string) $doctorId, 'name' => $name, 'specialization' => $specialization],
            'user_id' => (string) $userId,
        ]);
    }

    // PUT /doctors/:id
    // Handles: profile edit, status update, cert upload, cert verify — all in one.
    public function update(string $id): void
    {
        $user     = Auth::require(['admin', 'doctor']);
        $doctorId = new MongoDB\BSON\ObjectId($id);
        $doctor   = $this->doctors->findOne(['_id' => $doctorId]);

        if (!$doctor) {
            $this->error(404, 'Doctor not found');
            return;
        }

        // Doctor can only update their own profile
        if ($user->role === 'doctor' && (string) $doctor['user_id'] !== $user->sub) {
            $this->error(403, 'Can only update your own profile');
            return;
        }

        // --- Certificate upload (multipart) ---
        if (!empty($_FILES['certificate'])) {
            $file     = $_FILES['certificate'];
            $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
            $filename = 'cert_' . uniqid() . '.' . $ext;
            $dest     = UPLOAD_PATH . $filename;

            if (!move_uploaded_file($file['tmp_name'], $dest)) {
                $this->error(500, 'Failed to save certificate file');
                return;
            }

            $certEntry = [
                'filename'      => $filename,
                'original_name' => $file['name'],
                'uploaded_at'   => new MongoDB\BSON\UTCDateTime(),
                'verified'      => false,
                'verified_by'   => null,
                'verified_at'   => null,
            ];

            $this->doctors->updateOne(
                ['_id' => $doctorId],
                ['$push' => ['certificates' => $certEntry]]
            );

            $updated = $this->doctors->findOne(['_id' => $doctorId]);
            echo json_encode(['doctor' => $this->formatDoctor($updated)]);
            return;
        }

        // --- JSON body operations ---
        $body   = json_decode(file_get_contents('php://input'), true);
        $action = $body['action'] ?? null;

        // Certificate verification (admin only)
        if ($action === 'verify') {
            if ($user->role !== 'admin') {
                $this->error(403, 'Only admin can verify certificates');
                return;
            }
            $certFilename = $body['certificate_filename'] ?? '';
            $this->doctors->updateOne(
                ['_id' => $doctorId, 'certificates.filename' => $certFilename],
                [
                    '$set' => [
                        'certificates.$.verified'    => true,
                        'certificates.$.verified_by' => new MongoDB\BSON\ObjectId($user->sub),
                        'certificates.$.verified_at' => new MongoDB\BSON\UTCDateTime(),
                    ],
                ]
            );
            $updated = $this->doctors->findOne(['_id' => $doctorId]);
            echo json_encode(['doctor' => $this->formatDoctor($updated)]);
            return;
        }

        // Profile/status update
        $setFields = [];
        if (!empty($body['status'])) {
            $allowed = ['on_duty', 'off_duty', 'in_consultation'];
            if (!in_array($body['status'], $allowed)) {
                $this->error(422, 'Invalid status');
                return;
            }
            $setFields['status'] = $body['status'];
        }
        if (!empty($body['name']))            $setFields['name']            = $body['name'];
        if (!empty($body['specialization']))  $setFields['specialization']  = $body['specialization'];
        if (!empty($body['department']))      $setFields['department']      = $body['department'];
        if (!empty($body['available_slots'])) $setFields['available_slots'] = $body['available_slots'];

        if (empty($setFields)) {
            $this->error(422, 'No valid fields to update');
            return;
        }

        $this->doctors->updateOne(['_id' => $doctorId], ['$set' => $setFields]);
        $updated = $this->doctors->findOne(['_id' => $doctorId]);
        echo json_encode(['doctor' => $this->formatDoctor($updated)]);
    }

    // GET /doctors/assign
    // Smart assignment by problem keywords + shortest queue load.
    public function assign(): void
    {
        $problem = $_GET['problem'] ?? '';
        $date    = $_GET['date'] ?? date('Y-m-d');

        $service  = new DoctorAssign($this->db);
        $assigned = $service->assign($problem, $date);

        if (!$assigned) {
            $this->error(404, 'No available doctor found');
            return;
        }

        echo json_encode($assigned);
    }

    // Format doctor document for JSON response.
    private function formatDoctor($doc): array
    {
        $certs = [];
        foreach ($doc['certificates'] ?? [] as $c) {
            $certs[] = [
                'filename'      => $c['filename'],
                'original_name' => $c['original_name'],
                'verified'      => $c['verified'],
                'uploaded_at'   => $c['uploaded_at']->toDateTime()->format('c'),
            ];
        }

        $slots = [];
        foreach ($doc['available_slots'] ?? [] as $s) {
            $slots[] = ['start' => $s['start'], 'end' => $s['end']];
        }

        return [
            '_id'             => (string) $doc['_id'],
            'user_id'         => (string) $doc['user_id'],
            'name'            => $doc['name'],
            'specialization'  => $doc['specialization'],
            'department'      => $doc['department'],
            'status'          => $doc['status'],
            'certificates'    => $certs,
            'available_slots' => $slots,
        ];
    }

    private function error(int $code, string $msg): void
    {
        http_response_code($code);
        echo json_encode(['error' => $msg]);
    }
}
