<?php

class DoctorAssign
{
    private $doctors;
    private $queues;

    // Keyword map: problem words → specialization
    private array $keywordMap = [
        'heart'       => 'Cardiology',
        'chest'       => 'Cardiology',
        'cardiac'     => 'Cardiology',
        'skin'        => 'Dermatology',
        'rash'        => 'Dermatology',
        'acne'        => 'Dermatology',
        'bone'        => 'Orthopedics',
        'joint'       => 'Orthopedics',
        'fracture'    => 'Orthopedics',
        'brain'       => 'Neurology',
        'headache'    => 'Neurology',
        'seizure'     => 'Neurology',
        'child'       => 'Pediatrics',
        'baby'        => 'Pediatrics',
        'infant'      => 'Pediatrics',
        'eye'         => 'Ophthalmology',
        'vision'      => 'Ophthalmology',
        'teeth'       => 'Dentistry',
        'tooth'       => 'Dentistry',
        'dental'      => 'Dentistry',
        'mental'      => 'Psychiatry',
        'anxiety'     => 'Psychiatry',
        'depression'  => 'Psychiatry',
        'pregnancy'   => 'Gynecology',
        'gynec'       => 'Gynecology',
        'kidney'      => 'Nephrology',
        'urine'       => 'Nephrology',
        'sugar'       => 'Endocrinology',
        'diabetes'    => 'Endocrinology',
        'thyroid'     => 'Endocrinology',
        'ear'         => 'ENT',
        'nose'        => 'ENT',
        'throat'      => 'ENT',
    ];

    public function __construct($db)
    {
        $this->doctors = $db->doctors;
        $this->queues  = $db->queues;
    }

    // Find the best available doctor for a given problem on a given date.
    // Returns an array with doctor info, or null if none found.
    public function assign(string $problemDescription, string $date): ?array
    {
        $specialization = $this->detectSpecialization($problemDescription);

        // Try matched specialization first, fall back to General Medicine
        $result = $this->findBestDoctor($specialization, $date);

        if (!$result && $specialization !== 'General Medicine') {
            $result = $this->findBestDoctor('General Medicine', $date);
        }

        return $result;
    }

    // Tokenize problem description and match against keyword map.
    private function detectSpecialization(string $problem): string
    {
        $words = preg_split('/\s+/', strtolower(trim($problem)));

        foreach ($words as $word) {
            // Strip punctuation
            $word = preg_replace('/[^a-z]/', '', $word);
            if (isset($this->keywordMap[$word])) {
                return $this->keywordMap[$word];
            }
        }

        return 'General Medicine';
    }

    // Find on_duty doctor with the shortest active queue for the given date.
    private function findBestDoctor(string $specialization, string $date): ?array
    {
        $dateObj = new MongoDB\BSON\UTCDateTime(strtotime($date) * 1000);

        // Get all on_duty doctors with this specialization
        $cursor = $this->doctors->find([
            'specialization' => $specialization,
            'status'         => 'on_duty',
        ]);

        $best       = null;
        $bestLoad   = PHP_INT_MAX;

        foreach ($cursor as $doc) {
            $queue = $this->queues->findOne([
                'doctor_id' => $doc['_id'],
                'date'      => $dateObj,
            ]);

            $load = $queue ? (int) $queue['total_active'] : 0;

            if ($load < $bestLoad) {
                $bestLoad = $load;
                $best     = [
                    'doctor_id'            => (string) $doc['_id'],
                    'name'                 => $doc['name'],
                    'specialization'       => $doc['specialization'],
                    'current_queue_length' => $load,
                ];
            }
        }

        return $best;
    }
}
