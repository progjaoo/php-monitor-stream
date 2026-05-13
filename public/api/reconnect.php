<?php

require_once __DIR__ . '/../../src/bootstrap.php';

handle_options();
require_method('POST');

$body = read_json_body();
$id = (string)($body['id'] ?? $_POST['id'] ?? '');
$stream = stream_by_id($id);

if ($stream === null) {
    json_response(['ok' => false, 'error' => 'Streaming nao encontrado.'], 404);
}

json_response([
    'ok' => true,
    'id' => $stream['id'],
    'controlMode' => $stream['control_mode'],
    'message' => 'Reconexao local solicitada. Como o stream esta em modo observador, o sistema reinicia o player e revalida o endpoint publico.',
    'checkedAt' => now_iso(),
]);