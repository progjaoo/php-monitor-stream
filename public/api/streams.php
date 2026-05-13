<?php

require_once __DIR__ . '/../../src/bootstrap.php';

handle_options();
require_method('GET');

json_response([
    'ok' => true,
    'app' => config_value('app_name'),
    'streams' => array_map('public_stream', all_streams()),
]);
