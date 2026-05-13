<?php

require_once __DIR__ . '/../src/bootstrap.php';
$appName = htmlspecialchars((string)config_value('app_name'), ENT_QUOTES, 'UTF-8');
?>
<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#2d3038">
    <meta property="og:title" content="InfoAudio Link - Monitoramento">
    <meta property="og:description" content="Monitoramento operacional de streams da Rede Maravilha">
    <title><?= $appName ?></title>
    <link rel="stylesheet" href="assets/css/styles.css">
    <script src="assets/js/app.js" defer></script>
</head>
<body>
    <header class="topbar">
        <div class="logo-group">
            <div class="badge-maravilha">maravilha <span>REDE</span></div>
            <div class="logo-center">
                <div class="logo-main">
                    <span class="logo-info">info</span><span class="logo-audio">audio</span>
                </div>
                <div class="logo-sub">LINK MANAGER</div>
            </div>
            <div class="badge-maravilha">maravilha <span>REDE</span></div>
        </div>
    </header>

    <nav class="toolbar" aria-label="Controles de monitoramento">
        <button id="play-all" class="wbtn primary">Escutar todos</button>
        <button id="mute-all" class="wbtn danger">Mutar todos</button>
        <button id="reconnect-all" class="wbtn success">Reconectar todos</button>
        <button id="toggle-columns" class="wbtn">Alterar modo (2 colunas)</button>

        <div class="filter-box">
            <button id="filter-toggle" class="wbtn">Selecionar radios</button>
            <div id="filter-menu" class="filter-menu" hidden>
                <div class="filter-header">
                    <strong>Monitorar radios especificas</strong>
                    <span id="filter-count">0 selecionadas</span>
                </div>
                <div id="filter-options" class="filter-options"></div>
                <div class="filter-actions">
                    <button id="apply-filter" class="wbtn primary small">Aplicar</button>
                    <button id="reset-filter" class="wbtn small">Voltar ao normal</button>
                </div>
            </div>
        </div>

        <button id="zoom-reset" class="wbtn compact">100%</button>
        <button id="zoom-out" class="wbtn compact">-</button>
        <button id="zoom-in" class="wbtn compact">+</button>
    </nav>

    <section class="notice">
        * Audios provenientes diretamente dos streamings publicos das emissoras. Controle remoto real depende de integracao com provedor ou encoder local.
    </section>

    <main id="monitor-shell">
        <section id="summary" class="summary">
            <div><strong id="summary-total">0</strong><span>streams</span></div>
            <div><strong id="summary-online">0</strong><span>online</span></div>
            <div><strong id="summary-offline">0</strong><span>offline</span></div>
            <div><strong id="summary-updated">--:--</strong><span>ultima leitura</span></div>
        </section>

        <section id="stream-grid" class="stream-grid cols-2" aria-live="polite"></section>
    </main>

    <footer class="footer">
        <strong>InfoAudio Link - Monitor</strong>
        <span>Versao PHP criada para monitoramento operacional com proxy/status server-side.</span>
    </footer>

    <div id="toast-stack" class="toast-stack" aria-live="assertive"></div>
</body>
</html>
