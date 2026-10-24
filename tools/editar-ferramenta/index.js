export async function run(e, ctx) {
  const titulo = '# Editar ferramenta\n\n';
  const falha = (o, onde, como) => titulo + 'Falhou: ' + o + '. Onde: ' + onde + '. Como corrigir: ' + como;
  const id = String((e && e.id) || '').trim();
  const arq = String((e && e.arquivo) || 'index.js').trim();
  const ache = String((e && e.ache) || '');
  const por = String(e && e.por != null ? e.por : '');
  if (!/^[a-z0-9-]+$/.test(id)) return falha('id inválido', 'campo id', 'use minúsculas, números e hífen.');
  if (!['index.js', 'manifest.json', 'README.md'].includes(arq)) return falha('arquivo não permitido', 'campo arquivo', 'escolha index.js, manifest.json ou README.md.');
  if (!ache) return falha('Âncora vazia', 'campo ache', 'cole o trecho exato que existe hoje no arquivo.');
  const caminho = ctx.raiz + '/tools/' + id + '/' + arq;
  let texto;
  try { texto = String(ctx.ler(caminho)); }
  catch (err) { return falha('não consegui ler tools/' + id + '/' + arq, 'ctx.ler', 'confirme o id da ferramenta e o nome do arquivo.'); }
  const n = texto.split(ache).length - 1;
  if (n !== 1) return falha('Âncora encontrada ' + n + ' vez(es), precisa ser exatamente 1', 'tools/' + id + '/' + arq, 'copie um trecho único, com indentação idêntica.');
  const novo = texto.replace(ache, () => por);
  if (arq === 'manifest.json') {
    try { JSON.parse(novo); }
    catch (err) { return falha('o manifest ficaria com JSON inválido', 'tools/' + id + '/manifest.json', 'revise o trecho novo.'); }
  }
  if (arq === 'index.js' && !/export\s+async\s+function\s+run/.test(novo)) {
    return falha('o index.js perderia a função run exportada', 'tools/' + id + '/index.js', 'mantenha export async function run.');
  }
  if (!ctx.simular) ctx.backup(caminho);
  ctx.escrever(caminho, novo);
  return titulo
    + (ctx.simular ? 'Simulação: nada foi gravado.\n' : 'Gravado, com backup em .historico.\n')
    + '- Arquivo: tools/' + id + '/' + arq + '\n'
    + '- Tamanho: ' + texto.length + ' → ' + novo.length + ' caracteres\n'
    + '- Âncora única: sim\n';
}
