<?php

class AppointmentController
{
    private $appointments;
    private $queues;
    private $db;

    public function __construct($db)
    {
        $this->db           = $db;
        $this->appointments = $db->appointments;
        $this->queues       = $db->queues;
    }

    // POST /appointments
    // Book online or walk-in. Auto-assigns doctor if none given.
    public function book(): void
    {
        $user = Auth::require(['patient', 'front_desk']);
        $body = json_decode(file_get_contents('php://input'), true);

        $bookingType        = $body['booking_type'] ?? 'online';
        $problemDescription = trim($body['problem_description'] ?? '');
        $appointmentDate    = $body['appointment_date'] ?? '';
        $timeSlot           = $body['time_slot'] ?? ['start' => '09:00', 'end' => '09:30'];
        $doctorId           = $body['doctor_id'] ?? null;

        if (!$appointmentDate || !$problemDescription) {
            $this->error(422, 'appointment_date and problem_description are required');
            return;
        }

        // Auto-assign doctor if not provided
        if (!$doctorId) {
            $assign   = new DoctorAssign($this->db);
            $assigned = $assign->assign($problemDescription, $appointmentDate);
            if (!$assigned) {
                $this->error(404, 'No available doctor found for this problem');
                return;
            }
            $doctorId = $assigned['doctor_id'];
        }

        $doctorObjId  = new MongoDB\BSON\ObjectId($doctorId);
        $patientObjId = new MongoDB\BSON\ObjectId($user->sub);
        $dateObj      = new MongoDB\BSON\UTCDateTime(strtotime($appointmentDate) * 1000);

        // Get next appointment number for this doctor on this date
        $count = $this->appointments->countDocuments([
            'doctor_id'        => $doctorObjId,
            'appointment_date' => $dateObj,
        ]);
        $appointmentNumber = $count + 1;

        // Get current queue length for position
        $queue = $this->queues->findOne([
            'doctor_id' => $doctorObjId,
            'date'      => $dateObj,
        ]);
        $queuePosition = $queue ? count($queue['queue_list']) + 1 : 1;

        $doc = [
            'patient_id'            => $patientObjId,
            'doctor_id'             => $doctorObjId,
            'appointment_number'    => $appointmentNumber,
            'queue_position'        => $queuePosition,
            'booking_type'          => $bookingType,
            'problem_description'   => $problemDescription,
            'appointment_date'      => $dateObj,
            'time_slot'             => $timeSlot,
            'status'                => 'pending',
            'confirmed_by_patient'  => false,
            'confirmation_deadline' => new MongoDB\BSON\UTCDateTime((strtotime($appointmentDate) + 3600) * 1000),
            'notifications_sent'    => [],
            'created_at'            => new MongoDB\BSON\UTCDateTime(),
        ];

        $result        = $this->appointments->insertOne($doc);
        $appointmentId = $result->getInsertedId();

        // Add to queue document (create if first of the day)
        $queueEntry = [
            'position'       => $queuePosition,
            'appointment_id' => $appointmentId,
            'patient_id'     => $patientObjId,
            'status'         => 'waiting',
        ];

        $this->queues->updateOne(
            ['doctor_id' => $doctorObjId, 'date' => $dateObj],
            [
                '$push' => ['queue_list' => $queueEntry],
                '$inc'  => ['total_active' => 1],
                '$set'  => ['last_updated' => new MongoDB\BSON\UTCDateTime()],
                '$setOnInsert' => [
                    'current_position' => 0,
                ],
            ],
            ['upsert' => true]
        );

        http_response_code(201);
        echo json_encode([
            'appointment' => [
                '_id'                => (string) $appointmentId,
                'appointment_number' => $appointmentNumber,
                'queue_position'     => $queuePosition,
                'doctor_id'          => $doctorId,
                'status'             => 'pending',
            ],
        ]);
    }

    // GET /appointments/my
    // Patient's own appointments sorted newest first.
    public function my(): void
    {
        $user = Auth::require(['patient']);

        $cursor = $this->appointments->find(
            ['patient_id' => new MongoDB\BSON\ObjectId($user->sub)],
            ['sort' => ['appointment_date' => -1]]
        );

        $list = [];
        foreach ($cursor as $a) {
            $list[] = $this->formatAppointment($a);
        }

        echo json_encode(['appointments' => $list]);
    }

    // PUT /appointments/:id/status
    // Single endpoint for confirm, cancel, skip, complete.
    public function updateStatus(string $id): void
    {
        $user   = Auth::verify();
        $body   = json_decode(file_get_contents('php://input'), true);
        $status = $body['status'] ?? '';

        $allowed = ['confirmed', 'cancelled', 'skipped', 'completed'];
        if (!in_array($status, $allowed)) {
            $this->error(422, 'Invalid status. Allowed: ' . implode(', ', $allowed));
            return;
        }

        $apptId = new MongoDB\BSON\ObjectId($id);
        $appt   = $this->appointments->findOne(['_id' => $apptId]);

        if (!$appt) {
            $this->error(404, 'Appointment not found');
            return;
        }

        // Patients can only change their own appointment
        if ($user->role === 'patient' && (string) $appt['patient_id'] !== $user->sub) {
            $this->error(403, 'Not your appointment');
            return;
        }

        $update = ['status' => $status];

        // Track patient confirmation
        if ($status === 'confirmed') {
            $update['confirmed_by_patient'] = true;
        }

        $this->appointments->updateOne(['_id' => $apptId], ['$set' => $update]);

        // Reorder queue and fire WS notifications on queue-affecting changes
        if (in_array($status, ['cancelled', 'skipped', 'completed'])) {
            $dateStr  = date('Y-m-d', $appt['appointment_date']->toDateTime()->getTimestamp());
            $doctorId = (string) $appt['doctor_id'];
            QueueService::reorderQueue($this->db, $doctorId, $dateStr);
            QueueService::triggerNotifications($this->db, $doctorId, $dateStr);
        }

        $updated = $this->appointments->findOne(['_id' => $apptId]);
        echo json_encode([
            'appointment'   => $this->formatAppointment($updated),
            'queue_updated' => in_array($status, ['cancelled', 'skipped', 'completed']),
        ]);
    }

    // POST /appointments/reschedule
    // Marks old as rescheduled, books a fresh slot.
    public function reschedule(): void
    {
        $user = Auth::require(['patient', 'queue_manager']);
        $body = json_decode(file_get_contents('php://input'), true);

        $oldId       = $body['appointment_id'] ?? '';
        $newDate     = $body['new_date'] ?? '';
        $newTimeSlot = $body['new_time_slot'] ?? [];

        if (!$oldId || !$newDate || !$newTimeSlot) {
            $this->error(422, 'appointment_id, new_date, and new_time_slot are required');
            return;
        }

        $apptId = new MongoDB\BSON\ObjectId($oldId);
        $appt   = $this->appointments->findOne(['_id' => $apptId]);

        if (!$appt) {
            $this->error(404, 'Appointment not found');
            return;
        }

        // Mark old as rescheduled
        $this->appointments->updateOne(
            ['_id' => $apptId],
            ['$set' => ['status' => 'rescheduled']]
        );

        // Reorder queue for old date
        $oldDateStr = date('Y-m-d', $appt['appointment_date']->toDateTime()->getTimestamp());
        $doctorId   = (string) $appt['doctor_id'];
        QueueService::reorderQueue($this->db, $doctorId, $oldDateStr);

        // Directly insert new appointment (no HTTP round-trip)
        $doctorObjId  = $appt['doctor_id'];
        $patientObjId = $appt['patient_id'];
        $dateObj      = new MongoDB\BSON\UTCDateTime(strtotime($newDate) * 1000);

        $count             = $this->appointments->countDocuments(['doctor_id' => $doctorObjId, 'appointment_date' => $dateObj]);
        $appointmentNumber = $count + 1;
        $queue             = $this->queues->findOne(['doctor_id' => $doctorObjId, 'date' => $dateObj]);
        $queuePosition     = $queue ? count($queue['queue_list']) + 1 : 1;

        $newDoc = [
            'patient_id'            => $patientObjId,
            'doctor_id'             => $doctorObjId,
            'appointment_number'    => $appointmentNumber,
            'queue_position'        => $queuePosition,
            'booking_type'          => (string) $appt['booking_type'],
            'problem_description'   => (string) $appt['problem_description'],
            'appointment_date'      => $dateObj,
            'time_slot'             => $newTimeSlot,
            'status'                => 'pending',
            'confirmed_by_patient'  => false,
            'confirmation_deadline' => new MongoDB\BSON\UTCDateTime((strtotime($newDate) + 3600) * 1000),
            'notifications_sent'    => [],
            'created_at'            => new MongoDB\BSON\UTCDateTime(),
        ];

        $newResult = $this->appointments->insertOne($newDoc);
        $newApptId = $newResult->getInsertedId();

        $this->queues->updateOne(
            ['doctor_id' => $doctorObjId, 'date' => $dateObj],
            [
                '$push' => ['queue_list' => [
                    'position'       => $queuePosition,
                    'appointment_id' => $newApptId,
                    'patient_id'     => $patientObjId,
                    'status'         => 'waiting',
                ]],
                '$inc' => ['total_active' => 1],
                '$set' => ['last_updated' => new MongoDB\BSON\UTCDateTime()],
                '$setOnInsert' => ['current_position' => 0],
            ],
            ['upsert' => true]
        );

        http_response_code(201);
        echo json_encode([
            'old_appointment_id' => $oldId,
            'new_appointment'    => [
                '_id'            => (string) $newApptId,
                'status'         => 'pending',
                'queue_position' => $queuePosition,
            ],
        ]);
    }

    // GET /appointments/date/:date
    // All appointments for a date; optional ?doctor_id filter.
    public function byDate(string $date): void
    {
        Auth::require(['front_desk', 'queue_manager', 'admin', 'doctor']);

        $dateObj = new MongoDB\BSON\UTCDateTime(strtotime($date) * 1000);
        $filter  = ['appointment_date' => $dateObj];

        $doctorId = $_GET['doctor_id'] ?? null;
        if ($doctorId) {
            $filter['doctor_id'] = new MongoDB\BSON\ObjectId($doctorId);
        }

        $cursor = $this->appointments->find($filter, ['sort' => ['queue_position' => 1]]);

        $list = [];
        foreach ($cursor as $a) {
            $list[] = $this->formatAppointment($a);
        }

        echo json_encode(['appointments' => $list]);
    }

    // Convert MongoDB document to plain array for JSON output.
    private function formatAppointment($a): array
    {
        return [
            '_id'                   => (string) $a['_id'],
            'patient_id'            => (string) $a['patient_id'],
            'doctor_id'             => (string) $a['doctor_id'],
            'appointment_number'    => $a['appointment_number'],
            'queue_position'        => $a['queue_position'],
            'booking_type'          => $a['booking_type'],
            'problem_description'   => $a['problem_description'],
            'appointment_date'      => $a['appointment_date']->toDateTime()->format('Y-m-d'),
            'time_slot'             => (array) $a['time_slot'],
            'status'                => $a['status'],
            'confirmed_by_patient'  => $a['confirmed_by_patient'],
            'notifications_sent'    => (array) $a['notifications_sent'],
            'created_at'            => $a['created_at']->toDateTime()->format('c'),
        ];
    }

    private function error(int $code, string $msg): void
    {
        http_response_code($code);
        echo json_encode(['error' => $msg]);
    }
}
