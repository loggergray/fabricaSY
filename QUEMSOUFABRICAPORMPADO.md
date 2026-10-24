# Como a Fábrica funciona hoje

Este documento descreve o que está presente no repositório Synapse desta branch. Não é evidência de que a versão foi implantada ou validada em runtime.

## 1. Servidor e rotas

`server.js` usa HTTP nativo do Node e carrega ferramentas de `tools/` por meio de `core/loader.js`. Em modo cloud (`FABRICA_MODE=cloud`), exige `SYNAPSE_TOKEN`, usa `0.0.0.0` por padrão e permite configurar a porta por `PORT`. Há rotas para health check, painel e transporte MCP.

| Rota | Comportamento observado |
|---|---|
| `GET /saude` | Health check com status, modo, quantidade de ferramentas e indicação de token configurado. |
| `POST /mcp` | Endpoint MCP padrão; aceita prefixos `/a/<agente>` e `/t/<token>`. |
| `GET /api/ferramentas` | Lista metadados das ferramentas. Requer Bearer em cloud. |
| `GET /api/padrao` | Lê `PADRAO.md`. Requer Bearer em cloud. |
| `GET /api/eventos` | SSE de eventos do catálogo, com heartbeat. Requer Bearer em cloud. Não transmite o diário de raciocínio. |
| `POST /api/executar/:id` | Executa uma ferramenta e transmite saída NDJSON. Requer Bearer em cloud. |
| `GET /` e arquivos públicos | Servem a interface estática. A autenticação está aplicada às APIs; os próprios arquivos estáticos são públicos. |

Em nuvem, o token vem do cabeçalho `Authorization: Bearer ...` ou do prefixo de caminho `/t/<token>`. O segundo formato pode expor o segredo em histórico de URL/logs. O painel usa o cabeçalho e não contém o valor do segredo.

## 2. Leitura e execução de ferramentas

`core/loader.js` procura pastas de ferramentas, lê `manifest.json`, verifica se `index.js` existe e constrói a lista de metadados. Pastas começadas por `.` ou `_` são ignoradas. A assinatura dos arquivos permite detectar mudança e atualizar a lista.

`core/runner.js` é iniciado em processo filho para a execução. O servidor envia entradas e a opção de simulação por IPC e converte mensagens/logs em linhas NDJSON. O runner fornece o contexto de execução usado pelas ferramentas. Backup não deve ser descrito como automático em toda escrita: a ferramenta precisa chamar explicitamente `ctx.backup` quando isso for exigido pelo seu fluxo.

Ferramentas presentes na árvore desta branch: `criar-ferramenta`, `modularizador-html` e `testandoideiaferramenta3`; também há o molde `_modelo`. Existe um README do auditor que ainda é texto placeholder. `tools/publicador-cloudflare` só contém um README na árvore consultada; seu `index.js` e manifest não foram encontrados nesta branch. `tools/ponte-mcp` e os arquivos citados para o roteiro do publicador também não foram encontrados nesta branch, então não é possível afirmar seus comportamentos a partir dela.

## 3. Estado, diário e painel

`core/agentes.js` implementa as ações de agentes, coordenação e diário; `core/mongo.js` fornece persistência opcional em MongoDB. Sem MongoDB, o processo usa arquivos locais em `DADOS_DIR`. O `render.yaml` atual não provisiona disco persistente e define `DADOS_PERSISTENTE=false`.

A interface vive em `public/index.html`, `public/app.js` e `public/style.css`. O painel lista ferramentas, mostra seus formulários e envia execuções. A autenticação de API usa o token informado numa caixa de senha; a implementação da branch guarda o token em `sessionStorage` e envia `Authorization: Bearer ...`. O token não é salvo no repositório. A interface conecta ao SSE `/api/eventos`, que neste código emite mudanças do catálogo e heartbeats, não eventos do diário.

## 4. Verificações e estado de validação

`package.json` define `npm test` para `core/agentes.teste.mjs` e `npm run check` para `node --check server.js`. Nesta revisão, a leitura do código confirma as rotas e estruturas descritas, mas não houve execução do serviço, dos testes, do build do Render ou verificação da implantação. Portanto, descreve-se o estado como presente na branch, não como validado em produção.

## 5. Persistência e configuração do Render

O `render.yaml` configura Node 22, `FABRICA_MODE=cloud`, `DADOS_DIR=dados`, `DADOS_PERSISTENTE=false`, `SYNAPSE_TOKEN` e `MONGODB_URI` como valores a configurar. A variável `DADOS_PERSISTENTE` é apenas usada para exibir aviso; ela não cria um disco. MongoDB conectado é a opção existente para persistir estado e diário. O Render pode reiniciar o serviço durante deploy/manutenção; esta edição não executa deploy nem controla a operação do provedor.
