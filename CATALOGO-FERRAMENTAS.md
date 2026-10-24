# CATÁLOGO DE FERRAMENTAS

Todas nascem pelos agentes e passam pelo Forge (FORGE.md). Cada uma tem manifest, index.js, README, testes embutidos, contrato e feed de uso. As marcas seguem o roadmap.

Regras comuns a todas:

- Gravam só por ctx.escrever e respeitam simular.
- Saída ao agente dentro do limite. O excedente vira arquivo e resumo.
- Nunca imprimem segredo e nunca usam tmp.
- Falham com mensagem de três partes: o que, onde e como corrigir.

## A. Base (existentes)

### T01 criar-ferramenta ?

- Para quê: criar ferramenta nova a partir do molde ou do código que o agente escreveu.
- Entradas: id, nome, ícone, descrição, manifest, código, README, testes.
- Saída: relatório do Forge (registrada ou em quarentena).
- Teste mínimo: id inválido falha, id repetido falha, manifest ruim vai para quarentena.
- Fase: F5.11

### T02 modularizador-html ?

- Para quê: quebrar um HTML em seções, componentes e átomos, com CSS e JS no dono certo.
- Entradas: origem ou HTML colado, destino, saída (js ou html), profundidade, unificar repetidos.
- Saída: resumo com contagens e RELATORIO.md no destino.
- Teste mínimo: HTML pequeno remonta idêntico; pasta de saída não vazia sem marca falha.
- Fase: F0.5

### T03 auditor-acessibilidade ✓

- Para quê: auditar HTML para celular e sugerir correções.
- Entradas: arquivo ou HTML colado, tamanho mínimo de toque, onde salvar.
- Saída: nota, erros, avisos e como corrigir.
- Teste mínimo: HTML sem lang e sem viewport gera erros.
- Fase: F0.3

## B. Percepção de projeto

### T04 mapa-do-projeto

- Para quê: dar ao agente a forma do projeto sem ler conteúdo.
- Entradas: projeto, profundidade, padrões a ignorar.
- Saída: árvore até N níveis, contagem por pasta e linguagem, maiores arquivos, pontos de entrada prováveis, total de linhas.
- Teste mínimo: projeto com 3 arquivos conhecidos devolve contagens exatas.
- Fase: F7.1

### T05 indice-de-arquivos

- Para quê: ficha de cada arquivo sem ler tudo.
- Entradas: projeto, filtro.
- Saída: por arquivo, linhas, imports, exports, funções com linha, TODOs e comentário de topo. Fichas gravadas em dados/projetos/<id>/fichas.
- Observação: js, json, css e html por parser; ts, tsx, py e sql por padrões de linha, menos exatos, até haver parser próprio.
- Teste mínimo: arquivo js com duas funções lista duas funções.
- Fase: F7.2

### T06 grafo-de-dependencias

- Para quê: mostrar quem usa quem.
- Entradas: projeto.
- Saída: arquivos mais conectados, ciclos, arquivos órfãos, e o grafo completo em arquivo.
- Teste mínimo: ciclo A para B para A é detectado.
- Fase: F7.3

### T07 buscador-sintoma

- Para quê: achar onde está o problema a partir de um termo ou sintoma.
- Entradas: projeto, texto livre, quantidade.
- Saída: arquivos e linhas prováveis em ordem de relevância, com trecho de 3 linhas.
- Teste mínimo: termo que existe em um arquivo só devolve esse arquivo em primeiro.
- Fase: F7.4

### T08 fatiador

- Para quê: devolver só o trecho que importa.
- Entradas: arquivo, função ou faixa de linhas, contexto.
- Saída: trecho com numeração de linha e limite de linhas.
- Teste mínimo: pedir uma função devolve só ela mais o contexto.
- Fase: F7.5

### T09 detector-de-mudancas

- Para quê: saber o que mudou desde a última ficha ou snap.
- Entradas: projeto.
- Saída: arquivos novos, removidos e alterados, só nomes e contagens.
- Teste mínimo: alterar um arquivo aparece como alterado.
- Fase: F7.6

### T15 tradutor-explicador

- Para quê: transformar saída técnica (erro, relatório, diff) em explicação simples para o usuário.
- Entradas: texto técnico, tipo.
- Saída: explicação curta, passos e o que fazer.
- Observação: por regras e glossário, sem modelo. O agente refina.
- Teste mínimo: erro de sintaxe conhecido gera a explicação esperada.
- Fase: F7.10

## C. Entrada de coisas e mídia

### T10 importador-de-arquivos

- Para quê: receber arquivos e zips do usuário por interface por link.
- Entradas: arquivo ou zip.
- Saída: id da entrada e lista curta do que chegou.
- Teste mínimo: zip pequeno extrai igual.
- Fase: F8.1

### T11 registrar-projeto

- Para quê: tornar um conjunto de arquivos um projeto conhecido da Fábrica.
- Entradas: nome, origem (upload, ponte ou pasta local), padrões a ignorar.
- Saída: id do projeto e o mapa resumido.
- Teste mínimo: nome repetido falha.
- Fase: F8.2

### T12 caixa-de-entrada

- Para quê: o agente do chat enviar texto ou arquivo para a Fábrica, e outros agentes e ferramentas lerem.
- Entradas: destino, conteúdo ou arquivo.
- Saída: id e estado (novo, lido).
- Teste mínimo: o item lido muda de estado.
- Fase: F8.3

### T13 leitor-de-imagem

- Para quê: descrever uma imagem sem o agente vê-la.
- Entradas: imagem.
- Saída: dimensões, formato, cores dominantes e texto lido quando houver leitor instalado.
- Observação: sem leitor, devolve a lacuna e registra pedido de nova ferramenta.
- Teste mínimo: imagem de tamanho conhecido devolve as dimensões certas.
- Fase: F8.6

### T14 processador-de-imagem

- Para quê: redimensionar, converter, recortar e colocar uma imagem em um projeto.
- Entradas: imagem, operação, destino.
- Saída: arquivo gerado e relatório. Snap antes de copiar para o projeto.
- Teste mínimo: redimensionar muda só as dimensões.
- Fase: F8.7

## D. Edição segura

### T16 aplicador-de-golpes

- Para quê: aplicar o pacote de mudanças com segurança.
- Entradas: pacote colado.
- Saída: simulação com diff, depois aplicação, e marcação do roadmap e do histórico.
- Regras: âncora única, parar no primeiro erro de âncora, snap antes.
- Teste mínimo: âncora repetida falha com mensagem clara.
- Fase: F6.5

### T17 snap-e-rollback

- Para quê: criar, listar e desfazer snaps.
- Entradas: alvo, ação.
- Saída: lista curta e relatório do que voltou.
- Teste mínimo: desfazer devolve o arquivo ao conteúdo anterior.
- Fase: F6.1

## E. Ambiente e segredos

### T18 detector-de-ambiente

- Para quê: dizer o que existe no ambiente antes de criar ferramenta.
- Entradas: nenhuma.
- Saída: versões (node, python, sql.js), sistema, espaço e permissões.
- Teste mínimo: devolve a versão do node em uso.
- Fase: F10.2

### T19 instalador-de-dependencias

- Para quê: instalar libs quando a ferramenta precisa.
- Entradas: pacote e versão.
- Saída: resultado, e registro no manifest da ferramenta.
- Regras: confirmação antes, versão fixada, falha com mensagem clara, sem módulos nativos problemáticos.
- Teste mínimo: pacote inexistente falha com causa.
- Fase: F10.3

### T20 cofre-de-variaveis

- Para quê: guardar e usar segredos sem mostrar.
- Entradas: nome, valor (só ao gravar).
- Saída: nome e presença, nunca o valor.
- Teste mínimo: ler o valor pela ação de listar nunca devolve o conteúdo.
- Fase: F10.1

### T24 servidor-satelite

- Para quê: subir e derrubar servidores acoplados.
- Entradas: ferramenta ou comando, porta, ação.
- Saída: estado, porta e saúde.
- Regras: confirmação para criar, registro no contrato.
- Teste mínimo: subir, checar saúde e derrubar.
- Fase: F10.8

## F. Ponte e pastas do usuário

### T21 ponte-local

- Para quê: ligar a Fábrica na nuvem ao celular.
- Entradas: código de pareamento, pastas permitidas.
- Saída: estado da conexão.
- Regras: conecta de saída, arquivo único, Node puro, leitura por padrão.
- Teste mínimo: pareamento com código errado falha.
- Fase: F9.1

### T22 filesystem-exposto

- Para quê: abrir uma pasta do celular para ferramentas e agentes.
- Entradas: pasta, modo (leitura ou escrita).
- Saída: árvore curta e estado.
- Teste mínimo: caminho fora da pasta permitida é recusado.
- Fase: F9.6

### T23 padroes-do-usuario

- Para quê: varrer a pasta exposta (ex.: MEUCODIGOMINHAVIDA), achar padrões e anotar no RAG.
- Entradas: pasta exposta.
- Saída: lista curta de padrões com contagem e exemplos de caminho.
- Teste mínimo: pasta com padrão repetido o detecta.
- Fase: F9.7

## G. Interfaces

### T25 gerador-de-interface

- Para quê: criar formulário, confirmação, tabela, upload ou checklist em um HTML único e devolver o link.
- Entradas: tipo, campos, quem preenche (usuário, agente ou ambos).
- Saída: link e id da interface. A resposta volta ao diário.
- Teste mínimo: o formulário enviado grava a resposta.
- Fase: F11.1

### T26 renderizador

- Para quê: mostrar resultado de qualquer ferramenta em HTML.
- Entradas: markdown ou dados, estilo.
- Saída: link.
- Teste mínimo: markdown simples vira HTML válido.
- Fase: F11.6

## H. Memória

### T27 feed-de-uso

- Para quê: registrar nota e lacunas de cada uso de ferramenta.
- Entradas: ferramenta, nota, lacuna.
- Saída: confirmação. As notas aparecem na ação listar.
- Teste mínimo: a nota aparece na listagem.
- Fase: F12.1

### T28 rag

- Para quê: guardar e buscar conhecimento, sem modelo.
- Ações: indexar, buscar, ensinar.
- Saída: poucos resultados com fonte.
- Teste mínimo: conhecimento ensinado é achado pela busca.
- Fase: F12.2

### T29 dataset-recorder

- Para quê: gravar pares pedido e resultado para treino futuro.
- Entradas: automático.
- Saída: contagem e exportação.
- Teste mínimo: um uso gera um par.
- Fase: F12.6

### T30 compactador-de-diario

- Para quê: resumir entradas antigas sem perder decisões e erros.
- Entradas: intervalo.
- Saída: resumo e contagens.
- Teste mínimo: decisões e erros continuam inteiros.
- Fase: F2.9

### T31 relatorio-de-sessao

- Para quê: gerar o bastão ao sair ou quando o agente some.
- Entradas: sessão.
- Saída: o que foi feito, o que falta, próximo passo e intenções abertas.
- Teste mínimo: intenção aberta aparece no bastão.
- Fase: F2.13

## I. Multiagente e contexto

### T32 sala-de-agentes

- Para quê: mensagens, propostas e decisões entre agentes.
- Entradas: mensagem, destino.
- Saída: confirmação e mensagens novas.
- Teste mínimo: mensagem do agente 1 chega ao agente 2.
- Fase: F13.1

### T33 quadro-de-tarefas

- Para quê: fila, dono, estado e travas.
- Entradas: tarefa, ação (criar, pegar, soltar, concluir).
- Saída: tarefa e estado.
- Teste mínimo: duas tentativas de pegar a mesma tarefa: só uma ganha.
- Fase: F13.2

### T34 perfil-do-usuario

- Para quê: guardar o que o usuário disse sobre si, o dispositivo e o ambiente.
- Entradas: campo e valor.
- Saída: perfil resumido.
- Regras: só o que o usuário disser. Ele pode ver e apagar.
- Teste mínimo: apagar remove o campo.
- Fase: F14.1

## J. Deploy e contrato

### T35 deploy-pacote

- Para quê: preparar o pacote de envio para o usuário subir.
- Entradas: projeto, destino.
- Saída: lista do que sobe, checagem de segredos e passos do usuário.
- Teste mínimo: segredo no código bloqueia o pacote.
- Fase: F15.1

### T36 gerador-de-contrato

- Para quê: gerar e manter o CONTRATO.md.
- Entradas: projeto ou Fábrica.
- Saída: contrato atualizado.
- Teste mínimo: ferramenta nova aparece no contrato.
- Fase: F15.3

### T37 gancho-externo

- Para quê: ponto de entrada para módulos externos que o usuário não mostra.
- Entradas: contrato mínimo do módulo.
- Saída: estado do gancho.
- Teste mínimo: módulo sem contrato é recusado.
- Fase: F18.1

## K. Exemplos de ensino

Servem para provar o Forge e ensinar o padrão.

### E01 exemplo-eco

- Recebe um texto e devolve o mesmo texto.
- Teste: entrada "oi" devolve "oi". Fase: F17.1

### E02 exemplo-contador-de-palavras

- Lê um arquivo e conta palavras e linhas, sem gravar nada.
- Teste: arquivo de 3 palavras devolve 3. Fase: F17.2

### E03 exemplo-json-para-csv

- Converte um JSON de lista simples em CSV e grava com ctx.escrever.
- Teste: em simulação não grava; em execução real grava e confere. Fase: F17.3

### E04 exemplo-servo

- Ferramenta que cria outra ferramenta pelo mesmo Forge.
- Teste: a ferramenta filha aparece registrada e a profundidade é respeitada. Fase: F17.4

### E05 exemplo-interface

- Cria um formulário simples por link e recebe a resposta.
- Teste: a resposta enviada chega ao diário. Fase: F17.5

### E06 exemplo-falha

- Falha de propósito num dos portões.
- Teste: vai para a quarentena com o motivo certo. Fase: F17.6