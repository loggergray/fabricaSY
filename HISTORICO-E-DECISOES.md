# HISTÓRICO E DECISÕES

Leia este arquivo primeiro. Ele conta como chegamos até aqui, do começo ao fim da conversa que originou a Fábrica-cérebro. Qualquer agente que entrar depois (sozinho, em sucessão ou junto com outros) fica sabendo tudo sem perguntar de novo. Toda decisão nova entra no final deste arquivo, por golpe.

## Convenções

- [U] fala ou decisão do usuário
- [C] proposta ou análise do Claude
- [A] proposta do Claude que o usuário aceitou
- [?] interpretação do Claude ainda não confirmada

## 1. Quem é o usuário e como ele trabalha

- [U] Usa Android com Termux e Chrome. PC é muito raro. Tudo é mobile-first.
- [U] Quem executa os scripts é ele. O Claude gera, o usuário cola, roda e devolve o resultado. O Claude não afirma que algo funciona antes do resultado colado.
- [U] Ele gosta de execução nos projetos dele (runner, rodar scripts). O que ele não aceita é o Claude usar as ferramentas do Claude para executar. Ele não quer discutir essa regra.
- [U] Odeia tmp e mktemp. Testes e arquivos auxiliares ficam dentro da pasta do projeto.
- [U] Quer entrega completa, numa mensagem só, sem pontas soltas.
- [U] Atualizações chegam em pacote de golpes (formato em PROMPT-AGENTES.md), aplicado por ele.
- [U] Não quer perguntas em excesso: o agente resolve sozinho o que der e pergunta só o que bloqueia.
- [U] Prefere servidor em um único arquivo, interface em um único HTML e um contrato em .md.

## 2. Linha do tempo da conversa

1. [U] Pergunta inicial: qual é o melhor projeto dele, ainda mais para criar um MCP personalizado.
2. [C] Primeira resposta: SIAN/Hubsian, por já ter MCP, capabilities e deploy. [U] Não gostou. Pediu para parar de olhar SIAN, Hubsian e KYODevor (que já possuem) e olhar os projetos antigos, desde o início dele no Claude.
3. [C] Olhou os projetos antigos e apontou o CÉREBRO (pasta MEUCODIGOMINHAVIDA) como melhor. Também disse, errado, que o VICECODE conflitaria com a regra de não executar. [U] Respondeu que o Claude confundiu muito as coisas.
4. [U] Correção: ele ama execução nos projetos, desde que o Claude não use as ferramentas do Claude. Não vai discutir isso.
5. [U] Disse que, ao listar todos os projetos e avaliar se rolam, o Claude podia chamá-lo. [C] Entendeu ao contrário (achou que era para avisar antes). [U] Perguntou "então você não quer listar eles?". [C] Listou com veredito.
6. [C] Veredito: rolariam Sentrow, CÉREBRO, projeto fractal, Oficina de Patches, Montador de contratos e VICECODE. Talvez: LucasMind e o criador pessoal. Não rolam por serem produtos finais: Tatical/FireBeats, ANSHOT, Phantom Wilds, Gênesis/humanoide, KYONFC, Maykon Rodas, Sanctum, GPS, Homenagem, Spex2.
7. [U] "Não gostei de nenhum pra isso." [C] Pediu uma frase do que o MCP deve fazer.
8. [U] Enviou a Fábrica de Ferramentas (código completo) e a visão longa descrita abaixo. A Fábrica foi escolhida.
9. [C] Entregou a versão 1 do roadmap e do prompt.
10. [U] Corrigiu o modelo de continuidade, pediu o roadmap reorganizado e granular, sem nada para trás, e que os próximos agentes saibam todo o caminho. Esta é a versão 2.

## 3. A visão, nas palavras do usuário (condensada)

- [U] Um prompt que obrigue qualquer um que use o conector a jamais usar ferramentas fora do MCP.
- [U] Todo raciocínio e toda ação gravados ao vivo, para saber onde o agente parou, e um preview em streaming na janela do agente.
- [U] A Fábrica cria ferramentas. O Claude pode criar ferramentas de uso nela.
- [U] Ele pode baixar libs e dependências. O usuário confia nas variáveis. A Fábrica trabalha direto no ambiente dele.
- [U] RAG e fine-tune internos da Fábrica.
- [U] Projeto de mais de 20 mil linhas: o agente não lê tudo. Ele cria ferramentas, robôs e scripts que fazem o trabalho pesado, e fica como cérebro na camada superior.
- [U] Os agentes deixam anotações e feeds sobre o uso das ferramentas, qualificando-as. Na próxima sessão já sabem o que existe e o que falta.
- [U] Exemplo: "pega uma imagem e joga nesse projeto" significa criar leitor de imagem, tradutor e explicador. Nada gigante chega ao agente: chega mastigado.
- [U] Tudo que código resolve, o agente não faz: manda criar. Servidores acoplados entre si ou não, à vontade.
- [U] Motivação: gastar o Claude com o que o código poderia fazer é um luxo que ele não pode mais ter.
- [U] A Fábrica sabe json, css, js, html, py, ts, jsx, tsx, db e sql. O que não sabe, ela treina e coloca no RAG (ele escreveu "HR") [?].
- [U] Interfaces: para ele preencher, para o agente preencher ou para os dois, aguardando confirmações, por link. Ele nunca precisa sair do chat. O renderizador também é uma ferramenta.
- [U] O MCP reconhece onde ele está e o que usa, para saber como lidar com ele.
- [U] Ele fala naturalmente, o agente transforma em código e monta com ele.
- [U] Nasce no Render. Ele cola no Termux, sobe para o git e manda para lá (esse passo é dele). Documento .md dentro declara tudo, com contrato de tudo.
- [U] GitHub é só conector de deploy, quando ele aceitar. Ver repositórios no GitHub é proibido.
- [U] Tudo é salvo enquanto o agente pensa, fala e age, incluindo o que o usuário confirma e aceita.
- [U] Multiagente: mcp1 e mcp2 conversam e decidem juntos, mcp3 orquestra. Em dispositivos diferentes, bastando deixar os chats abertos. Ele fala com um e todos trabalham.
- [U] Uma ferramenta para expor uma pasta do celular (ex.: MEUCODIGOMINHAVIDA) para achar e anotar os padrões dele. Quem faz isso são as ferramentas, não os agentes.
- [U] Os agentes são "espertos e malandros": a esperteza é mandar a ferramenta fazer.
- [U] Roadmap supremo com checklists e fases. Todas as ferramentas detalhadas, até as de exemplo. O prompt dos agentes e o funcionamento do Forge (simulador, relatório, faz, age, conclui, sem erro nem falha de lógica). Aguardar ele pedir para iniciar.
- [U] Todo golpe traz a marcação no roadmap (✓ X ? e incompleto). Se alguém parar no meio, o que foi entregue já cai direto no ambiente, com snaps e rollback.

## 4. Decisões

### Do usuário

- D01 [U] A Fábrica de Ferramentas é o projeto escolhido. SIAN, Hubsian e KYODevor ficam fora deste papel. Os projetos antigos listados não agradaram.
- D02 [U] O agente é a camada superior (cérebro). O trabalho pesado é das ferramentas.
- D03 [U] Nenhum agente usa ferramenta fora do MCP, nunca.
- D04 [U] Raciocínio e ação são gravados ao vivo. O ponto de parada fica sempre no diário. Há preview em streaming.
- D05 [U] Se código resolve, o agente manda criar a ferramenta. Nada gigante chega ao agente.
- D06 [U] Motivação central: economizar o consumo do agente.
- D07 [U] Libs e dependências podem ser instaladas. Variáveis podem ser confiadas. A Fábrica trabalha no ambiente dele.
- D08 [U] RAG e fine-tune internos.
- D09 [U] Servidor em um único arquivo com seções. Interface em um único HTML. Contrato em .md.
- D10 [U] Nasce no Render. O envio (Termux, git, Render) é passo dele.
- D11 [U] GitHub só para deploy, com aprovação. Proibido ler repositórios.
- D12 [U] Interfaces por link. Ele não sai do chat. O renderizador é ferramenta.
- D13 [U] O MCP reconhece onde ele está e o que usa.
- D14 [U] Três agentes (mcp1, mcp2, mcp3), com o terceiro orquestrando.
- D15 [U] Continuidade tem dois mecanismos. Sucessão: se um conector acaba, ele entra em outro e continua. Simultâneo: com três ligados, os três trabalham juntos ao mesmo tempo.
- D16 [U] Uma ferramenta expõe uma pasta do celular.
- D17 [U] Roadmap supremo detalhado, com todas as ferramentas, inclusive as de exemplo. Aguardar ele pedir para iniciar.
- D18 [U] Todo golpe marca o roadmap. Há snaps e rollback.
- D19 [U] O Forge não aceita erro nem falha de lógica. Tem simulador e relatório.
- D20 [U] O qgmaster não pode ser mostrado e talvez nem entre no projeto.
- D21 [U] Tudo é expansível. Nada pode ficar para trás.
- D22 [U] Os agentes novos precisam saber o histórico completo (este arquivo).

### Do Claude, aguardando aceite

- C01 [C] Uma ferramenta mestra única no MCP, com várias ações, para gastar pouco contexto.
- C02 [C] Ponte local: programa pequeno no Termux que conecta de saída à Fábrica, porque a Fábrica na nuvem não enxerga o celular.
- C03 [C] Ação aguardar (espera por tarefa) para agentes ociosos receberem trabalho.
- C04 [C] Limites iniciais: 3 tentativas de correção no Forge e 8 KB por saída ao agente.
- C05 [C] Token por agente, com batimento e travas com validade.
- C06 [?] "HR" é RAG.
- C07 [C] Preview embutido no chat, se o cliente permitir. Senão, link.

## 5. Pontas soltas que precisam de decisão

- P1. A Fábrica no Render não enxerga o celular. Para expor pastas e rodar coisas no Termux é preciso a ponte local (C02), ou rodar a Fábrica no próprio Termux.
- P2. No Render, o disco comum é temporário e o serviço pode hibernar. Diário, snaps e RAG precisam de disco persistente ou outra solução.
- P3. O server.js atual só aceita localhost. Na nuvem precisa de host público, porta por variável e token.
- P4. Ferramentas criadas por agentes rodam código no servidor. Num servidor público isso exige token forte, permissões por ferramenta e confirmação para ações destrutivas.
- P5. Um chat só age quando está em turno. O servidor não acorda um chat parado. Por isso existe a ação aguardar, e o limite do cliente do chat pode exigir um "continua" do usuário de vez em quando.
- P6. Conflito de escrita com agentes simultâneos: resolvido com travas e versão otimista.
- P7. Runtimes de py e ts no ambiente dele ainda não foram confirmados.
- P8. O QUEMSOUFABRICAPORMPADO.md descreve rotas que não existem (/api/tools e /api/run) e um backup automático que só acontece quando a ferramenta chama ctx.backup. Precisa de revisão.

## 6. Vocabulário

- Fábrica: o servidor, o painel e as ferramentas.
- Ferramenta: pasta em tools/ com manifest, index.js e README.
- ctx: objeto que a ferramenta recebe (ler, escrever, backup, resolver, log, simular).
- Simular: executar sem gravar nada.
- Quarentena: ferramenta que falhou em algum portão do Forge, fora de uso.
- Diário (quadro): registro ao vivo de tudo que os agentes pensam e fazem.
- Bastão: resumo de passagem entre agentes.
- Golpe: pacote de mudanças em formato fixo.
- Snap: cópia de segurança antes de escrever.
- Mestra: a ferramenta única do MCP, com várias ações.
- Ponte: programa no Termux que liga a Fábrica ao celular.
- Servo: ferramenta que cria ferramentas ou robôs.
- Feed: nota de uso de uma ferramenta.

## 7. Registro de decisões novas

Cada decisão nova entra abaixo, com ID seguinte (D23, D24...), a origem e a data.

<!-- FIM-DO-REGISTRO -->
- D23 [U] 2026-10-21: O conector e servidor MCP personalizado da Fábrica foi batizado oficialmente de Synapse.
- D24 [U] 2026-10-22: Integração da lógica do Sentrow como ferramenta nativa tools/publicador-cloudflare (Node ESM puro) e configuração render.yaml, permitindo servir links públicos via Cloudflare Worker/KV tanto localmente no Termux quanto em deploy na nuvem.
- D25 [U] 2026-10-22: O Sentrow que já funciona (worker.js, painel.html e painel.js originais) é a base do publicador-cloudflare. Chaves e login ficam embutidos no index.js por decisão do usuário, que confia no agente.
- D26 [U] 2026-10-22: O Synapse atende até 3 agentes simultâneos do mesmo usuário (mcp1, mcp2, mcp3) com sala, tarefas, travas, decisões e aguardar. Estado em dados/estado.json e diário por sessão em dados/diario/. As marcas no roadmap ficam em ? até o usuário colar o resultado.
- D27 [U] 2026-10-22: O usuário quer acompanhar o trabalho por preview dentro do chat e também por link, com edição/uso pela mesma experiência e transmissão ao vivo do que o agente registra. Isso é requisito desejado, não afirmação de que já esteja implementado.
- D28 [U] 2026-10-22: O usuário autoriza interação com o projeto pelo chat quando ele ordenar; essa autorização não transforma ações não solicitadas nem deploy em autorizados.
- D29 [U] 2026-10-22: O usuário controla quando o servidor pode reiniciar ou receber deploy. O agente não deve iniciar deploy/restart por conta própria.
- D30 [U] 2026-10-22: O usuário autoriza usar o GitHub conectado para trabalhar no Synapse na branch indicada nesta tarefa; isso não é autorização de deploy.
- D31 [U] 2026-10-22: O usuário gosta de respostas granulares, com detalhes de arquivos, decisões e critérios; não resumir a ponto de omitir contexto importante.
- D32 [U] 2026-10-22: O usuário autorizou resolver a autenticação do painel com token. O valor do segredo não foi fornecido nesta conversa; não deve ser inserido no código/repositório.
