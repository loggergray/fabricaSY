# Por que ninguém conectava no MCP (Render)

Base: leitura do código e dos dois prints do conector ("Verificando o servidor" com "Conectando ao servidor: Não encontrado", e "Não foi possível iniciar o login" ao tocar em Conectar). Nada foi executado: só vale como confirmado quando `./testar-mcp.sh` passar e o conector ligar.

## O que acontecia

1. **URL sem o token.** O servidor exige token. O conector do Claude não tem campo para header fixo, então a 401 sem token faz o Claude achar que o servidor usa OAuth, procurar `/.well-known/...`, não achar nada e mostrar "não foi possível determinar como este servidor faz login" e depois "não foi possível iniciar o login". O token precisa ir na URL.
2. **URL sem `/mcp` no fim.** O print mostra uma URL do tipo `.../a/m...`. Com `/a/mcp1` sozinho, o caminho virava `/` e o servidor tratava o POST como arquivo estático: respondia 404 "não encontrado", exatamente a mensagem do print. O endpoint MCP só existia em `/mcp`.
3. **GET no endpoint dava 404** em vez de 405. Clientes que sondam por GET entendem 404 como "não existe".
4. **Modo nuvem dependia de variável.** Sem `FABRICA_MODE=cloud` no Render, o servidor escutava só em 127.0.0.1 (o Render não alcança) e só aceitava host localhost.
5. **406 por causa do Accept** e **erro -32602** para versão de protocolo desconhecida: dois jeitos de recusar clientes que o MCP manda aceitar.
6. **Plano grátis dormindo:** a primeira chamada depois de ~15 min demora cerca de um minuto e pode estourar o tempo da verificação do conector.

## O que foi corrigido no código

- O servidor agora é só Render: escuta em `0.0.0.0` na porta de `PORT`, token obrigatório, qualquer host aceito por padrão.
- O token é aceito em `/t/<token>`, em `?token=` ou no header, em qualquer ordem com `/a/<agente>`.
- POST em qualquer caminho fora de `/api` é tratado como MCP, então a URL funciona com ou sem `/mcp` no fim.
- GET/DELETE no endpoint devolvem 405 com `Allow: POST`.
- Sem exigência de Accept; versão de protocolo desconhecida negocia para `2025-06-18`; `resources/list` e `prompts/list` devolvem lista vazia.
- Token comparado em tempo constante e com espaços aparados.
- Cada requisição aparece nos Logs do Render como `[http] POST /mcp (mcp1) initialize -> 200`, sem expor o token.

## O que você faz

1. No Render, confirme `SYNAPSE_TOKEN` (sem espaços) e faça o deploy da branch.
2. Abra `https://SEU-SERVICO.onrender.com/saude` para acordar o serviço.
3. Apague o conector antigo e cadastre de novo com a URL completa: `https://SEU-SERVICO.onrender.com/a/mcp1/t/SEU_SYNAPSE_TOKEN/mcp`.
4. Se ainda falhar, rode `./testar-mcp.sh` e cole o resultado, mais as linhas `[http]` dos Logs.
