export async function run({ momento }, ctx) {
  const modo = String(momento || 'entrada').trim().toLowerCase();
  if (!['entrada', 'retomada'].includes(modo)) throw new Error('Momento inválido; use entrada ou retomada.');
  ctx.log(modo === 'entrada' ? 'Preparando o contexto do livro Pokémon.' : 'Recuperando as regras do livro Pokémon.');
  const linhas = [
    '# 📘 Livro Pokémon · contexto de trabalho',
    '',
    'Este livro é um espaço de projeto separado do KYONFC e de qualquer sala global. A interface do KyDevor, o chat do livro e os agentes MCP são canais diferentes para trabalhar no mesmo projeto; não se deve presumir que já estejam integrados até um teste confirmar a conexão.',
    '',
    '## Visão do projeto',
    'Pokémon é uma experiência de jogo e de crescimento: história, atmosfera, personagens e a vida dos jogadores importam tanto quanto as batalhas. O foco de desenvolvimento inclui batalhas táticas e mecânicas consistentes, com câmera de cima e planejamento multiplataforma para Android, iOS e PC. Não invente nomes, cânone ou decisões de design que ainda não estejam nos documentos do livro.',
    '',
    '## Regras de colaboração',
    '- O usuário é a autoridade final e pode dar instruções por qualquer canal conectado ao livro.',
    '- MCPs que participam devem colaborar na sala Pokémon; não levar conversas, decisões ou arquivos desse projeto para a sala global.',
    '- A primeira agente a assumir resume a solicitação; as demais podem complementar ou contestar com evidências. O usuário desempata.',
    '- O objetivo é resolver em conjunto; registrar desacordos como questões a decidir, não como derrota de uma agente.',
    '- Preferir ferramentas pequenas e especializadas, agrupadas sob Pokyoemon, com versões relacionadas como instâncias. Não despejar código ou documentos extensos no contexto do agente.',
    '- Arquivos do projeto devem ser acessados por ferramentas controladas de mapa, busca, fatiamento, comparação e resumo. Não afirmar que existe bloqueio de leitura direta enquanto esse controle não estiver implementado e testado.',
    '- Todo recurso, integração, upload, agrupamento ou ferramenta nova precisa de simulação, testes e registro do resultado antes de ser declarado concluído.',
    '',
    '## Estado desta entrada',
    modo === 'entrada'
      ? 'Esta ferramenta entrega o briefing do livro. Ela não comprova que o agente entrou tecnicamente em uma sala KyDevor, não identifica a sessão autenticada e não desbloqueia arquivos. A integração e o bloqueio por sala precisam ser implementados na camada Synapse/KyDevor e validados separadamente.'
      : 'Retomada de contexto: confira o histórico, as decisões, o roadmap e o último bastão do livro antes de continuar. Não invente testes aprovados nem marque itens concluídos sem resultados observáveis.',
    '',
    '## Próximo passo',
    'Usar somente ferramentas e documentos associados ao livro Pokémon; registrar o pedido, o plano, as decisões, os testes e o ponto de parada. Se ainda não houver uma ferramenta de sala/catálogo Pokémon conectada, relatar essa dependência com clareza.'
  ];
  return linhas.join('\n');
}
