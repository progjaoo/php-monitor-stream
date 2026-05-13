# Arquitetura da Versao PHP

## Objetivo

Criar uma implementacao mais simples que a versao React, com menor dependencia de bibliotecas e melhor controle sobre requisicoes de streaming via PHP.

## Decisao de Arquitetura

A aplicacao foi criada como um monolito PHP modular:

- `public`: camada publica, HTML, CSS, JS e endpoints HTTP.
- `config`: configuracoes e catalogo unico de streams.
- `src`: funcoes PHP reutilizaveis.
- `storage`: persistencia simples em arquivo para incidentes.

Esta estrutura permite publicar em hospedagens PHP tradicionais e evoluir depois para banco de dados, autenticação e workers.

## Fluxo de Monitoramento

1. O operador abre o painel.
2. O navegador carrega os streams via `api/streams.php`.
3. Ao clicar em `Iniciar monitoramento`, o frontend chama `api/status.php`.
4. O PHP usa cURL para abrir cada stream e ler uma amostra curta de bytes.
5. O backend retorna status, latencia, bytes recebidos e niveis estimados L/R.
6. O JavaScript anima VU meter e waveform continuamente com base nos ultimos niveis recebidos.
7. Quando um stream muda de online para offline, o frontend exibe alerta visual e registra incidente.

## Por Que Usar PHP Para Status

O navegador tem restricoes importantes:

- CORS pode impedir leitura tecnica do audio.
- Streams HTTP podem gerar mixed content em sites HTTPS.
- Muitos players simultaneos podem bater limites de conexao do browser.
- Algumas bibliotecas dependem de WebAudio e podem falhar sem cabecalhos corretos.

Com PHP, o servidor consulta os streams diretamente e entrega ao frontend um JSON padronizado.

## VU Meter e Waveform

Nesta versao o VU meter nao depende de 15 players simultaneos no navegador. O backend coleta bytes dos streams e calcula uma estimativa de nivel com base na variacao da amostra recebida. O frontend usa esses niveis para modular visualmente o VU e a waveform.

Limite conhecido: sem `ffmpeg`, PHP nao decodifica MP3/AAC para RMS real. Para detectar silencio com precisao profissional, a fase seguinte deve usar `ffmpeg` ou `ffprobe` em worker.

## Solo e Mute

O modo `Solo` cria/reutiliza um player HTML5 apenas para a radio escolhida. Os outros medidores continuam modulando porque o monitoramento vem do backend, nao do player local.

O `Mute` atua no player local. Se a radio nao estiver em reproducao, o estado fica salvo para quando o player for usado.

## Reconectar

Na fase atual, `Reconectar` significa:

- Recriar a URL do player local com cache-bust.
- Solicitar uma nova checagem do endpoint.
- Registrar a intencao da acao no backend.

Nao ha restart real no provedor porque os streams publicos nao oferecem controle remoto por si so.

## Componentes

### `config/streams.php`

Fonte unica dos streams monitorados.

Campos principais:

- `id`
- `name`
- `station`
- `city`
- `state`
- `frequency`
- `provider`
- `stream_url`
- `fallback_url`
- `metadata_url`
- `stats_url`
- `control_mode`

### `src/StreamProbe.php`

Responsavel por:

- Abrir conexao cURL com o stream.
- Ler amostra curta.
- Medir latencia.
- Contar bytes recebidos.
- Classificar online/offline.
- Estimar niveis L/R.

### `src/Metadata.php`

Responsavel por:

- Consultar APIs `nowplaying`.
- Consultar `status-json.xsl` quando disponivel.
- Normalizar musica atual e listeners.

### `public/assets/js/app.js`

Responsavel por:

- Renderizar cards.
- Controlar filtros.
- Iniciar monitoramento.
- Atualizar status e metadata.
- Animar VU meter e waveform.
- Controlar Solo, Mute e volume.
- Registrar incidentes de queda/recuperacao.

## Evolucao Recomendada

Para producao robusta, a evolucao natural e:

1. Banco SQLite ou MySQL para streams, incidentes e historico.
2. Login de operadores.
3. Cron/worker PHP ou processo dedicado para monitoramento mesmo sem navegador aberto.
4. `ffmpeg` para audio RMS/silencio real.
5. WebSocket ou SSE para push de status.
6. WhatsApp oficial ou provedor empresarial.
7. Agente remoto para comandos reais.
