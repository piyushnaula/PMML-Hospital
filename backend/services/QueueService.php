<?php

class QueueService
{
    // Recalculate queue_position for all waiting patients after a skip/cancel/complete.
    // Updates both queues collection and individual appointment documents.
    public static function reorderQueue($db, string $doctorId, string $date): void
    {
        $dateObj  = new MongoDB\BSON\UTCDateTime(strtotime($date) * 1000);
        $doctorObjId = new MongoDB\BSON\ObjectId($doctorId);

        // Get all waiting appointments for this doctor on this date, ordered by current position
        $cursor = $db->appointments->find(
            [
                'doctor_id'        => $doctorObjId,
                'appointment_date' => $dateObj,
                'status'           => ['$in' => ['pending', 'confirmed', 'in_queue']],
            ],
            ['sort' => ['queue_position' => 1]]
        );

        $newPosition = 1;
        $newQueueList = [];

        foreach ($cursor as $appt) {
            // Reassign position sequentially
            $db->appointments->updateOne(
                ['_id' => $appt['_id']],
                ['$set' => ['queue_position' => $newPosition]]
            );

            $newQueueList[] = [
                'position'       => $newPosition,
                'appointment_id' => $appt['_id'],
                'patient_id'     => $appt['patient_id'],
                'status'         => 'waiting',
            ];

            $newPosition++;
        }

        // Update the queue document with the fresh list
        $db->queues->updateOne(
            ['doctor_id' => $doctorObjId, 'date' => $dateObj],
            [
                '$set' => [
                    'queue_list'   => $newQueueList,
                    'total_active' => count($newQueueList),
                    'last_updated' => new MongoDB\BSON\UTCDateTime(),
                ],
            ]
        );
    }

    // After a reorder, check each waiting patient's position and send WS events
    // for positions 5, 3, 2, 1 — skipping if already sent.
    public static function triggerNotifications($db, string $doctorId, string $date): void
    {
        $dateObj     = new MongoDB\BSON\UTCDateTime(strtotime($date) * 1000);
        $doctorObjId = new MongoDB\BSON\ObjectId($doctorId);

        $notifyPositions = [5 => 'pos_5', 3 => 'pos_3', 2 => 'pos_2', 1 => 'pos_1'];

        $cursor = $db->appointments->find([
            'doctor_id'        => $doctorObjId,
            'appointment_date' => $dateObj,
            'status'           => ['$in' => ['pending', 'confirmed', 'in_queue']],
        ]);

        foreach ($cursor as $appt) {
            $pos  = (int) $appt['queue_position'];
            $sent = (array) $appt['notifications_sent'];

            if (!isset($notifyPositions[$pos])) {
                continue;
            }

            $key = $notifyPositions[$pos];

            // Skip if already sent this notification
            if (in_array($key, $sent)) {
                continue;
            }

            // Fire WS event
            self::broadcastToPatient(
                (string) $appt['_id'],
                'queue.position',
                [
                    'appointment_id' => (string) $appt['_id'],
                    'position'       => $pos,
                    'message'        => self::positionMessage($pos),
                ]
            );

            // Mark notification as sent
            $db->appointments->updateOne(
                ['_id' => $appt['_id']],
                ['$push' => ['notifications_sent' => $key]]
            );
        }
    }

    // Send a WS message to a specific appointment's subscriber.
    // Connects to the Ratchet server via TCP and pushes the event.
    public static function broadcastToPatient(string $appointmentId, string $event, array $payload): void
    {
        $payload['event'] = $event;
        self::sendToWsServer(['type' => 'patient', 'appointment_id' => $appointmentId, 'data' => $payload]);
    }

    // Broadcast queue state update to all staff subscribers.
    public static function broadcastQueueUpdated($db, string $doctorId, string $date): void
    {
        $dateObj = new MongoDB\BSON\UTCDateTime(strtotime($date) * 1000);

        $queue = $db->queues->findOne([
            'doctor_id' => new MongoDB\BSON\ObjectId($doctorId),
            'date'      => $dateObj,
        ]);

        $queueList = [];
        if ($queue) {
            foreach ($queue['queue_list'] as $item) {
                $queueList[] = [
                    'position'       => $item['position'],
                    'appointment_id' => (string) $item['appointment_id'],
                    'status'         => $item['status'],
                ];
            }
        }

        self::sendToWsServer([
            'type'      => 'staff',
            'data'      => [
                'event'            => 'queue.updated',
                'doctor_id'        => $doctorId,
                'queue_list'       => $queueList,
                'current_position' => $queue ? $queue['current_position'] : 0,
            ],
        ]);
    }

    // Push a JSON message to the Ratchet WS server via a local TCP socket.
    // TcpPushListener in Server.php listens on WS_TCP_PORT (default 8002).
    // In production (Render), WS_INTERNAL_HOST points to the WS container's private hostname.
    private static function sendToWsServer(array $payload): void
    {
        $tcpHost = $_ENV['WS_INTERNAL_HOST'] ?? '127.0.0.1';
        $tcpPort = (int) ($_ENV['WS_TCP_PORT'] ?? 8002);
        $socket  = @fsockopen($tcpHost, $tcpPort, $errno, $errstr, 1);

        if ($socket) {
            fwrite($socket, json_encode($payload) . "\n");
            fclose($socket);
        }
        // Silently fail if WS server is not running — don't break the HTTP response.
    }

    private static function positionMessage(int $pos): string
    {
        return match ($pos) {
            5 => '5 patients ahead — start heading over',
            3 => '3 patients ahead — please be ready',
            2 => '2 patients ahead — proceed to waiting area',
            1 => 'You are next!',
            default => "You are at position {$pos}",
        };
    }
}
