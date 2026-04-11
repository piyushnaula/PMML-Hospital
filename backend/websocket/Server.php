<?php

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;

// Load app bootstrap so we have access to JWT + constants
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/Auth.php';

class QueueWsServer implements MessageComponentInterface
{
    // Map: appointment_id → [ConnectionInterface, ...]
    private array $patientSubs = [];

    // All staff connections
    private array $staffSubs = [];

    public function onOpen(ConnectionInterface $conn): void
    {
        // Connection registered — waiting for subscribe message
        echo "New connection #{$conn->resourceId}\n";
    }

    public function onMessage(ConnectionInterface $from, $msg): void
    {
        $data = json_decode($msg, true);
        if (!$data || !isset($data['event'])) {
            return;
        }

        switch ($data['event']) {
            // Patient subscribes to their own appointment updates
            case 'subscribe':
                $apptId = $data['appointment_id'] ?? null;
                if ($apptId) {
                    $this->patientSubs[$apptId][] = $from;
                    echo "Patient subscribed to appointment {$apptId}\n";
                }
                break;

            // Staff subscribes to all queue updates
            case 'subscribe.staff':
                // Verify the JWT so only real staff can subscribe
                $token = $data['token'] ?? '';
                try {
                    $decoded = \Firebase\JWT\JWT::decode($token, new \Firebase\JWT\Key(JWT_SECRET, 'HS256'));
                    $allowed = ['admin', 'queue_manager', 'front_desk', 'doctor'];
                    if (in_array($decoded->role, $allowed)) {
                        $this->staffSubs[$from->resourceId] = $from;
                        echo "Staff subscribed #{$from->resourceId}\n";
                    }
                } catch (Exception $e) {
                    $from->send(json_encode(['event' => 'error', 'message' => 'Invalid token']));
                }
                break;

            // Internal push from QueueService via TCP socket — not a client event
            // (handled by the TCP listener below, not directly here)
        }
    }

    public function onClose(ConnectionInterface $conn): void
    {
        // Remove from staff list
        unset($this->staffSubs[$conn->resourceId]);

        // Remove from all patient subscription lists
        foreach ($this->patientSubs as $apptId => $conns) {
            $this->patientSubs[$apptId] = array_filter(
                $conns,
                fn($c) => $c->resourceId !== $conn->resourceId
            );
        }

        echo "Connection #{$conn->resourceId} closed\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e): void
    {
        echo "WS error: {$e->getMessage()}\n";
        $conn->close();
    }

    // Push to a specific appointment's subscribers (patient events).
    public function sendToAppointment(string $appointmentId, array $payload): void
    {
        $conns = $this->patientSubs[$appointmentId] ?? [];
        $msg   = json_encode($payload);
        foreach ($conns as $conn) {
            $conn->send($msg);
        }
    }

    // Broadcast to all staff subscribers.
    public function sendToStaff(array $payload): void
    {
        $msg = json_encode($payload);
        foreach ($this->staffSubs as $conn) {
            $conn->send($msg);
        }
    }
}

// ── TCP listener so QueueService can push events from HTTP requests ──
// QueueService opens a TCP socket and sends a JSON line.
// This listener reads those lines and routes to the correct WS clients.
class TcpPushListener
{
    private QueueWsServer $wsApp;

    public function __construct(QueueWsServer $wsApp)
    {
        $this->wsApp = $wsApp;
    }

    public function start(int $port): void
    {
        // Bind to 0.0.0.0 so the separate Render Web Service can access this via Private Network
        $server = stream_socket_server("tcp://0.0.0.0:{$port}", $errno, $errstr);
        if (!$server) {
            echo "TCP listener failed: {$errstr}\n";
            return;
        }

        echo "TCP push listener on port {$port}\n";

        stream_set_blocking($server, false);

        // Register with the React event loop
        \React\EventLoop\Loop::get()->addReadStream($server, function ($server) {
            $conn = @stream_socket_accept($server, 0);
            if (!$conn) return;

            $line = fgets($conn);
            fclose($conn);

            if (!$line) return;

            $data = json_decode(trim($line), true);
            if (!$data) return;

            if (($data['type'] ?? '') === 'patient') {
                $this->wsApp->sendToAppointment($data['appointment_id'], $data['data']);
            } elseif (($data['type'] ?? '') === 'staff') {
                $this->wsApp->sendToStaff($data['data']);
            }
        });
    }
}

// ── Boot the WS server ──
$wsApp  = new QueueWsServer();
$wsPort = (int) (getenv('PORT') ?: ($_ENV['WS_PORT'] ?? 8001));
$tcpPort = (int) ($_ENV['WS_TCP_PORT'] ?? 8002); 

$loop = \React\EventLoop\Loop::get();

// Start TCP push listener
$tcpListener = new TcpPushListener($wsApp);
$tcpListener->start($tcpPort);

// Boot Ratchet WS server
$server = IoServer::factory(
    new HttpServer(new WsServer($wsApp)),
    $wsPort,
    '0.0.0.0',
    $loop
);

echo "PMML WebSocket server running on ws://0.0.0.0:{$wsPort}\n";
$server->run();
