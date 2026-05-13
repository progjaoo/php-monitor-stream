<?php

require_once __DIR__ . '/../../src/bootstrap.php';

handle_options();

$storage = (string)config_value('incident_storage');
if (!is_file($storage)) {
    @file_put_contents($storage, "[]\n");
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $items = json_decode((string)@file_get_contents($storage), true);
    json_response([
        'ok' => true,
        'items' => is_array($items) ? array_slice(array_reverse($items), 0, 100) : [],
    ]);
}

require_method('POST');

$body = read_json_body();
$event = [
    'id' => bin2hex(random_bytes(8)),
    'streamId' => (string)($body['streamId'] ?? ''),
    'type' => (string)($body['type'] ?? 'status'),
    'status' => (string)($body['status'] ?? ''),
    'message' => (string)($body['message'] ?? ''),
    'createdAt' => now_iso(),
];

$handle = fopen($storage, 'c+');
if ($handle === false) {
    json_response(['ok' => false, 'error' => 'Nao foi possivel abrir storage de incidentes.'], 500);
}

flock($handle, LOCK_EX);
$contents = stream_get_contents($handle);
$items = json_decode($contents === false ? '[]' : $contents, true);
$items = is_array($items) ? $items : [];
$items[] = $event;
$items = array_slice($items, -500);
ftruncate($handle, 0);
rewind($handle);
fwrite($handle, json_encode($items, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
flock($handle, LOCK_UN);
fclose($handle);

json_response(['ok' => true, 'event' => $event], 201);
