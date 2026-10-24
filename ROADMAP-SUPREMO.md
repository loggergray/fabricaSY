# ROADMAP SUPREMO: Fábrica como cérebro do MCP (v2)

Documento vivo. Nada começa antes do usuário pedir para iniciar.

## 0. Leia primeiro, nesta ordem

1. HISTORICO-E-DECISOES.md: como chegamos aqui e tudo que foi decidido.
2. Este roadmap.
3. FORGE.md: como todo trabalho passa pelo Forge.
4. CATALOGO-FERRAMENTAS.md: cada ferramenta detalhada.
5. PROMPT-AGENTES.md: as regras de qualquer agente.
6. Depois, na Fábrica: ação entrar e ação retomar.

## 1. Como este documento funciona

Legenda:

- ✓ entregue e aplicado (o golpe que entregou já marcou)
- X falhou, bloqueado ou cancelado (escrever o motivo na linha)
- ? existe ou foi proposto, ainda não confirmado rodando
- ~ incompleto (começado, falta parte)
- (sem marca) não iniciado

Regras:

- Cada linha tem um ID único (ex.: F1.1). Para mudar a marca, o golpe troca a linha pelo ID. Exemplo: ACHE "- ? F1.1" e POR "- ✓ F1.1".
- IDs são imutáveis. Nunca renumerar. A versão 1 deste roadmap nunca foi usada; a partir da v2 vale esta regra.
- Para expandir: item novo recebe o próximo número da fase, inserido com ACIMA do título da fase seguinte. Fase nova recebe o próximo F, no fim da seção 6. Ideia ainda sem fase vai no backlog (B).
- Item substituído ou cancelado vira X com a frase "substituído por ID" ou o motivo. Nunca apagar.
- O agente nunca afirma que algo funciona. Funciona quando o usuário cola o resultado.

## 2. Visão em uma tela

- A Fábrica vira um servidor MCP. O agente é a camada superior: pensa, decide e conversa com o usuário.
- Todo trabalho bruto é feito por ferramentas, criadas pelos próprios agentes dentro do Forge.
- Nada gigante chega ao agente. Chega mastigado: mapas, índices, trechos e relatórios curtos.
- Tudo que o agente pensa e faz é gravado ao vivo no diário. Qualquer agente retoma do ponto exato.
- Vários agentes trabalham ao mesmo tempo, em dispositivos diferentes, e também se sucedem.
- O usuário está no celular e não sai do chat: preview ao vivo e interfaces por link.

## 3. Leis

- L1. O agente só age por ferramentas do MCP. Nenhuma outra, nunca.
- L2. Se código resolve, o agente não faz na cabeça: manda criar ou usa uma ferramenta.
- L3. O agente é caro. Todo processamento determinístico vira código.
- L4. Antes de agir, grava a intenção. Depois, grava o resultado. Raciocínio e decisões também são gravados.
- L5. Nada gigante chega ao agente. Saída longa vira arquivo mais resumo.
- L6. Tudo passa pelo Forge. Erro e falha de lógica não são aceitos: quarentena.
- L7. Simular antes. Confirmar antes de escrever de verdade ou de qualquer ação destrutiva.
- L8. Snap antes de toda escrita real. Rollback sempre possível.
- L9. Segredos ficam no cofre e nunca aparecem em documento, diário, resposta ou log.
- L10. GitHub é só conector de deploy, com aprovação. Nunca para ler repositórios.
- L11. Sem tmp e sem mktemp. Tudo dentro da pasta do projeto.
- L12. Servidor em um único arquivo com seções, interface em um único HTML, contrato em um único .md.
- L13. Mobile-first. O usuário confirma pelo chat ou por link.
- L14. Ninguém esquece: o que importa vive em arquivo (histórico, roadmap, diário), nunca só na memória de um chat.
- L15. Tudo é expansível. IDs imutáveis.
- L16. Toda ferramenta tem README, testes embutidos, contrato e feed de uso.
- L17. O agente não presume: não afirma validado sem resultado colado.
- L18. Pergunta ao usuário só o que bloqueia. O resto, decide e registra.

## 4. Modos de operação dos agentes

### 4.1 Três modos que convivem

- Solo: um agente, uma sessão.
- Sucessão: o agente atual acabou ou parou. O usuário entra em outro conector, o novo agente chama entrar e retomar, recebe o bastão e continua do ponto exato.
- Simultâneo: dois ou três agentes ligados ao mesmo tempo, em dispositivos diferentes, trabalhando juntos. O usuário fala com um e os outros recebem pela sala e pela fila.

Os modos se misturam: com três simultâneos, um deles pode ser substituído por sucessão no meio do trabalho.

### 4.2 Ciclo de vida da sessão

1. entrar: o agente se registra com nome, dispositivo e papel.
2. retomar: recebe ponto de parada, tarefas abertas, travas e decisões recentes.
3. pegar tarefa e trava.
4. agir, sempre com intenção antes e resultado depois.
5. batimento: sinal periódico de que está vivo.
6. soltar trava e concluir tarefa.
7. sair: gera o bastão.

Se o batimento para, o agente fica ausente, as travas expiram, as tarefas voltam à fila e as intenções abertas ficam marcadas como abandonadas para o próximo verificar em simulação.

### 4.3 O que o agente recebe ao entrar

- ponto de parada exato e intenções abertas
- agentes online e o que cada um faz
- tarefas abertas e travas ativas
- últimas decisões e erros
- ID do roadmap em andamento
- perfil do usuário e dispositivo atual

### 4.4 Limites honestos

- O servidor não acorda um chat parado. Um agente só age quando está em turno.
- Para ficar disponível, o agente usa a ação aguardar: espera até um tempo por tarefa e devolve. Se o cliente do chat limitar a duração do turno, o usuário manda um "continua" e o agente volta a aguardar.

## 5. Arquitetura

### 5.1 Arquivos

~~~
fabrica/
  server.js              um arquivo, seções S01 a S16
  public/index.html      um arquivo (CSS e JS dentro), seções P01 a P10
  CONTRATO.md            contrato de tudo, mantido pela Fábrica
  HISTORICO-E-DECISOES.md
  ROADMAP-SUPREMO.md
  FORGE.md
  CATALOGO-FERRAMENTAS.md
  PROMPT-AGENTES.md
  PADRAO.md
  tools/                 uma pasta por ferramenta (_quarentena dentro)
  dados/                 diario, snaps, cofre, rag, salas, tarefas, interfaces, entrada, projetos
~~~

### 5.2 Seções do server.js

- S01 config e variáveis de ambiente
- S02 http, rotas, hosts e token
- S03 loader ao vivo
- S04 runner isolado e ctx
- S05 Forge (portões, simulador, relatório, quarentena)
- S06 snaps e rollback
- S07 diário
- S08 stream SSE
- S09 endpoint MCP (mestra)
- S10 sessões, salas, tarefas e travas
- S11 cofre
- S12 ponte local
- S13 RAG, feeds e dataset
- S14 interfaces por link
- S15 deploy e contrato
- S16 auditoria, limites e segurança

### 5.3 Dois modos de execução

- Local: a Fábrica roda no Termux (localhost). Enxerga o celular direto.
- Nuvem: a Fábrica roda no Render. Para enxergar o celular usa a ponte local.
- A mesma base de código serve aos dois, escolhidos por variável.

### 5.4 Seções do index.html

- P01 ferramentas
- P02 diário ao vivo
- P03 preview do agente
- P04 interfaces por link
- P05 snaps e golpes
- P06 salas e tarefas
- P07 RAG e feeds
- P08 projetos e entrada
- P09 deploy
- P10 configurações

## 6. Fases

### F0. Base herdada

- ? F0.1 server.js com loader ao vivo, SSE e rota de execução
- ? F0.2 runner isolado por fork com ctx (ler, escrever, backup, resolver, log, simular)
- ✓ F0.3 auditor de acessibilidade rodou e gerou relatório (97/100)
- ? F0.4 criar-ferramenta e _modelo
- ? F0.5 modularizador-html com verificação de invariante
- ? F0.6 painel mobile atual (lista, formulário, execução em stream)
- ? F0.7 PADRAO.md com o padrão de ferramentas
- F0.8 renomear a pasta testandoideiaferramenta3 para auditor-acessibilidade
- F0.9 trocar o README placeholder do auditor por um real
- F0.10 corrigir QUEMSOUFABRICAPORMPADO.md: rotas reais são /api/ferramentas e /api/executar/:id, e o backup só acontece quando a ferramenta chama ctx.backup
- F0.11 relatório de acessibilidade avisou "sem h1": avaliar o painel

### F1. Fundação: servidor único e modo nuvem

- F1.1 juntar core/loader.js e core/runner.js dentro do server.js (S03 e S04); o runner passa a ser o próprio server.js reexecutado com argumento
- F1.2 juntar public/app.js e public/style.css dentro de public/index.html
- ? F1.3 porta e host por variável (0.0.0.0 na nuvem, 127.0.0.1 no local)
- ? F1.4 hosts e origens permitidos configuráveis (hoje só localhost)
- ? F1.5 token obrigatório no modo nuvem, vindo do cofre ou vari��vel
- F1.6 modo local e modo nuvem pela mesma base, escolhidos por variável
- ? F1.7 pasta dados/ configurável (DADOS_DIR)
- ? F1.8 aviso no boot se o disco não for declarado persistente (implementado na branch; falta confirmação em runtime)
- ? F1.9 rota /saude
- ? F1.10 render.yaml e lista de variáveis
- ? F1.11 logs de boot claros (modo, porta, disco, token presente; código ajustado, falta confirmação em runtime)
- F1.12 manter acorn e parse5 como únicas dependências até decisão em contrário
- ? F1.13 proteger todas as rotas `/api/*` com Bearer no modo cloud
- ? F1.14 painel solicitar e validar token sem incluí-lo no código ou na URL; mantido na sessão da aba
- ? F1.15 painel enviar Bearer nas chamadas autenticadas e consumir SSE de mudanças do catálogo
- ? F1.16 `render.yaml` definir explicitamente `FABRICA_MODE=cloud`

### F2. Diário ao vivo e retomada

- ~ F2.1 arquivo jsonl por sessão em dados/diario, append-only, gravado antes de agir
- ~ F2.2 campos: id, seq, hora, agente, sessão, dispositivo, tipo, texto, referência, estado
- ? F2.3 tipos: intencao, raciocinio, acao, resultado, decisao, pergunta, confirmacao_usuario, erro, nota, passagem
- ? F2.4 par intenção e resultado: intenção aberta sem resultado é o ponto de parada
- ? F2.5 seq global entre sessões e agentes
- F2.6 o servidor grava sozinho toda ação de ferramenta; o agente grava raciocínio e decisões
- ? F2.7 ação retomar: ponto de parada, intenções abertas, últimas N entradas resumidas, ID do roadmap
- F2.8 busca no diário por texto, tipo, agente e intervalo
- F2.9 compactador: entradas antigas viram resumo, decisões e erros ficam inteiros
- F2.10 filtro de segredos antes de gravar
- ? F2.11 quadro compartilhado: todos os agentes leem em tempo real
- F2.12 exportar o diário em markdown
- ? F2.13 relatório de sessão (bastão): gerado ao sair e também quando o agente some

### F3. Núcleo MCP e sessões

- ? F3.1 endpoint MCP compatível com conector remoto
- ? F3.2 ferramenta mestra única com várias ações
- ? F3.3 ações: ajuda, entrar, retomar, listar, executar, simular, criar, gravar, buscar, aguardar, bastao, sair
- ? F3.4 entrar registra agente (nome, dispositivo, papel) e devolve protocolo e estado
- F3.5 token por agente (um por conector)
- ? F3.6 batimento e detecção de agente ausente
- ? F3.7 ação ajuda serve o PROMPT-AGENTES.md
- ~ F3.8 toda resposta tem limite de bytes; excedente vira arquivo mais resumo
- F3.9 teste de ponta a ponta: pedir uma ferramenta pelo chat e vê-la na lista
- F3.10 conectar ao chat do usuário (passo dele)

### F4. Preview ao vivo

- F4.1 stream SSE do diário, com reconexão pelo seq
- F4.2 tela P03: linha do tempo ao vivo, mobile, cores por tipo
- F4.3 filtros: tudo, ações, decisões, erros, por agente
- F4.4 link do preview devolvido pela ação entrar
- F4.5 modo foco: só o que está rodando agora
- F4.6 pausar e retomar o auto-rolar
- F4.7 indicador de cada agente online e do que faz
- F4.8 preview embutido no chat (MCP App): pesquisar suporte, com link como alternativa

### F5. Forge completo

- F5.1 pipeline único com os portões G0 a G9 (ver FORGE.md)
- F5.2 quarentena em tools/_quarentena com motivo
- F5.3 manifest estendido: permissões, dependências, testes, saída, tipo, contrato
- F5.4 runner de testes embutidos em simulação
- F5.5 verificação de sintaxe com acorn antes de registrar
- F5.6 limite de saída ao agente e conversão em arquivo mais resumo
- F5.7 relatório padrão com seções fixas
- F5.8 limite de tentativas e escalada ao usuário
- F5.9 simulador total: rede bloqueada, instalações e processos apenas listados
- F5.10 versões das ferramentas com histórico
- F5.11 criar-ferramenta evoluída (T01) passando pelo pipeline
- F5.12 ferramentas antigas sem testes ficam marcadas como "sem testes", sem quarentena

### F6. Snaps, rollback e aplicador de golpes

- F6.1 snap automático antes de escrita real, em dados/snaps dentro do projeto
- F6.2 snap por projeto registrado e por ferramenta
- F6.3 desfazer um ou vários snaps, com relatório do que voltou
- F6.4 diff por execução
- F6.5 aplicador-de-golpes: valida âncoras únicas, simula, mostra o diff, aplica
- F6.6 todas as operações: TROCA, TODAS n, ACIMA, ABAIXO, FAIXA, NOVO
- F6.7 o pacote aplicado já atualiza o roadmap e o histórico (golpes inclusos) e grava no diário
- F6.8 pacote parcial: aplica o que está completo e marca ~ no roadmap
- F6.9 tela P05 para colar e aplicar pelo celular
- F6.10 retenção de snaps com limite de espaço, mantendo marcos

### F7. Percepção de projeto grande

- F7.1 mapa-do-projeto
- F7.2 indice-de-arquivos
- F7.3 grafo-de-dependencias
- F7.4 buscador-sintoma
- F7.5 fatiador
- F7.6 detector-de-mudancas
- F7.7 fichas por arquivo e por pasta, atualizadas só no que mudou
- F7.8 protocolo para projeto de 20 mil linhas ou mais: mapa, índice, grafo, perguntas, trechos
- F7.9 prova com um projeto real grande escolhido pelo usuário
- F7.10 tradutor-explicador

### F8. Entrada de coisas e mídia

- F8.1 importador-de-arquivos (upload por interface por link, zip incluso)
- F8.2 registrar-projeto
- F8.3 caixa-de-entrada: o agente ou o usuário envia texto ou arquivo para a Fábrica
- F8.4 limites de tamanho e de tipos
- F8.5 pasta dados/entrada/imagens
- F8.6 leitor-de-imagem
- F8.7 processador-de-imagem
- F8.8 jogar imagem em um projeto com snap

### F9. Ponte local e filesystem exposto

- F9.1 ponte-local: arquivo único, Node puro, roda no Termux, conecta de saída à Fábrica
- F9.2 pareamento por código curto e token
- F9.3 lista de pastas permitidas (leitura por padrão, escrita só com liberação explícita)
- F9.4 protocolo de pedido e resposta, com arquivos grandes em pedaços
- F9.5 reconexão automática e batimento
- F9.6 filesystem-exposto
- F9.7 padroes-do-usuario sobre a pasta exposta (ex.: MEUCODIGOMINHAVIDA)
- F9.8 executar ferramentas "no ambiente do usuário" pela ponte
- F9.9 modo tudo-local, sem ponte, quando a Fábrica já roda no Termux
- F9.10 log de tudo que a ponte leu e escreveu

### F10. Cofre, dependências e ambiente

- F10.1 cofre-de-variaveis
- F10.2 detector-de-ambiente
- F10.3 instalador-de-dependencias, com confirmação e versão fixada
- F10.4 regra: sem módulos nativos que não compilam no Termux; sql.js para banco
- F10.5 variáveis declaradas por ferramenta no manifest
- F10.6 rotação de segredos
- F10.7 aviso antes de instalar pacote novo
- F10.8 servidor-satelite

### F11. Interfaces por link e renderizador

- F11.1 gerador-de-interface (formulário, confirmação, tabela, upload, checklist)
- F11.2 HTML único por interface, mobile-first
- F11.3 link devolvido no chat; a resposta volta ao diário
- F11.4 modos: usuário preenche, agente preenche, os dois
- F11.5 confirmações pendentes aguardando resposta
- F11.6 renderizador de resultados
- F11.7 interfaces versionadas e com expiração
- ? F11.8 projetos criados pela Fábrica servidos por link

### F12. Memória: feeds, RAG e dataset

- F12.1 feed-de-uso (nota, lacunas e tempo)
- F12.2 RAG com índice próprio, sem modelo
- F12.3 ensinar: gravar conhecimento novo com a fonte
- F12.4 buscar no RAG antes de criar qualquer coisa
- F12.5 lacunas viram tarefas de pesquisa e treino
- F12.6 dataset de pares pedido e resultado
- F12.7 exportar o dataset para fine-tune
- F12.8 o usuário marca pares bons e ruins
- F12.9 treino do que a Fábrica não sabe (py, ts, tsx, db, sql e outros), gravado no RAG

### F13. Multiagente simultâneo

- ? F13.1 sala-de-agentes
- ? F13.2 quadro-de-tarefas: fila, dono e estado
- ? F13.3 travas por arquivo, projeto e tarefa, com validade e renovação
- ? F13.4 ação aguardar para agentes ociosos
- ~ F13.5 papéis: executor, revisor, orquestrador
- ~ F13.6 orquestrador distribui setores e funções
- ? F13.7 decisão conjunta: proposta, aceite de pelo menos dois, registro, desempate do usuário
- ? F13.8 agente ausente: travas expiram, tarefa volta à fila, diário marca abandonada
- ? F13.9 sucessão: novo agente assume o papel com o bastão
- F13.10 versão otimista em arquivos compartilhados
- ? F13.11 o usuário fala com um e os outros recebem pela sala
- F13.12 teste com dois agentes e depois com três

### F14. Contexto do usuário e dispositivos

- F14.1 perfil-do-usuario: só o que o usuário disser
- F14.2 cada agente declara o dispositivo ao entrar
- F14.3 adaptação por dispositivo (celular: respostas curtas)
- F14.4 preferências aplicadas pelas ferramentas (formato, tema)
- F14.5 regras fixas do usuário carregadas em todo agente
- F14.6 o usuário pode ver e apagar o perfil

### F15. Deploy e contrato

- F15.1 deploy-pacote
- F15.2 conector GitHub só de envio, com aprovação
- F15.3 gerador-de-contrato (CONTRATO.md automático)
- ? F15.4 render.yaml e variáveis documentadas
- F15.5 checagem pré-deploy: testes, segredos e tamanho
- F15.6 histórico de deploys
- F15.7 rollback de deploy (passo do usuário)

### F16. Endurecimento

- F16.1 permissões por ferramenta aplicadas pelo runner
- F16.2 limites de tempo, memória e saída por execução
- F16.3 confirmação obrigatória para ação destrutiva
- F16.4 auditoria por token: tudo que cada agente fez
- F16.5 limite de requisições por token
- F16.6 filtro de segredos em todas as saídas
- F16.7 revisão das leis L1 a L18
- F16.8 teste de todas as ferramentas do catálogo
- F16.9 plano de recuperação: restaurar dados/ a partir de snap

### F17. Exemplos de ensino e prova ponta a ponta

- F17.1 E01 exemplo-eco
- F17.2 E02 exemplo-contador-de-palavras
- F17.3 E03 exemplo-json-para-csv
- F17.4 E04 exemplo-servo
- F17.5 E05 exemplo-interface
- F17.6 E06 exemplo-falha (prova da quarentena)
- F17.7 roteiro ponta a ponta com um agente
- F17.8 roteiro com dois agentes
- F17.9 roteiro com três agentes
- F17.10 roteiro de sucessão: um agente cai no meio e outro continua

### F18. Ganchos externos

- F18.1 gancho-externo: ponto de entrada para módulos que o usuário não mostra (ex.: qgmaster), sem conhecer o interior
- F18.2 contrato mínimo para módulo externo: entrada, saída e permissões
- F18.3 decisão do usuário sobre se entra

## 7. Backlog (ideias sem fase)

- B01 fala natural vira ferramenta, montada junto com o usuário
- B02 agentes especializados por setor
- B03 painel do consumo que as ferramentas economizam
- B04 modo offline total
- B05 pacote de ferramentas por assunto, exportável

## 8. Decisões abertas

- ? Q01 onde roda: nuvem com ponte ou tudo no Termux (recomendação: nuvem com ponte, e modo local como reserva)
- ? Q02 persistência no Render: disco persistente ou outra solução
- ? Q03 nome do conector no chat
- ? Q04 pastas que o filesystem-exposto pode abrir
- ? Q05 imagens: só bibliotecas locais ou serviço externo com chave no cofre
- ? Q06 "HR" é RAG?
- ? Q07 preview embutido no chat ou só por link
- ? Q08 limites iniciais: 3 tentativas e 8 KB por saída
- ? Q09 o qgmaster entra?
- ? Q10 como agentes ociosos "acordam": aguardar mais "continua" manual
- ? Q11 runtimes de py e ts disponíveis no ambiente
- ? Q12 ordem das fases (a ordem acima respeita as dependências)

## 9. Versões deste roadmap

- v1 (2026-10-21): primeira entrega, nunca usada.
- v2 (2026-10-21): continuidade corrigida (sucessão mais simultâneo), histórico completo, catálogo, Forge, pontas soltas, granularidade, regra de expansão.
- v2.1 (2026-10-22): marcas ? e ~ aplicadas ao que o código já entrega (Synapse, multiagente, publicador). Nada confirmado rodando até o usuário colar o resultado.

Aguardando o usuário pedir para iniciar.