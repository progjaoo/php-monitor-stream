<?php

require_once __DIR__ . '/../../src/StreamProbe.php';

handle_options();
require_method('GET');

$streams = requested_streams();
$statuses = [];

foreach ($streams as $stream) {
    $statuses[] = probe_stream($stream);
}

json_response([
    'ok' => true,
    'checkedAt' => now_iso(),
    'statuses' => $statuses,
]);
