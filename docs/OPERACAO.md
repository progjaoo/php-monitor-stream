# Operacao do Painel

## Iniciar Monitoramento

Clique em `Iniciar monitoramento`.

O painel passa a consultar os endpoints PHP e atualiza:

- Status online/offline.
- VU meter L/R.
- Waveform.
- Latencia.
- Bytes recebidos.
- Musica atual quando disponivel.

## Monitorar Radios Especificas

1. Clique em `Selecionar radios`.
2. Marque as radios desejadas.
3. Clique em `Aplicar`.

Para voltar ao painel completo, clique em `Voltar ao normal`.

## Solo

O botao `Solo` reproduz apenas a radio selecionada. Os medidores das outras radios continuam ativos porque eles sao alimentados pelas leituras do backend.

Clique em `Sair Solo` para parar a reproducao local.

## Mute

O botao `Mute` muta o player local da radio. Se a radio nao estiver tocando no navegador, o estado fica preparado para quando ela for reproduzida.

## Reconectar

O botao `Reconectar` recria o player local e pede uma nova checagem de status.

Importante: isto nao reinicia o servidor de streaming remoto. Para isso sera necessario integrar API do provedor ou agente remoto.

## Colunas e Zoom

Use os botoes `1 coluna`, `2`, `3`, `4` para ajustar a visualizacao.

Use `100%`, `-` e `+` para alterar o zoom do painel.

## Incidentes

Quando um stream muda de online para offline ou volta a ficar online, o frontend registra um evento em:

```text
storage/incidents.json
```

Este historico e simples e adequado para MVP. Para producao, trocar por banco de dados.

## Adicionar ou Alterar Stream

Edite:

```text
config/streams.php
```

Modelo:

```php
[
    'id' => 'identificador-unico',
    'name' => 'Radio Maravilha FM',
    'station' => 'Maravilha FM - Afiliada',
    'city' => 'Cidade',
    'state' => 'MG',
    'frequency' => '89,1 MHz',
    'provider' => 'Soundstream',
    'protocol' => 'Icecast2',
    'stream_url' => 'https://exemplo/listen/slug/live',
    'fallback_url' => 'http://exemplo:8000/live',
    'metadata_url' => 'https://exemplo/api/nowplaying/slug',
    'stats_url' => 'http://exemplo:8000/status-json.xsl',
    'control_mode' => 'observador',
]
```

Depois de salvar, recarregue o painel.

## Checklist de Publicacao

- PHP 8.1+ ativo.
- `curl` ativo.
- `storage` gravavel.
- Document root apontando para `public`.
- HTTPS ativo no dominio.
- Testar `api/streams.php` no navegador.
- Testar `api/status.php` no navegador.
- Abrir o painel e clicar em `Iniciar monitoramento`.
