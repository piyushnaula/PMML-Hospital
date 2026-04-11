<?php

class QueueController
{
    private $queues;
    private $appointments;
    private $db;

    public function __construct($db)
    {
        $this->db           = $db;
        $this->queues       = $db->queues;
        $this->appointments = $db->appointments;
    }

    // GET /queue/:doctorId
    // Returns live queue for a doctor.
    // If caller is a patient, their position is highlighted in my_position.
    public function getQueue(string $doctorId): void
    {
        $user = Auth::verify();

        $today   = date('Y-m-d');
        $dateObj = new MongoDB\BSON\UTCDateTime(strtotime($today) * 1000);

        $queue = $this->queues->findOne([
            'doctor_id' => new MongoDB\BSON\ObjectId($doctorId),
            'date'      => $dateObj,
        ]);

        if (!$queue) {
            echo json_encode([
                'doctor_id'        => $doctorId,
                'date'             => $today,
                'current_position' => 0,
                'total_active'     => 0,
                'queue_list'       => [],
                'my_position'      => null,
            ]);
            return;
        }

        $list = [];
        foreach ($queue['queue_list'] as $item) {
            $list[] = [
                'position'       => $item['position'],
                'appointment_id' => (string) $item['appointment_id'],
                'patient_id'     => (string) $item['patient_id'],
                'status'         => $item['status'],
            ];
        }

        // Find the patient's own position if they are a patient
        $myPosition = null;
        if ($user->role === 'patient') {
            $myAppt = $this->appointments->findOne([
                'patient_id'       => new MongoDB\BSON\ObjectId($user->sub),
                'doctor_id'        => new MongoDB\BSON\ObjectId($doctorId),
                'appointment_date' => $dateObj,
                'status'           => ['$in' => ['pending', 'confirmed', 'in_queue']],
            ]);
            if ($myAppt) {
                $myPosition = $myAppt['queue_position'];
            }
        }

        echo json_encode([
            'doctor_id'        => $doctorId,
            'date'             => $today,
            'current_position' => $queue['current_position'],
            'total_active'     => $queue['total_active'],
            'queue_list'       => $list,
            'my_position'      => $myPosition,
        ]);
    }

    // POST /queue/next
    // Advance to next patient. Fires WS events.
    public function next(): void
    {
        $user = Auth::require(['queue_manager', 'doctor']);
        $body = json_decode(file_get_contents('php://input'), true);

        $doctorId = $body['doctor_id'] ?? '';
        if (!$doctorId) {
            $this->error(422, 'doctor_id is required');
            return;
        }

        $today   = date('Y-m-d');
        $dateObj = new MongoDB\BSON\UTCDateTime(strtotime($today) * 1000);

        $queue = $this->queues->findOne([
            'doctor_id' => new MongoDB\BSON\ObjectId($doctorId),
            'date'      => $dateObj,
        ]);

        if (!$queue) {
            $this->error(404, 'No queue found for this doctor today');
            return;
        }

        $prevPosition = (int) $queue['current_position'];
        $nextPosition = $prevPosition + 1;

        // Mark current patient as completed
        if ($prevPosition > 0) {
            $this->appointments->updateOne(
                [
                    'doctor_id'        => new MongoDB\BSON\ObjectId($doctorId),
                    'appointment_date' => $dateObj,
                    'queue_position'   => $prevPosition,
                ],
                ['$set' => ['status' => 'completed']]
            );
        }

        // Advance the queue pointer
        $this->queues->updateOne(
            ['_id' => $queue['_id']],
            [
                '$set' => [
                    'current_position' => $nextPosition,
                    'last_updated'     => new MongoDB\BSON\UTCDateTime(),
                ],
                '$inc' => ['total_active' => -1],
            ]
        );

        // Find next patient info
        $nextAppt = $this->appointments->findOne([
            'doctor_id'        => new MongoDB\BSON\ObjectId($doctorId),
            'appointment_date' => $dateObj,
            'queue_position'   => $nextPosition,
        ]);

        $nextPatient = null;
        if ($nextAppt) {
            $nextPatient = [
                'appointment_id' => (string) $nextAppt['_id'],
                'patient_id'     => (string) $nextAppt['patient_id'],
            ];

            // Fire your_turn WS event for the next patient
            QueueService::broadcastToPatient(
                (string) $nextAppt['_id'],
                'queue.your_turn',
                ['appointment_id' => (string) $nextAppt['_id'], 'message' => "It's your turn!"]
            );
        }

        // Fire queue.updated to all staff
        QueueService::broadcastQueueUpdated($this->db, $doctorId, $today);

        // Trigger position notifications for patients coming up
        QueueService::triggerNotifications($this->db, $doctorId, $today);

        echo json_encode([
            'previous_position' => $prevPosition,
            'current_position'  => $nextPosition,
            'next_patient'      => $nextPatient,
        ]);
    }

    // POST /queue/skip/:appointmentId
    // Skip a specific patient and reorder the queue.
    public function skip(string $appointmentId): void
    {
        Auth::require(['queue_manager', 'admin']);
        $body   = json_decode(file_get_contents('php://input'), true);
        $reason = $body['reason'] ?? 'Skipped by staff';

        $apptId = new MongoDB\BSON\ObjectId($appointmentId);
        $appt   = $this->appointments->findOne(['_id' => $apptId]);

        if (!$appt) {
            $this->error(404, 'Appointment not found');
            return;
        }

        // Mark as skipped
        $this->appointments->updateOne(
            ['_id' => $apptId],
            ['$set' => ['status' => 'skipped']]
        );

        // Fire queue.skipped WS to the patient
        QueueService::broadcastToPatient(
            $appointmentId,
            'queue.skipped',
            ['appointment_id' => $appointmentId, 'reason' => $reason]
        );

        $dateStr  = date('Y-m-d', $appt['appointment_date']->toDateTime()->getTimestamp());
        $doctorId = (string) $appt['doctor_id'];

        // Reorder remaining patients
        QueueService::reorderQueue($this->db, $doctorId, $dateStr);

        // Update queue list entry status
        $this->queues->updateOne(
            [
                'doctor_id'            => $appt['doctor_id'],
                'date'                 => $appt['appointment_date'],
                'queue_list.appointment_id' => $apptId,
            ],
            ['$set' => ['queue_list.$.status' => 'skipped']]
        );

        // Fire queue.updated to staff
        QueueService::broadcastQueueUpdated($this->db, $doctorId, $dateStr);

        echo json_encode([
            'skipped_appointment_id' => $appointmentId,
            'queue_reordered'        => true,
        ]);
    }

    private function error(int $code, string $msg): void
    {
        http_response_code($code);
        echo json_encode(['error' => $msg]);
    }
}
