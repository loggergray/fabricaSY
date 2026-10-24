# Render: como subir e manter o Synapse

O Synapse pode rodar localmente ou em modo nuvem. O `render.yaml` configura a implantação do serviço Web no Render e ativa `FABRICA_MODE=cloud`.

## 1. Configuração do serviço

No Render, escolha **New → Web Service**, o repositório e a branch. O Blueprint `render.yaml` define:

| Campo | Valor |
|---|---|
| Runtime | Node |
| Build Command | `npm install --omit=dev` |
| Start Command | `node server.js` |
| Health Check Path | `/saude` |
| Node | `22` |
| Modo | `FABRICA_MODE=cloud` |

O processo usa `PORT` fornecida pelo Render e, em nuvem, escuta em `0.0.0.0` por padrão.

## 2. Variáveis

| Variável | Uso |
|---|---|
| `SYNAPSE_TOKEN` | Obrigatória em modo cloud. Configure como segredo no Environment do Render. Não a coloque em arquivos do repositório. |
| `MONGODB_URI` | Opcional. Quando configurada e acessível, estado e diário são persistidos no MongoDB. |
| `MONGODB_DB` | Banco MongoDB; padrão `synapse`. |
| `DADOS_DIR` | Diretório local de arquivos de estado/diário; padrão `dados/`. |
| `DADOS_PERSISTENTE` | Indicador usado pelo servidor para avisar se o diretório foi declarado persistente. Não provisiona disco por si só. O `render.yaml` atual define `false`. |
| `AGUARDAR_MAX_S` | Limite de espera da ação `aguardar`; no projeto Render a referência é 55 segundos. |
| `HOSTS_PERMITIDOS` | Hosts aceitos; vazio permite qualquer host em modo cloud. |
| `ORIGENS_PERMITIDAS` | Origens CORS aceitas. Configure explicitamente quando precisar restringi-las. |
| `PORT` / `HOST` | Porta e host; `PORT` é normalmente fornecida pelo Render, `HOST` pode sobrescrever o padrão. |

Sem MongoDB, o estado e o diário usam arquivos locais em `DADOS_DIR`. O plano atual não declara um disco persistente do Render; portanto não trate esses arquivos como duráveis entre reinícios ou deploys. `DADOS_PERSISTENTE=true` apenas altera o aviso do aplicativo: não cria nem confirma um disco. Para persistência real, configure MongoDB ou um disco persistente de acordo com a configuração do serviço.

## 3. Verificação após deploy

A rota pública `GET /saude` responde com status, modo, quantidade de ferramentas e indicação de autenticação configurada. Ela não substitui a verificação das rotas autenticadas.

Os logs de boot informam modo, host, porta, caminho MCP, ferramentas carregadas, diretório de dados, mecanismo de persistência selecionado e apenas se o token está configurado (nunca seu valor).

Para verificar o painel, abra a página do serviço e informe no botão **Configurar token** o valor de `SYNAPSE_TOKEN`. O painel valida o valor contra `GET /api/ferramentas`; um token recusado não deve ser armazenado. As rotas `/api/*` exigem `Authorization: Bearer <token>`.

## 4. Persistência e disponibilidade

- Com MongoDB conectado, estado e registros do diário são gravados no MongoDB.
- Sem MongoDB, o servidor grava localmente; o disco padrão do serviço pode ser temporário.
- O serviço pode dormir conforme o plano do Render. A primeira requisição após inatividade pode demorar.
- `/saude` é a rota configurada para health check e não exige token.

## 5. Segredos

Mantenha `SYNAPSE_TOKEN` e `MONGODB_URI` somente no gerenciador de variáveis/segredos do provedor. O painel envia o token no cabeçalho HTTPS e o mantém em `sessionStorage` da aba, não no código-fonte nem na URL. Se um segredo já tiver sido commitado, rotacione-o no provedor; remover o valor num commit posterior não apaga o histórico do Git.