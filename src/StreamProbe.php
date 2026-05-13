<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/Metadata.php';

function probe_stream(array $stream): array
{
    $primary = probe_url($stream['stream_url'], 'primary');

    $probe = $primary;
    if (!$primary['online'] && !empty($stream['fallback_url'])) {
        $fallback = probe_url($stream['fallback_url'], 'fallback');
        if ($fallback['online'] || $fallback['receivedBytes'] > $primary['receivedBytes']) {
            $probe = $fallback;
        }
    }

    [$levelL, $levelR] = estimate_levels($probe['sample'], $stream['id']);
    $audioState = 'offline';
    if ($probe['online']) {
        $audioState = max($levelL, $levelR) <= config_value('silence_level_threshold', 0.025) ? 'silence' : 'audio';
    }

    if ($probe['online'] && !empty($stream['metadata_offline_means_down']) && metadata_indicates_offline($stream)) {
        $probe['online'] = false;
        $probe['detail'] = 'Metadata do provedor informa Station Offline.';
        $levelL = 0.0;
        $levelR = 0.0;
        $audioState = 'offline';
    }

    return [
        'id' => $stream['id'],
        'status' => $probe['online'] ? 'online' : 'offline',
        'audioState' => $audioState,
        'detail' => $probe['detail'],
        'source' => $probe['source'],
        'url' => $probe['url'],
        'latencyMs' => $probe['latencyMs'],
        'receivedBytes' => $probe['receivedBytes'],
        'httpStatus' => $probe['httpStatus'],
        'contentType' => $probe['contentType'],
        'levelL' => $levelL,
        'levelR' => $levelR,
        'checkedAt' => now_iso(),
    ];
}

function metadata_indicates_offline(array $stream): bool
{
    if (empty($stream['metadata_url'])) {
        return false;
    }

    $metadata = fetch_stream_metadata($stream);
    $song = strtolower((string)($metadata['song'] ?? ''));
    $isLive = $metadata['isLive'] ?? null;

    return $isLive === false || str_contains($song, 'station offline');
}

function probe_url(string $url, string $source): array
{
    $maxBytes = (int)config_value('max_probe_bytes', 49152);
    $minBytes = (int)config_value('min_online_bytes', 3072);
    $buffer = '';
    $abortedByLimit = false;
    $startedAt = microtime(true);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT_MS => (int)config_value('connect_timeout_ms', 2500),
        CURLOPT_TIMEOUT_MS => (int)config_value('status_timeout_ms', 5500),
        CURLOPT_USERAGENT => 'MonitoramentoPhp/1.0',
        CURLOPT_HTTPHEADER => [
            'Accept: */*',
            'Cache-Control: no-cache',
            'Icy-MetaData: 1',
        ],
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_HEADER => false,
        CURLOPT_NOSIGNAL => true,
        CURLOPT_BUFFERSIZE => 16384,
        CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$buffer, &$abortedByLimit, $maxBytes): int {
            $remaining = $maxBytes - strlen($buffer);
            if ($remaining <= 0) {
                $abortedByLimit = true;
                return 0;
            }

            $length = strlen($chunk);
            if ($length > $remaining) {
                $buffer .= substr($chunk, 0, $remaining);
                $abortedByLimit = true;
                return 0;
            }

            $buffer .= $chunk;
            return $length;
        },
    ]);

    curl_exec($ch);
    $errno = curl_errno($ch);
    $error = curl_error($ch);
    $info = curl_getinfo($ch);

    $latencyMs = (int)round((microtime(true) - $startedAt) * 1000);
    $bytes = strlen($buffer);
    $httpStatus = (int)($info['http_code'] ?? 0);
    $contentType = (string)($info['content_type'] ?? '');
    $stoppedAfterEnoughBytes = $errno === CURLE_WRITE_ERROR && $abortedByLimit && $bytes >= $minBytes;
    $httpLooksValid = $httpStatus === 0 || ($httpStatus >= 200 && $httpStatus < 400);
    $online = $bytes >= $minBytes && ($errno === 0 || $stoppedAfterEnoughBytes) && $httpLooksValid;

    if ($online) {
        $detail = 'Recebendo audio do streaming.';
    } elseif ($bytes > 0) {
        $detail = 'Recebeu poucos bytes antes de encerrar.';
    } elseif ($error !== '') {
        $detail = $error;
    } else {
        $detail = 'Sem dados recebidos.';
    }

    return [
        'url' => $url,
        'source' => $source,
        'online' => $online,
        'detail' => $detail,
        'latencyMs' => $latencyMs,
        'receivedBytes' => $bytes,
        'httpStatus' => $httpStatus,
        'contentType' => $contentType,
        'sample' => $buffer,
        'curlError' => $errno,
    ];
}

function estimate_levels(string $sample, string $seed): array
{
    $length = strlen($sample);
    if ($length === 0) {
        return [0.0, 0.0];
    }

    $step = max(1, (int)floor($length / 4096));
    $sumL = 0.0;
    $sumR = 0.0;
    $countL = 0;
    $countR = 0;
    $index = 0;

    for ($i = 0; $i < $length; $i += $step) {
        $value = abs(ord($sample[$i]) - 128) / 128;
        if ($index % 2 === 0) {
            $sumL += $value * $value;
            $countL++;
        } else {
            $sumR += $value * $value;
            $countR++;
        }
        $index++;
    }

    $levelL = $countL > 0 ? sqrt($sumL / $countL) : 0.0;
    $levelR = $countR > 0 ? sqrt($sumR / $countR) : $levelL;
    $phase = (crc32($seed) % 628) / 100;
    $jitterL = 0.94 + (sin(microtime(true) * 2.1 + $phase) * 0.06);
    $jitterR = 0.94 + (cos(microtime(true) * 1.8 + $phase) * 0.06);

    return [
        round(max(0.0, min(1.0, $levelL * 1.65 * $jitterL)), 3),
        round(max(0.0, min(1.0, $levelR * 1.65 * $jitterR)), 3),
    ];
}
