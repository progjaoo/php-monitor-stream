<?php

declare(strict_types=1);

$GLOBALS['monitor_config'] = require __DIR__ . '/../config/app.php';
$GLOBALS['monitor_streams'] = require __DIR__ . '/../config/streams.php';

date_default_timezone_set($GLOBALS['monitor_config']['timezone']);

function config_value(string $key, mixed $default = null): mixed
{
    return $GLOBALS['monitor_config'][$key] ?? $default;
}

function all_streams(): array
{
    return $GLOBALS['monitor_streams'];
}

function stream_by_id(string $id): ?array
{
    foreach (all_streams() as $stream) {
        if ($stream['id'] === $id) {
            return $stream;
        }
    }

    return null;
}

function public_stream(array $stream): array
{
    return [
        'id' => $stream['id'],
        'name' => $stream['name'],
        'station' => $stream['station'],
        'city' => $stream['city'],
        'state' => $stream['state'],
        'frequency' => $stream['frequency'],
        'provider' => $stream['provider'],
        'protocol' => $stream['protocol'],
        'streamUrl' => $stream['stream_url'],
        'fallbackUrl' => $stream['fallback_url'],
        'hasMetadata' => !empty($stream['metadata_url']) || !empty($stream['stats_url']),
        'controlMode' => $stream['control_mode'],
    ];
}

function json_response(array $payload, int $statusCode = 200): never
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    header('Access-Control-Allow-Origin: *');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function handle_options(): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        exit;
    }
}

function require_method(string $method): void
{
    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        json_response(['ok' => false, 'error' => 'Metodo nao permitido.'], 405);
    }
}

function requested_streams(): array
{
    $ids = trim((string)($_GET['ids'] ?? $_GET['id'] ?? ''));

    if ($ids === '') {
        return all_streams();
    }

    $selected = [];
    foreach (explode(',', $ids) as $id) {
        $stream = stream_by_id(trim($id));
        if ($stream !== null) {
            $selected[] = $stream;
        }
    }

    return $selected;
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function now_iso(): string
{
    return date(DATE_ATOM);
}
