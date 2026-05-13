<?php

require_once __DIR__ . '/../../src/bootstrap.php';

handle_options();
require_method('GET');

$id = (string)($_GET['id'] ?? '');
$stream = stream_by_id($id);
if ($stream === null) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Streaming nao encontrado.';
    exit;
}

$useFallback = ($_GET['fallback'] ?? '') === '1';
$url = $useFallback && !empty($stream['fallback_url']) ? $stream['fallback_url'] : $stream['stream_url'];

ignore_user_abort(true);
set_time_limit(0);

header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Content-Type: audio/mpeg');
header('X-Accel-Buffering: no');

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_CONNECTTIMEOUT_MS => 2500,
    CURLOPT_TIMEOUT => 0,
    CURLOPT_USERAGENT => 'MonitoramentoPhp/1.0',
    CURLOPT_HTTPHEADER => [
        'Accept: */*',
        'Icy-MetaData: 1',
    ],
    CURLOPT_RETURNTRANSFER => false,
    CURLOPT_HEADER => false,
    CURLOPT_NOSIGNAL => true,
    CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk): int {
        echo $chunk;
        @ob_flush();
        flush();
        return strlen($chunk);
    },
]);

curl_exec($ch);
