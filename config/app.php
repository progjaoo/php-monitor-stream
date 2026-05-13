<?php

return [
    'app_name' => 'InfoAudio Link - Monitoramento PHP',
    'timezone' => 'America/Sao_Paulo',
    'status_timeout_ms' => 5500,
    'connect_timeout_ms' => 2500,
    'metadata_timeout_ms' => 3500,
    'max_probe_bytes' => 49152,
    'min_online_bytes' => 3072,
    'silence_level_threshold' => 0.025,
    'incident_storage' => __DIR__ . '/../storage/incidents.json',
];
