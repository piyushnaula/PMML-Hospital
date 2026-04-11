<?php

class DashboardController
{
    private $appointments;
    private $doctors;
    private $queues;

    public function __construct($db)
    {
        $this->appointments = $db->appointments;
        $this->doctors      = $db->doctors;
        $this->queues       = $db->queues;
    }

    // GET /dashboard
    // One call returns all stats: patients, bookings, doctors, departments, alerts.
    public function index(): void
    {
        Auth::require(['admin', 'queue_manager']);

        $today   = date('Y-m-d');
        $dateObj = new MongoDB\BSON\UTCDateTime(strtotime($today) * 1000);

        // Total appointments today
        $totalToday = $this->appointments->countDocuments(['appointment_date' => $dateObj]);

        // Booking type split
        $onlineCount = $this->appointments->countDocuments([
            'appointment_date' => $dateObj,
            'booking_type'     => 'online',
        ]);
        $walkinCount = $this->appointments->countDocuments([
            'appointment_date' => $dateObj,
            'booking_type'     => 'walk_in',
        ]);

        // Doctor status counts
        $totalDoctors   = $this->doctors->countDocuments([]);
        $onDutyDoctors  = $this->doctors->countDocuments(['status' => 'on_duty']);
        $offDutyDoctors = $this->doctors->countDocuments(['status' => 'off_duty']);

        // Department queue loads
        $doctorsCursor  = $this->doctors->find([]);
        $departments    = [];
        $alerts         = [];

        foreach ($doctorsCursor as $doc) {
            $dept = (string) $doc['department'];
            $dId  = $doc['_id'];

            $queue = $this->queues->findOne([
                'doctor_id' => $dId,
                'date'      => $dateObj,
            ]);
            $load = $queue ? (int) $queue['total_active'] : 0;

            if (!isset($departments[$dept])) {
                $departments[$dept] = 0;
            }
            $departments[$dept] += $load;

            // Alert if any single doctor queue is over 15
            if ($load > 15) {
                $alerts[] = [
                    'type'      => 'long_queue',
                    'doctor_id' => (string) $dId,
                    'message'   => $doc['name'] . ' queue > 15 patients',
                ];
            }
        }

        // Format departments array
        $deptList = [];
        foreach ($departments as $name => $load) {
            $deptList[] = ['name' => $name, 'queue_load' => $load];
        }

        echo json_encode([
            'date'                => $today,
            'total_patients_today' => $totalToday,
            'online_bookings'     => $onlineCount,
            'walkin_bookings'     => $walkinCount,
            'doctors' => [
                'total'    => $totalDoctors,
                'on_duty'  => $onDutyDoctors,
                'off_duty' => $offDutyDoctors,
            ],
            'departments' => $deptList,
            'alerts'      => $alerts,
        ]);
    }
}
