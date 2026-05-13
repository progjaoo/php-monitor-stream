<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function fetch_stream_metadata(array $stream): array
{
    $metadata = [
        'id' => $stream['id'],
        'title' => null,
        'artist' => null,
        'song' => null,
        'listeners' => null,
        'isLive' => null,
        'source' => null,
        'checkedAt' => now_iso(),
    ];

    if (!empty($stream['metadata_url'])) {
        $result = fetch_json_url($stream['metadata_url']);
        if ($result['ok']) {
            return array_merge($metadata, normalize_nowplaying_payload($result['json']), [
                'source' => 'metadata',
            ]);
        }
    }

    if (!empty($stream['stats_url'])) {
        $result = fetch_json_url($stream['stats_url']);
        if ($result['ok']) {
            return array_merge($metadata, normalize_icecast_payload($result['json']), [
                'source' => 'stats',
            ]);
        }
    }

    return $metadata;
}

function fetch_json_url(string $url): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT_MS => 1800,
        CURLOPT_TIMEOUT_MS => (int)config_value('metadata_timeout_ms', 3500),
        CURLOPT_USERAGENT => 'MonitoramentoPhp/1.0',
        CURLOPT_NOSIGNAL => true,
    ]);

    $body = curl_exec($ch);
    $errno = curl_errno($ch);
    $httpStatus = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($errno !== 0 || !is_string($body) || $body === '' || ($httpStatus >= 400 && $httpStatus !== 0)) {
        return ['ok' => false, 'json' => null];
    }

    $json = json_decode($body, true);
    return ['ok' => is_array($json), 'json' => $json];
}

function normalize_nowplaying_payload(array $payload): array
{
    $song = $payload['now_playing']['song'] ?? $payload['song'] ?? [];
    $title = is_array($song) ? ($song['title'] ?? null) : null;
    $artist = is_array($song) ? ($song['artist'] ?? null) : null;
    $text = trim(implode(' - ', array_filter([$artist, $title])));

    if ($text === '') {
        $text = $payload['now_playing']['song']['text'] ?? $payload['now_playing']['song']['name'] ?? null;
    }

    return [
        'title' => $title,
        'artist' => $artist,
        'song' => $text,
        'listeners' => $payload['listeners']['current'] ?? $payload['listeners']['total'] ?? null,
        'isLive' => $payload['live']['is_live'] ?? null,
    ];
}

function normalize_icecast_payload(array $payload): array
{
    $source = $payload['icestats']['source'] ?? null;
    if (is_array($source) && array_is_list($source)) {
        $source = $source[0] ?? null;
    }

    if (!is_array($source)) {
        return [
            'song' => null,
            'listeners' => null,
            'isLive' => null,
        ];
    }

    return [
        'song' => $source['title'] ?? $source['yp_currently_playing'] ?? null,
        'listeners' => $source['listeners'] ?? null,
        'isLive' => true,
    ];
}
