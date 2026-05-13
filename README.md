# Monitoramento PHP de Streams de Radio

Aplicacao criada com HTML, CSS, JavaScript e PHP para monitorar os streamings listados no PRD e em `streamings.md`.

O objetivo desta versao e substituir a dependencia do React por uma estrutura mais simples de publicar em hospedagens PHP, mantendo controle server-side sobre status, proxy de audio, metadata e incidentes basicos.

## O Que Foi Criado

- Painel web com visual proximo ao modelo de referencia.
- Botao `Iniciar monitoramento`.
- Cards por radio com status, VU meter, waveform, metadata e controles.
- Botoes por card: `Reconectar`, `Mute` e `Solo`.
- Botoes globais: mutar todos, reconectar todos, zoom e colunas 1/2/3/4.
- Combo com checkbox para monitorar radios especificas.
- Opcao `Voltar ao normal` para exibir todas as radios.
- Backend PHP com endpoints para listar streams, checar status, buscar metadata, proxyar audio e registrar incidentes.
- Catalogo unico de streams em `config/streams.php`.
- Registro basico de incidentes em `storage/incidents.json`.

## Estrutura

```text
Monitoramento-Php/
  config/
    app.php
    streams.php
  docs/
    ARQUITETURA.md
    OPERACAO.md
  public/
    index.php
    .htaccess
    api/
      audio.php
      incidents.php
      now-playing.php
      reconnect.php
      status.php
      streams.php
    assets/
      css/styles.css
      js/app.js
  src/
    bootstrap.php
    Metadata.php
    StreamProbe.php
  storage/
    incidents.json
  index.php
```

## Requisitos

- PHP 8.1 ou superior.
- Extensao `curl` habilitada.
- Permissao de escrita na pasta `storage`.
- Servidor web Apache/Nginx ou servidor embutido do PHP para desenvolvimento.

## Como Rodar Localmente

Na raiz deste repositorio:

```bash
cd Monitoramento-Php
php -S 127.0.0.1:8080 -t public
```

Acesse:

```text
http://127.0.0.1:8080
```

## Como Publicar

Recomendacao de producao:

1. Enviar a pasta `Monitoramento-Php` para o servidor.
2. Configurar o document root do dominio/subdominio para `Monitoramento-Php/public`.
3. Garantir que `Monitoramento-Php/storage` tenha permissao de escrita pelo PHP.
4. Confirmar que a extensao PHP `curl` esta ativa.
5. Acessar o site e clicar em `Iniciar monitoramento`.

Se a hospedagem nao permitir configurar document root, e possivel acessar `/public/`, mas o ideal e nunca expor `config`, `src` e `storage` diretamente.

## Endpoints

- `GET /api/streams.php`: lista os streams publicos do painel.
- `GET /api/status.php`: consulta status de todos os streams.
- `GET /api/status.php?ids=id1,id2`: consulta status de streams especificos.
- `GET /api/now-playing.php`: busca metadata/musica atual quando disponivel.
- `GET /api/audio.php?id=stream-id`: proxy de audio para reproducao local.
- `POST /api/reconnect.php`: registra solicitacao de reconexao local do player.
- `GET /api/incidents.php`: lista incidentes recentes.
- `POST /api/incidents.php`: registra queda/recuperacao detectada no painel.

## Observacao Tecnica Importante

Esta versao opera em `modo observador`: ela monitora URLs publicas de streaming. O botao `Reconectar` reinicia o player local e revalida o endpoint, mas nao reinicia o encoder nem o servidor de streaming remoto.

Para reconexao real sera necessario integrar com:

- API do provedor de streaming.
- Acesso ao painel do provedor.
- Agente remoto instalado na emissora.
- Rotina segura para restart de encoder/servico.

## Segurança

O arquivo `streamings.md` contem dados operacionais sensiveis. Esta aplicacao nao copia senhas, logins ou credenciais para o frontend. O catalogo em `config/streams.php` contem apenas URLs publicas de audio, metadata e stats.

## Proximas Etapas

- Adicionar autenticacao para operadores.
- Persistir historico em banco de dados.
- Adicionar WhatsApp via provider oficial ou gateway homologado.
- Criar worker/cron para monitoramento 24/7 independente do navegador.
- Implementar deteccao real de silencio com `ffmpeg` quando houver servidor dedicado.
- Integrar comandos reais de reconexao quando houver API/agente remoto.
