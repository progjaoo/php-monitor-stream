<?php

require_once __DIR__ . '/../../src/Metadata.php';

handle_options();
require_method('GET');

$items = [];
foreach (requested_streams() as $stream) {
    $items[] = fetch_stream_metadata($stream);
}

json_response([
    'ok' => true,
    'checkedAt' => now_iso(),
    'items' => $items,
]);
