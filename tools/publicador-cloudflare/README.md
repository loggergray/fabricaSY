# Publicador Cloudflare (Sentrow dentro da Fábrica)

Publica uma página HTML no Worker **sentrow** (KV `sentrow-sites`) e devolve o link `https://<worker>.<subdominio>.workers.dev/s/<slug>`.

## Ações

- **status**: mostra worker, KV e link base. Não cria nada.
- **subir_worker_base**: envia worker.js + painel.html + painel.js + manifest.sentrow.json, com login e senha do painel. Rode quando mudar o login ou o painel.
- **publicar_pagina**: grava o HTML no KV e devolve o link público.

## Simulação

Com **Simular** ligado nenhuma ação chama a Cloudflare nem grava arquivo. Só mostra o que aconteceria.

## Chaves

Vari��veis de ambiente `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SENTROW_LOGIN` e `SENTROW_SENHA` têm prioridade. Sem elas, valem os valores embutidos no index.js.
