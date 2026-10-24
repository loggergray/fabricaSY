# Synapse da Fábrica

O Synapse é o servidor MCP da Fábrica. O repositório oferece modo local e modo nuvem; o `render.yaml` define `FABRICA_MODE=cloud` para o serviço no Render. O servidor expõe uma ferramenta MCP chamada `synapse`, com várias ações.

## Endpoint MCP e autenticação

O caminho padrão é `/mcp` (`MCP_PATH` pode alterá-lo). Em modo cloud, configure `SYNAPSE_TOKEN` como segredo. O servidor aceita `Authorization: Bearer <token>` e o prefixo de caminho `/t/<token>`; o prefixo `/a/<nome-do-agente>` identifica o agente. O token no caminho pode aparecer em logs e histórico de URL: prefira Bearer quando o cliente permitir. O painel usa Bearer e nunca embute o segredo nos arquivos.

Exemplo de endpoint, sem incluir segredo:

```
POST https://<serviço>.onrender.com/a/mcp1/mcp
Authorization: Bearer <SYNAPSE_TOKEN>
```

## Ações principais

| Ação | Para quê |
|---|---|
| `ajuda`, `ler` | Protocolo e leitura de documentos suportados. |
| `entrar`, `retomar`, `batimento`, `agentes` | Sessão, retomada e presença dos agentes. |
| `sala`, `tarefa`, `trava`, `decidir`, `aguardar` | Coordenação compartilhada. |
| `gravar`, `buscar`, `bastao`, `sair` | Diário, busca e passagem de contexto. |
| `listar`, `simular`, `executar`, `criar` | Catálogo e execução/criação de ferramentas, conforme regras do Forge. |
| `projeto` | `op=mapa` cria o snapshot do código; `op=ler` lê trecho por caminho/linha; `op=buscar` localiza texto em arquivos permitidos. Segredos, binários, dependências e `dados/` são excluídos. |

Antes de propor mudanças, os agentes devem consultar `projeto op=mapa` e depois ler os arquivos relevantes com `projeto op=ler`. O snapshot registra caminhos, tamanhos, linhas e hashes SHA-256 em `DADOS_DIR/snapshots/projeto-atual.json`; ele não é backup do conteúdo e deve ser atualizado para refletir mudanças.

## Três agentes

Cadastre um conector por chat, variando o prefixo `/a/mcp1/`, `/a/mcp2/` ou `/a/mcp3/`. O nome é passado ao servidor para identificar a sessão. A sala, tarefas, travas e decisões são implementadas no núcleo de agentes.

## Painel web

O painel continua dentro do `public/index.html` e tem rotas internas **Ferramentas**, **Atividade** e **Projeto**. `Atividade` consulta estado real, tarefas, travas e diário. `Projeto` exibe o índice do snapshot e permite abrir trechos de arquivos pelo servidor.

Rotas autenticadas: `GET /api/estado`, `GET /api/diario`, `GET /api/projeto/snapshot`, `GET /api/projeto/arquivo`, `GET /api/ferramentas`, `GET /api/padrao`, `GET /api/eventos` e `POST /api/executar/:id`. O SSE em `/api/eventos` envia eventos `diario` e `estado` ao registrar atividade, além de `mudou` para alterações no catálogo.

## Criar scripts e servidores

A ferramenta `criar-artefato-projeto` gera, depois de simulação e confirmação, um arquivo `.mjs` e README em `artefatos/scripts/<id>/` ou `artefatos/servidores/<id>/`. Ela não executa código, não inicia processos e não abre portas. Para ferramentas MCP com hot-reload, use `criar-ferramenta`. Servidores públicos continuam sujeitos à configuração da hospedagem e não são iniciados automaticamente.

## Persistência e limites

Com `MONGODB_URI` conectado, o núcleo persiste estado e entradas do diário no MongoDB. Sem MongoDB, usa arquivos locais em `DADOS_DIR` (por padrão `dados/`), que podem não sobreviver a reinícios/deploys no armazenamento temporário do provedor. `render.yaml` marca `DADOS_PERSISTENTE=false`; o snapshot é regenerável e não substitui persistência.

O commit nesta branch não prova que o serviço implantado carregou o código. O runtime precisa ser validado após a forma de atualização prevista pelo projeto; não afirmar sucesso operacional sem testar as rotas e o MCP ativos.
