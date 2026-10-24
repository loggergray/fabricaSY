#!/bin/bash
# Testa o Synapse no Render, de fora.
# Uso: ./testar-mcp.sh https://SEU-SERVICO.onrender.com SEU_SYNAPSE_TOKEN
BASE="${1%/}"
TOKEN="$2"
[ -n "$BASE" ] && [ -n "$TOKEN" ] || { echo "Uso: ./testar-mcp.sh https://SEU-SERVICO.onrender.com SYNAPSE_TOKEN"; exit 1; }

INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"teste","version":"1"}}}'
LISTA='{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
NOTIF='{"jsonrpc":"2.0","method":"notifications/initialized"}'
ENTRAR='{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"synapse","arguments":{"acao":"entrar","dispositivo":"teste","papel":"executor"}}}'
CORPO='Content-Type: application/json'
ACEITA='Accept: application/json, text/event-stream'
URL="$BASE/a/mcp1/t/$TOKEN/mcp"

cod() { curl -s -m "${T:-30}" -o /dev/null -w '%{http_code}' "$@"; }
ver() { [ "$1" = "$2" ] && echo "   OK ($1)" || echo "   FALHOU (HTTP $1, esperado $2)"; }

echo "1) /saude (se o Render estava dormindo, a primeira chamada leva até ~60 s)"
T=90 curl -s -m 90 -w '\n   HTTP %{http_code}\n' "$BASE/saude" | cut -c1-300

echo; echo "2) POST sem token deve dar 401"
ver "$(cod -X POST "$BASE/mcp" -H "$CORPO" -H "$ACEITA" -d "$INIT")" 401

echo; echo "3) token errado deve dar 401"
ver "$(cod -X POST "$BASE/a/mcp1/t/errado/mcp" -H "$CORPO" -H "$ACEITA" -d "$INIT")" 401

echo; echo "4) initialize com o token na URL"
curl -s -m 30 -w '\n   HTTP %{http_code}\n' -X POST "$URL" -H "$CORPO" -H "$ACEITA" -d "$INIT" | cut -c1-300

echo; echo "5) notifications/initialized (202)"
ver "$(cod -X POST "$URL" -H "$CORPO" -H "$ACEITA" -d "$NOTIF")" 202

echo; echo "6) tools/list"
curl -s -m 30 -w '\n   HTTP %{http_code}\n' -X POST "$URL" -H "$CORPO" -H "$ACEITA" -d "$LISTA" | cut -c1-300

echo; echo "7) tools/call acao=entrar (agente mcp1 vem da URL)"
curl -s -m 30 -w '\n   HTTP %{http_code}\n' -X POST "$URL" -H "$CORPO" -H "$ACEITA" -d "$ENTRAR" | cut -c1-400

echo; echo "8) URL sem /mcp no fim (alguns conectores são cadastrados assim)"
ver "$(cod -X POST "$BASE/a/mcp1/t/$TOKEN" -H "$CORPO" -H "$ACEITA" -d "$INIT")" 200

echo; echo "9) token por query (?token=)"
ver "$(cod -X POST "$BASE/a/mcp1/mcp?token=$TOKEN" -H "$CORPO" -H "$ACEITA" -d "$INIT")" 200

echo; echo "10) GET no endpoint MCP deve dar 405 (não 404)"
ver "$(cod "$BASE/a/mcp1/t/$TOKEN/mcp")" 405

echo
echo "Leitura rápida:"
echo " - passo 1 demora ou falha: serviço dormindo ou deploy com erro (veja Logs no Render)."
echo " - passo 4 com 401: o SYNAPSE_TOKEN do Render é diferente do que você passou (confira espaços)."
echo " - tudo OK aqui e o conector falha: cole a mensagem exata do conector e o trecho [http] dos Logs do Render."
