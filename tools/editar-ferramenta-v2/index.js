export async function run(e, ctx) {
  const titulo = '# Editar ferramenta v2\n\n';
  const falha = (o, onde, como) => titulo + 'Falhou: ' + o + '. Onde: ' + onde + '. Como corrigir: ' + como;
  const msg = err => (err && err.message ? err.message : String(err));
  const id = String((e && e.id) || '').trim();
  const arq = String((e && e.arquivo) || 'index.js').trim();
  const ache0 = String((e && e.ache) || '');
  const por0 = String(e && e.por != null ? e.por : '');
  const sintaxe = String((e && e.validar_sintaxe) || 'sim').trim() !== 'nao';
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return falha('id inválido', 'campo id', 'use minúsculas, números e hífen, sem barra nem ponto.');
  if (!['index.js', 'manifest.json', 'README.md'].includes(arq)) return falha('arquivo não permitido', 'campo arquivo', 'escolha index.js, manifest.json ou README.md.');
  if (!ache0) return falha('Âncora vazia', 'campo ache', 'cole o trecho exato que existe hoje no arquivo.');
  const rel = 'tools/' + id + '/' + arq;
  const caminho = ctx.raiz + '/' + rel;
  let texto;
  try { texto = String(ctx.ler(caminho)); }
  catch (err) { return falha('não consegui ler ' + rel + ' (' + msg(err) + ')', 'ctx.ler', 'confirme o id da ferramenta e o arquivo; use acao=listar.'); }

  const crlf = texto.includes('\r\n');
  const norm = s => (crlf ? s.replace(/\r?\n/g, '\r\n') : s.replace(/\r\n/g, '\n'));
  const ache = norm(ache0);
  const por = norm(por0);
  const lin = i => texto.slice(0, i).split('\n').length;
  const pos = [];
  for (let i = texto.indexOf(ache); i !== -1 && pos.length < 50; i = texto.indexOf(ache, i + ache.length)) pos.push(i);

  if (pos.length === 0) {
    const col = s => s.replace(/\s+/g, ' ').trim();
    let dica = 'copie o trecho exato do arquivo (acao=projeto op=ler).';
    if (col(texto).includes(col(ache))) {
      dica = 'o trecho existe, mas difere em espaços, indentação ou quebras de linha: copie com a indentação idêntica.';
    } else {
      const primeira = ache.split('\n').map(l => l.trim()).find(l => l);
      const i = primeira ? texto.indexOf(primeira) : -1;
      if (i !== -1) dica = 'a primeira linha do trecho aparece na linha ' + lin(i) + ', mas o resto difere: releia o arquivo e copie de novo.';
    }
    return falha('Âncora encontrada 0 vez(es), precisa ser exatamente 1', rel, dica);
  }
  if (pos.length > 1) {
    return falha('Âncora encontrada ' + pos.length + ' vezes (linhas ' + pos.slice(0, 5).map(lin).join(', ') + '), precisa ser exatamente 1', rel, 'aumente o trecho com linhas vizinhas até ficar único.');
  }

  const novo = texto.slice(0, pos[0]) + por + texto.slice(pos[0] + ache.length);
  const avisos = [];

  if (arq === 'manifest.json') {
    let m;
    let antes = null;
    try { antes = JSON.parse(texto); } catch (err) { antes = null; }
    try { m = JSON.parse(novo); }
    catch (err) { return falha('o manifest ficaria com JSON inválido (' + msg(err) + ')', rel, 'revise o trecho novo.'); }
    if (!m || typeof m !== 'object' || Array.isArray(m)) return falha('o manifest precisa ser um objeto JSON', rel, 'mantenha as chaves { } do manifest.');
    if (m.id !== id) return falha('id do manifest (' + m.id + ') diferente da pasta (' + id + ')', rel, 'mantenha "id" igual ao nome da pasta.');
    for (const k of ['nome', 'descricao']) {
      const ok = typeof m[k] === 'string' && m[k].trim();
      const tinha = antes && typeof antes[k] === 'string' && antes[k].trim();
      if (!ok && tinha) return falha('o manifest perderia o campo ' + k, rel, 'mantenha "' + k + '" com texto.');
      if (!ok) avisos.push('manifest sem o campo ' + k);
    }
    const ehObj = v => v && typeof v === 'object' && !Array.isArray(v);
    for (const [k, t] of [['permissoes', 'obj'], ['entradas', 'arr'], ['testes', 'arr'], ['dependencias', 'arr']]) {
      if (k in m && !(t === 'arr' ? Array.isArray(m[k]) : ehObj(m[k]))) {
        return falha('campo ' + k + ' com tipo errado no manifest', rel, 'use ' + (t === 'arr' ? 'uma lista [ ]' : 'um objeto { }') + ' em "' + k + '".');
      }
    }
    const pa = (antes && ehObj(antes.permissoes)) ? antes.permissoes : {};
    const pn = ehObj(m.permissoes) ? m.permissoes : {};
    for (const k of ['rede', 'processos', 'instalar']) {
      if (pn[k] === true && pa[k] !== true) avisos.push('permissão ' + k + ' passou a true');
    }
    for (const k of ['ler', 'escrever']) {
      const a = Array.isArray(pa[k]) ? pa[k] : [];
      const extra = (Array.isArray(pn[k]) ? pn[k] : []).filter(x => !a.includes(x));
      if (extra.length) avisos.push('permissão ' + k + ' ampliada: ' + extra.join(', '));
    }
  }

  if (arq === 'index.js') {
    const semComent = novo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (!/^\s*export\s+(async\s+function\s+run\b|(const|let|var)\s+run\b|\{[^}]*\brun\b[^}]*\})/m.test(semComent)) {
      return falha('o index.js perderia a função run exportada', rel, 'mantenha a função run exportada, fora de comentários.');
    }
    if (sintaxe) {
      let vm = null;
      try { vm = await import('node:vm'); } catch (err) { vm = null; }
      if (!vm || typeof vm.Script !== 'function') {
        avisos.push('sintaxe não verificada: node:vm indisponível');
      } else {
        const corpo = novo
          .replace(/^\s*import\s+[^;'"]*?from\s*['"][^'"]+['"]\s*;?/gm, '')
          .replace(/^\s*import\s*['"][^'"]+['"]\s*;?/gm, '')
          .replace(/^\s*export\s+default\s+/gm, 'const __padrao__ = ')
          .replace(/^\s*export\s+(?=async\b|function\b|const\b|let\b|var\b|class\b)/gm, '')
          .replace(/^\s*export\s*\{[^}]*\}\s*(from\s*['"][^'"]+['"])?\s*;?/gm, '')
          .replace(/\bimport\.meta\b/g, '({})');
        try { new vm.Script('(async function(){\n' + corpo + '\n})', { filename: rel }); }
        catch (err) { return falha('erro de sintaxe no index.js novo (' + msg(err) + ')', rel, 'corrija o trecho novo; em caso de falso alarme use validar_sintaxe=nao.'); }
      }
    } else {
      avisos.push('sintaxe do index.js não validada (validar_sintaxe=nao)');
    }
  }

  if (id.startsWith('editar-ferramenta')) avisos.push('você está editando um editor de ferramentas: confira o backup antes de usá-lo de novo');

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const bk = '.historico/' + ts + '/' + id + '/' + arq;
  ctx.backup(caminho);
  ctx.escrever(ctx.raiz + '/' + bk, texto);
  ctx.escrever(caminho, novo);

  let verif = 'não aplicável (simulação)';
  if (!ctx.simular) {
    try { verif = String(ctx.ler(caminho)) === novo ? 'ok (arquivo relido e conferido)' : 'FALHOU: o conteúdo gravado difere do esperado'; }
    catch (err) { verif = 'FALHOU: não consegui reler (' + msg(err) + ')'; }
  }
  return titulo
    + (ctx.simular ? 'Simulação: nada foi gravado.\n' : 'Gravado.\n')
    + '- Arquivo: ' + rel + '\n'
    + '- Tamanho: ' + texto.length + ' → ' + novo.length + ' caracteres\n'
    + '- Âncora única: sim (linha ' + lin(pos[0]) + ')\n'
    + '- Backup: ' + bk + (ctx.simular ? ' (não criado na simulação)' : '') + '\n'
    + '- Verificação: ' + verif + '\n'
    + avisos.map(a => '- ATENÇÃO: ' + a + '\n').join('');
}
