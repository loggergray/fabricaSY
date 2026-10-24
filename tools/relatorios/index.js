const BASE = '/tools/relatorios/docs/';
const TAM = 5000;

export async function run(e, ctx) {
  const titulo = '# Relatórios\n\n';
  const falha = (o, onde, como) => titulo + 'Falhou: ' + o + '. Onde: ' + onde + '. Como corrigir: ' + como;
  const modo = String((e && e.modo) || 'ler').trim();
  const nome = String((e && e.nome) || '').trim();
  const parte = Math.max(1, parseInt((e && e.parte) || 1, 10) || 1);
  const idxPath = ctx.raiz + BASE + 'indice.json';

  let indice = { docs: [] };
  try {
    const t = ctx.ler(idxPath);
    const j = JSON.parse(String(t));
    if (j && Array.isArray(j.docs)) indice = j;
  } catch (err) { /* sem índice ainda */ }

  if (modo === 'listar') {
    if (!indice.docs.length) return titulo + 'Nenhum relatório salvo ainda.';
    const linhas = indice.docs.slice().reverse().map(d => '- **' + d.nome + '**: ' + (d.titulo || '(sem título)') + ' (' + String(d.data || '').slice(0, 16).replace('T', ' ') + ' UTC)');
    return titulo + 'Do mais recente ao mais antigo:\n\n' + linhas.join('\n') + '\n\nPara ler: modo=ler com o nome.';
  }

  if (modo === 'ler') {
    let alvo = nome;
    if (!alvo) {
      if (!indice.docs.length) return titulo + 'Nenhum relatório salvo ainda.';
      alvo = indice.docs[indice.docs.length - 1].nome;
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(alvo)) return falha('nome inválido', 'campo nome', 'use minúsculas, números e hífen.');
    let texto;
    try { texto = String(ctx.ler(ctx.raiz + BASE + alvo + '.md')); }
    catch (err) { return falha('relatório "' + alvo + '" não encontrado', 'tools/relatorios/docs', 'use modo=listar para ver os nomes salvos.'); }
    const total = Math.max(1, Math.ceil(texto.length / TAM));
    if (parte > total) return falha('a parte ' + parte + ' não existe (o relatório tem ' + total + ')', 'campo parte', 'use uma parte de 1 a ' + total + '.');
    const trecho = texto.slice((parte - 1) * TAM, parte * TAM);
    const rodape = parte < total ? '\n\n---\n*Parte ' + parte + ' de ' + total + '. Próxima: modo=ler, nome=' + alvo + ', parte=' + (parte + 1) + '.*' : '\n\n---\n*Fim (parte ' + parte + ' de ' + total + ').*';
    return '*Relatório ' + alvo + ', parte ' + parte + ' de ' + total + '*\n\n' + trecho + rodape;
  }

  if (modo === 'salvar') {
    const conteudo = String((e && e.conteudo) || '');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(nome)) return falha('nome inválido ou vazio', 'campo nome', 'use minúsculas, números e hífen.');
    if (!conteudo.trim()) return falha('conteúdo vazio', 'campo conteudo', 'cole o relatório em markdown.');
    if (conteudo.length > 60000) return falha('conteúdo grande demais (' + conteudo.length + ' caracteres)', 'campo conteudo', 'divida em relatórios de até 60000 caracteres.');
    const m = conteudo.match(/^#\s+(.+)$/m);
    const tit = String((e && e.titulo) || (m && m[1]) || nome).trim();
    const caminho = ctx.raiz + BASE + nome + '.md';
    if (!ctx.simular) ctx.backup(caminho);
    ctx.escrever(caminho, conteudo);
    const novo = { docs: indice.docs.filter(d => d.nome !== nome) };
    novo.docs.push({ nome: nome, titulo: tit, data: new Date().toISOString() });
    ctx.escrever(idxPath, JSON.stringify(novo, null, 2));
    return titulo + (ctx.simular ? 'Simulação: nada foi gravado.\n' : 'Relatório salvo.\n')
      + '- Nome: ' + nome + '\n- Título: ' + tit + '\n- Tamanho: ' + conteudo.length + ' caracteres\n- Para ler: modo=ler, nome=' + nome + '\n';
  }

  return falha('modo desconhecido (' + modo + ')', 'campo modo', 'use ler, listar ou salvar.');
}
