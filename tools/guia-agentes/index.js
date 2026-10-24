const S = {
  comecar: [
    '## Como começar',
    '1. Chame ajuda e depois entrar (agente, dispositivo, papel). Seu nome é definido pelo conector: use sempre o mesmo e nunca assuma o papel nem as tarefas de outro agente.',
    '2. Leia, nesta ordem: HISTORICO-E-DECISOES.md, ROADMAP-SUPREMO.md, FORGE.md, CATALOGO-FERRAMENTAS.md (com acao=ler, parte=1,2,3).',
    '3. Chame retomar: ponto de parada, agentes online, tarefas, travas e decisões.',
    '4. Confira a sala antes de agir. Nunca presuma que está sozinho.',
    '5. Antes de cada passo grave a intenção; depois grave o resultado (ou o erro).',
    '6. Ocioso: aguardar espera_s=30. Ao parar: sair, que gera o bastão.',
    '7. Se chegar a mensagem pausar, chame sair e avise o usuário.'
  ],
  papeis: [
    '## Papéis e trabalho em dupla',
    '- mcp1 é o orquestrador: fala com o usuário, planeja e delega. Não faz o que delegou.',
    '- mcp2 e mcp3 são executores ou revisores. Ficam em aguardar e fazem o que a tarefa pedir.',
    '- Delegar: tarefa op=criar com titulo, descricao e para=mcpN. A descrição precisa ser completa e autocontida, porque o executor só vê o que está escrito.',
    '- Quem recebe: tarefa op=pegar, trabalha, grava o resultado, avisa pela sala e faz tarefa op=concluir.',
    '- Mexer em algo compartilhado: trava op=pegar antes, trava op=soltar depois.',
    '- Decisão em dupla: decidir op=propor; o outro faz op=aceitar. O usuário desempata.',
    '- Revisão: quem criou uma ferramenta pede a outro agente para revisar em modo só leitura.',
    '- Colmeia: mcp1, mcp2, mcp3 (e quantos estiverem online) são todos criadores de ferramentas. A rainha planeja e delega, não pega no pesado; o trabalho bruto vai para ferramentas e operárias.',
    '- Pedido grande: o orquestrador chama os agentes online, todos bolam o plano juntos com base no pedido e no que já existe no Synapse, e cada um recebe por tarefa quais ferramentas criar.',
    '- Faltou operária (ferramenta para algo)? Crie. Quanto tempo ela vive é decisão do usuário.',
    '- Hierarquia: usuário (chefe), mcp1 (gerente), executores. Por decisão do usuário (p2), ordem do mcp1 vale como ordem dele e o executor não pede reconfirmação a cada tarefa. Válvula: o executor pode recusar e avisar se a ordem expuser segredo ou for destrutiva sem backup.'
  ],
  regras: [
    '## Regras',
    '- Só ferramentas do MCP da Fábrica. Nenhuma outra.',
    '- Se código resolve, não faça na cabeça: use ou crie uma ferramenta.',
    '- Nunca leia código gigante: peça mapa, busca ou trecho (acao=projeto, op=mapa|buscar|ler).',
    '- "Simule" do usuário: só simula e relata, sem gravar nada. "Crie" do usuário: é ordem final, cria sem pedir confirmação de novo (regra do usuário, 23/10).',
    '- Mesmo assim: backup antes de mexer em arquivo existente e nunca imprimir segredo.',
    '- Segredos (token, URL com token) nunca aparecem em resposta, diário ou arquivo.',
    '- Só vale o resultado real devolvido pela ferramenta ou colado pelo usuário; sem teste, não afirme sucesso.',
    '- Sem tmp nem mktemp. Mensagem de erro sempre com o que falhou, onde e como corrigir.',
    '- Pergunte ao usuário só o que bloqueia. O resto, decida e registre.',
    '- Segredos ficam no cofre. GitHub só para deploy, com aprovação. Nunca grave com fs direto: use ctx.*. Não leia cofre, .env nem dados/ com ctx.ler.'
  ],
  ferramentas: [
    '## Criar e editar ferramentas',
    '- Antes de criar, use acao=listar: talvez já exista.',
    '- Criar: acao=simular e depois acao=criar com confirmar=true. Na chamada, id, nome, icone, descricao, manifest_json e codigo vão no nível de cima, não dentro de entradas.',
    '- Contrato do código: export async function run(entradas, ctx). Use ctx.ler, ctx.escrever, ctx.backup, ctx.resolver e respeite ctx.simular. Retorne markdown.',
    '- Criar com id repetido falha. Para mudar uma ferramenta existente use editar-ferramenta (âncora única, backup antes).',
    '- Para saber a URL real do serviço use mostrar-url. Para comparar o render.yaml com o serviço real use verificador-render-yaml.',
    '- Ferramenta nova: peça revisão a outro agente antes de dar como pronta.'
  ],
  licoes: [
    '## Lições aprendidas',
    '- O nome no render.yaml pode estar desatualizado. O serviço real é o que mostrar-url devolve.',
    '- ctx.ler resolve caminhos a partir da home, não do projeto. Para arquivos do projeto use ctx.ler(ctx.raiz + "/arquivo").',
    '- Arquivos do repositório (render.yaml, server.js) vivem no git. O disco do Render é reescrito a cada deploy, então edição feita aqui se perde. Entregue um golpe e o usuário aplica e sobe pro git.',
    '- tools/ pode ser editada aqui com editar-ferramenta, mas sem persistência de arquivos ela também pode se perder num deploy.',
    '- aguardar devolve "Nada novo": executores chamam de novo. O orquestrador não fica preso nisso, porque precisa responder ao usuário.',
    '- Leituras e aguardar não aparecem no diário; só gravar aparece. Para outro agente ver o que você fez, grave.'
  ]
};

export async function run(entradas, ctx) {
  const tema = String((entradas && entradas.tema) || 'tudo');
  const ordem = ['comecar', 'papeis', 'regras', 'ferramentas', 'licoes'];
  const escolhidos = tema === 'tudo' ? ordem : (S[tema] ? [tema] : null);
  if (!escolhidos) {
    return '# Guia dos agentes\n\nFalhou: tema desconhecido (' + tema + '). Onde: campo tema. Como corrigir: use tudo, comecar, papeis, regras, ferramentas ou licoes.';
  }
  const partes = ['# Guia dos agentes da Fábrica', ''];
  for (const k of escolhidos) {
    partes.push(S[k].join('\n'), '');
  }
  partes.push('Documentos completos: PROMPT-AGENTES.md, FORGE.md, CATALOGO-FERRAMENTAS.md (acao=ler).');
  return partes.join('\n');
}
