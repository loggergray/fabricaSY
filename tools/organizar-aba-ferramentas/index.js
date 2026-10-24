import path from 'node:path';

const HOME = `/* Pastas visuais e versões por família */
function grupoDaFerramenta(t) {
  if (t.grupo) return String(t.grupo);
  const id = String(t.id || '').toLowerCase();
  if (/^(pokyoemon|pokemon)(-|$)/.test(id)) return 'Pokyoemon';
  if (/^(criar-|editar-|modularizador-|organizador-)/.test(id)) return 'Forja';
  if (/(mongodb|persistencia)/.test(id)) return 'Memória';
  if (/(guia-agentes|ordenar-plano|relatorios)/.test(id)) return 'Mesa';
  if (/(mostrar-url|render|ambiente)/.test(id)) return 'Ambiente';
  if (/(scratch|teste|sucata)/.test(id)) return 'Sucata';
  return 'Sem pasta';
}
function familiaDaFerramenta(t) {
  return String(t.familia || t.id || '').replace(/-v[0-9]+$/i, '');
}
function iconeDaPasta(nome) {
  const n = nome.toLocaleLowerCase('pt-BR');
  if (n.includes('pokyoemon') || n.includes('pokemon')) return '📘';
  if (n.includes('forja')) return '🛠️';
  if (n.includes('memória') || n.includes('memoria')) return '🧠';
  if (n.includes('mesa')) return '🗳️';
  if (n.includes('ambiente')) return '🧭';
  if (n.includes('sucata')) return '🧪';
  return '📁';
}
function cartaoDaFerramenta(t) {
  if (t.erro) return \`<div class="item erro"><span class="ico">⚠️</span><span><strong>\${esc(t.id)}</strong><small>\${esc(t.erro)}</small></span></div>\`;
  const versao = t.versao ? \`<span class="selo-versao">v\${esc(t.versao)}\${t.instancia ? ' · ' + esc(t.instancia) : ''}</span>\` : '';
  return \`<a class="item" href="#/f/\${encodeURIComponent(t.id)}"><span class="ico">\${esc(t.icone)}</span><span class="item-conteudo"><strong>\${esc(t.nome)}</strong><small>\${esc(t.descricao)}</small>\${versao}</span></a>\`;
}
function telaHome() {
  const grupos = new Map();
  for (const t of ferramentas) {
    const nome = grupoDaFerramenta(t);
    if (!grupos.has(nome)) grupos.set(nome, new Map());
    const familias = grupos.get(nome), familia = familiaDaFerramenta(t);
    if (!familias.has(familia)) familias.set(familia, []);
    familias.get(familia).push(t);
  }
  const ordem = ['Pokyoemon', 'Forja', 'Memória', 'Mesa', 'Ambiente', 'Visão', 'Arquivos', 'Tradução', 'Batalha', 'Sucata', 'Sem pasta'];
  const nomes = [...grupos.keys()].sort((a,b) => (ordem.indexOf(a)<0?999:ordem.indexOf(a))-(ordem.indexOf(b)<0?999:ordem.indexOf(b)) || a.localeCompare(b,'pt-BR'));
  const pastas = nomes.map(nome => {
    const familias = [...grupos.get(nome).entries()].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR'));
    const total = familias.reduce((n,[,vs])=>n+vs.length,0);
    const conteudo = familias.map(([familia,vs]) => {
      vs.sort((a,b)=>String(a.versao||'').localeCompare(String(b.versao||''),'pt-BR',{numeric:true}));
      if (vs.length===1) return cartaoDaFerramenta(vs[0]);
      return \`<details class="familia-versoes"><summary><span>\${esc(vs[0].familia || familia)}</span><small>\${vs.length} versões/instâncias</small></summary><div class="lista-versoes">\${vs.map(cartaoDaFerramenta).join('')}</div></details>\`;
    }).join('');
    return \`<details class="pasta-ferramentas"\${nome==='Pokyoemon'?' open':''}><summary class="pasta-cabecalho"><span class="pasta-icone">\${iconeDaPasta(nome)}</span><span class="pasta-titulo"><strong>\${esc(nome)}</strong><small>\${total} ferramenta(s)</small></span><span class="pasta-seta" aria-hidden="true">›</span></summary><div class="pasta-conteudo">\${conteudo}</div></details>\`;
  }).join('');
  app.innerHTML = \`<article class="doc"><h1>Suas ferramentas</h1><p class="sub">\${ferramentas.length} ferramenta(s), organizadas por pastas. Cada ferramenta continua no seu diretório; versões da mesma família aparecem juntas.</p></article><div class="pastas-ferramentas">\${pastas || '<p class="sub">Nenhuma ferramenta ainda.</p>'}</div>\`;
}
`;

export async function run({ confirmar = false } = {}, ctx) {
  const raiz = ctx.raiz;
  const arquivos = {
    loader: path.join(raiz, 'core/loader.js'),
    app: path.join(raiz, 'public/app.js'),
    css: path.join(raiz, 'public/style.css'),
  };
  let loader = ctx.ler(arquivos.loader), app = ctx.ler(arquivos.app), css = ctx.ler(arquivos.css);
  if (!loader.includes('grupo: m.grupo ||')) {
    const ancora = "versao: m.versao || '0.0.1', tags: m.tags || [], entradas, doc });";
    const novo = "versao: m.versao || '0.0.1', tags: m.tags || [], grupo: m.grupo || '', familia: m.familia || '', instancia: m.instancia || '', entradas, doc });";
    if (loader.indexOf(ancora)<0 || loader.indexOf(ancora)!==loader.lastIndexOf(ancora)) throw new Error('Falhou: âncora única do carregador não encontrada. Onde: core/loader.js. Como corrigir: confira a versão atual antes de aplicar.');
    loader = loader.replace(ancora, novo);
  }
  if (!app.includes('/* Pastas visuais e versões por família */')) {
    const inicio = app.indexOf('function telaHome() {');
    const fim = app.indexOf(String.fromCharCode(10) + 'async function telaAtividade()', inicio);
    if (inicio<0 || fim<0) throw new Error('Falhou: bloco único telaHome não encontrado. Onde: public/app.js. Como corrigir: confira a versão atual antes de aplicar.');
    app = app.slice(0,inicio) + HOME + app.slice(fim);
  }
  if (!css.includes('/* Pastas móveis de ferramentas */')) {
    const estilos = '.pastas-ferramentas{display:grid;gap:12px;margin-top:18px;font-family:var(--sans)}.pasta-ferramentas{margin:0;border:1px solid var(--line);border-radius:16px;background:var(--card);overflow:hidden;color:var(--ink)}.pasta-ferramentas>summary,.familia-versoes>summary{list-style:none;cursor:pointer;min-height:70px;display:flex;align-items:center;gap:14px;padding:12px 16px}.pasta-ferramentas>summary::-webkit-details-marker,.familia-versoes>summary::-webkit-details-marker{display:none}.pasta-icone{width:44px;height:44px;display:grid;place-items:center;border-radius:13px;background:var(--code);font-size:24px}.pasta-titulo{display:grid;gap:1px;flex:1}.pasta-titulo strong{font-size:16px}.pasta-titulo small,.familia-versoes summary small{color:var(--mut);font-size:12px}.pasta-seta{font-size:26px;color:var(--mut);transition:transform .15s}.pasta-ferramentas[open] .pasta-seta{transform:rotate(90deg)}.pasta-conteudo{display:grid;gap:9px;padding:0 12px 12px}.pasta-conteudo .item{margin:0}.item-conteudo{min-width:0;flex:1}.item-conteudo strong,.item-conteudo small{overflow-wrap:anywhere}.selo-versao{display:inline-block;margin-top:7px;padding:2px 8px;border-radius:999px;background:var(--code);color:var(--mut);font:11px var(--sans)}.familia-versoes{margin:0;border:1px solid var(--line);border-radius:12px;background:var(--bg)}.familia-versoes>summary{min-height:50px;padding:8px 12px;justify-content:space-between}.lista-versoes{display:grid;gap:8px;padding:0 8px 8px}.lista-versoes .item{padding:12px}';
    css += String.fromCharCode(10) + '/* Pastas móveis de ferramentas */' + String.fromCharCode(10) + estilos + String.fromCharCode(10);
  }
  if (ctx.simular) {
    ctx.log('Simulação: pastas visuais e agrupamento de versões; diretórios existentes preservados.');
    return '# Simulação\n\nArquivos previstos: core/loader.js, public/app.js e public/style.css. Nenhuma ferramenta será movida; IDs e rotas serão preservados. Pokyoemon abre por padrão.';
  }
  if (confirmar !== true) throw new Error('Falhou: falta confirmação da aplicação. Onde: entrada confirmar. Como corrigir: revise a simulação e marque confirmar.');
  for (const arquivo of Object.values(arquivos)) ctx.backup(arquivo);
  ctx.escrever(arquivos.loader, loader);
  ctx.escrever(arquivos.app, app);
  ctx.escrever(arquivos.css, css);
  ctx.log('Backups criados e organização da aba gravada.');
  return '# Organização aplicada\n\nA aba usa pastas recolhíveis, agrupa versões por família e mantém os diretórios, IDs e rotas existentes.';
}
