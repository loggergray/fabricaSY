import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse, serialize, serializeOuter } from 'parse5';
import * as acorn from 'acorn';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ATOMOS = new Set(['a','button','input','select','textarea','img','label','h1','h2','h3','h4','h5','h6','p','span','svg','video','audio','canvas','iframe','i','b','strong','em','small','code','pre','picture','td','th','figcaption']);
const NAO = new Set(['script','style','template','noscript','br','hr','wbr','link','meta','title','base']);
const RANK = { secoes: 1, componentes: 2, atomos: 3 };
const MARC = /<!--@include ([\w\/-]+)(?: (\{[\s\S]*?\}))?-->|\{\{(\w+)\}\}/g;
const ANINHA = /^@(media|supports|container|layer|document)\b/i;

// ---------- utilidades ----------
const ehEl = n => !!n.tagName;
const attr = (n, k) => (n.attrs || []).find(a => a.name === k)?.value;
const classes = n => (attr(n, 'class') || '').split(/\s+/).filter(Boolean);
const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
const escTexto = s => s.replace(/&/g, '&amp;').replace(/\u00a0/g, '&nbsp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => s.replace(/&/g, '&amp;').replace(/\u00a0/g, '&nbsp;').replace(/"/g, '&quot;');
const jsonSeguro = o => JSON.stringify(o).replace(/>/g, '\\u003e');
const escJs = s => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const nz = s => s.replace(/\s+/g, ' ');
const remover = n => { const i = n.parentNode.childNodes.indexOf(n); n.parentNode.childNodes.splice(i, 1); };
const comentario = (pai, data) => ({ nodeName: '#comment', data, parentNode: pai });

function sig(n) {
  if (n.nodeName === '#text') return n.value.trim() ? 'T' : (n.value ? 'w' : '');
  if (n.nodeName === '#comment') return 'C:' + n.data;
  if (!ehEl(n)) return '';
  const a = n.attrs.filter(x => x.name !== 'class').map(x => x.name).sort().join(',');
  return n.tagName + '.' + classes(n).join('.') + '[' + a + '](' + n.childNodes.map(sig).filter(Boolean).join('|') + ')';
}

function coletarSlots(el) {
  const out = [];
  (function v(n) {
    if (n.nodeName === '#text') { if (n.value.trim()) out.push({ tipo: 'texto', n, valor: n.value }); return; }
    if (!ehEl(n)) return;
    for (const a of [...n.attrs].sort((x, y) => (x.name < y.name ? -1 : 1)))
      if (a.name !== 'class') out.push({ tipo: 'attr', a, nome: a.name, valor: a.value });
    n.childNodes.forEach(v);
  })(el);
  return out;
}

// ---------- CSS ----------
function parseBlocos(src) {
  const out = []; let i = 0;
  while (i < src.length) {
    let j = i, paren = 0, q = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '(') paren++; else if (c === ')') paren--;
      else if (paren <= 0 && (c === '{' || c === ';')) break;
    }
    const head = src.slice(i, j).trim();
    if (j >= src.length) { if (head) out.push({ raw: head }); break; }
    if (src[j] === ';') { if (head) out.push({ raw: head + ';' }); i = j + 1; continue; }
    let depth = 1, k = j + 1; q = null;
    for (; k < src.length && depth; k++) {
      const c = src[k];
      if (q) { if (c === '\\') k++; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '{') depth++; else if (c === '}') depth--;
    }
    const body = src.slice(j + 1, k - 1);
    out.push(head.startsWith('@') ? { at: head, body } : { sel: head, body: body.trim() });
    i = k;
  }
  return out;
}

function dividir(s) {
  const r = []; let d = 0, b = '';
  for (const c of s) {
    if (c === '(' || c === '[') d++; else if (c === ')' || c === ']') d--;
    if (c === ',' && d === 0) { r.push(b.trim()); b = ''; } else b += c;
  }
  if (b.trim()) r.push(b.trim());
  return r;
}

function distribuir(nos, dono) {
  const saida = new Map();
  const add = (o, t) => { if (!saida.has(o)) saida.set(o, []); saida.get(o).push(t); };
  for (const no of nos) {
    if (no.raw !== undefined) add('base', no.raw);
    else if (no.at !== undefined) {
      if (ANINHA.test(no.at)) {
        for (const [o, arr] of distribuir(parseBlocos(no.body), dono)) add(o, no.at + ' {\n' + arr.join('\n') + '\n}');
      } else add('base', no.at + ' {' + no.body + '}');
    } else {
      const grupos = new Map();
      for (const s of dividir(no.sel)) { const o = dono(s); if (!grupos.has(o)) grupos.set(o, []); grupos.get(o).push(s); }
      for (const [o, sels] of grupos) add(o, sels.join(',\n') + ' {\n  ' + no.body + '\n}');
    }
  }
  return saida;
}

function achatar(nos, pre = '') {
  const r = []; const n = s => s.replace(/\s+/g, ' ').trim();
  for (const no of nos) {
    if (no.raw !== undefined) r.push(pre + '|raw|' + n(no.raw));
    else if (no.at !== undefined) {
      if (ANINHA.test(no.at)) r.push(...achatar(parseBlocos(no.body), pre + n(no.at) + '>'));
      else r.push(pre + '|at|' + n(no.at) + '|' + n(no.body));
    } else for (const s of dividir(no.sel)) r.push(pre + '|' + n(s) + '|' + n(no.body));
  }
  return r;
}

// ---------- geração de módulos JS ----------
function gerarModulo(html, dir, cssTexto) {
  let corpo = '', ult = 0; const imps = new Set();
  html.replace(MARC, (m, k, j, ph, off) => {
    corpo += escJs(html.slice(ult, off)); ult = off + m.length;
    if (ph !== undefined) corpo += '${p["' + ph + '"] ?? ""}';
    else {
      const v = 'c_' + k.replace(/\W/g, '_');
      imps.add("import " + v + " from '" + dir + k + ".js';");
      corpo += '${' + v + '(' + (j || '') + ')}';
    }
    return m;
  });
  corpo += escJs(html.slice(ult));
  const topo = [...imps];
  if (cssTexto) topo.push("import { css } from '" + dir + "runtime.js';");
  return topo.join('\n') + (topo.length ? '\n\n' : '') +
    (cssTexto ? 'css(`' + escJs(cssTexto) + '`);\n\n' : '') +
    'export default (p = {}) => `' + corpo + '`;\n';
}

// ---------- ferramenta ----------
export async function run(e, ctx) {
  const avisos = [];
  let html;
  if (e.origem && e.origem.trim()) html = ctx.ler(e.origem);
  else if (e.html_colado && e.html_colado.trim()) html = e.html_colado;
  else throw new Error('Informe o caminho do HTML ou cole o conteúdo.');
  if (!e.destino || !e.destino.trim()) throw new Error('Informe a pasta de saída.');

  const destino = ctx.resolver(e.destino);
  const modo = e.saida === 'html' ? 'html' : 'js';
  const nivel = RANK[e.nivel] ? e.nivel : 'atomos';
  const unificar = e.repetidos !== false;

  const marca = path.join(destino, '.modularizado');
  const existe = fs.existsSync(destino) && fs.readdirSync(destino).length > 0;
  if (existe && !fs.existsSync(marca))
    throw new Error('A pasta ' + destino + ' não está vazia e não foi criada por esta ferramenta. Escolha outra pasta de saída.');

  // 1) parse e extração de <style> e <script> inline
  ctx.log('Analisando HTML…');
  const doc = parse(html);
  const raizHtml = doc.childNodes.find(n => n.tagName === 'html');
  const head = raizHtml.childNodes.find(n => n.tagName === 'head');
  const body = raizHtml.childNodes.find(n => n.tagName === 'body');
  let cssOrig = '';
  const scripts = [];
  (function varre(n) {
    for (const f of [...(n.childNodes || [])]) {
      if (!ehEl(f)) continue;
      const svg = f.namespaceURI && String(f.namespaceURI).includes('svg');
      const txt = () => f.childNodes.map(c => c.value || '').join('');
      if (f.tagName === 'style' && !svg) {
        const media = attr(f, 'media');
        cssOrig += (media ? '@media ' + media + ' {\n' + txt() + '\n}' : txt()) + '\n';
        remover(f);
      } else if (f.tagName === 'script' && !attr(f, 'src') && /^(|text\/javascript|application\/javascript)$/i.test(attr(f, 'type') || '')) {
        scripts.push(txt()); remover(f);
      } else varre(f);
    }
  })(doc);

  // 2) decomposição molecular
  const antes = serialize(body);
  const pecas = new Map();
  const grupos = [];
  const usados = { secoes: new Set(), componentes: new Set(), atomos: new Set() };
  const unico = (tipo, base) => { let n = base, i = 2; while (usados[tipo].has(n)) n = base + '-' + i++; usados[tipo].add(n); return n; };
  const nomeDe = n => slug(attr(n, 'id') || classes(n)[0] || n.tagName);
  const ehAtomo = n => ATOMOS.has(n.tagName) || !n.childNodes.some(ehEl);
  const tipoDe = (n, d) => (ehAtomo(n) ? 'atomos' : d === 1 ? 'secoes' : 'componentes');
  const permitido = (n, d) => !NAO.has(n.tagName) && RANK[tipoDe(n, d)] <= RANK[nivel];
  const trocar = (n, dados) => { const p = n.parentNode; p.childNodes[p.childNodes.indexOf(n)] = comentario(p, '@include ' + dados); };

  function unica(n, d) {
    const tipo = tipoDe(n, d), nome = unico(tipo, nomeDe(n)), chave = tipo + '/' + nome;
    pecas.set(chave, { chave, tipo, nome, html: serializeOuter(n) });
    trocar(n, chave);
  }

  function repetida(lista, d) {
    const tipo = tipoDe(lista[0], d), nome = unico(tipo, nomeDe(lista[0])), chave = tipo + '/' + nome;
    const todos = lista.map(coletarSlots);
    const usadosP = new Set(); const variaveis = [];
    todos[0].forEach((s, i) => {
      if (new Set(todos.map(t => t[i].valor)).size > 1) {
        const b = s.tipo === 'texto' ? 'texto' : s.nome.replace(/\W/g, '_');
        let p = b, k = 2; while (usadosP.has(p)) p = b + k++;
        usadosP.add(p); variaveis.push([i, p]);
      }
    });
    const valores = lista.map((_, j) => Object.fromEntries(variaveis.map(([i, p]) =>
      [p, (todos[j][i].tipo === 'texto' ? escTexto : escAttr)(todos[j][i].valor)])));
    for (const [i, p] of variaveis) { const s = todos[0][i]; if (s.tipo === 'texto') s.n.value = '{{' + p + '}}'; else s.a.value = '{{' + p + '}}'; }
    pecas.set(chave, { chave, tipo, nome, html: serializeOuter(lista[0]) });
    lista.forEach((n, j) => trocar(n, chave + (variaveis.length ? ' ' + jsonSeguro(valores[j]) : '')));
    grupos.push({ chave, vezes: lista.length, props: variaveis.map(v => v[1]) });
  }

  function varrer(pai, prof) {
    const d = prof + 1;
    const filhos = pai.childNodes.filter(ehEl);
    const tratados = new Set();
    if (unificar) {
      const g = new Map();
      for (const n of filhos) {
        if (!permitido(n, d)) continue;
        const s = sig(n);
        if (!g.has(s)) g.set(s, []);
        g.get(s).push(n);
      }
      for (const lista of g.values()) if (lista.length > 1) { repetida(lista, d); lista.forEach(n => tratados.add(n)); }
    }
    for (const n of filhos) {
      if (tratados.has(n)) continue;
      if (!ehAtomo(n)) varrer(n, d);
      if (permitido(n, d)) unica(n, d);
    }
  }
  varrer(body, 0);
  const corpo = serialize(body);

  // 3) verificação do HTML: remonta e compara
  const resolver = (h, props = {}) => h.replace(MARC, (m, k, j, ph) =>
    ph !== undefined ? (props[ph] ?? '') : resolver(pecas.get(k).html, j ? JSON.parse(j) : {}));
  const remontado = resolver(corpo);
  if (nz(remontado) !== nz(antes)) {
    const a = nz(antes), b = nz(remontado); let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    throw new Error('Verificação falhou: o HTML remontado difere do original perto de "' + a.slice(Math.max(0, i - 40), i + 60) + '". Nada foi gravado. (Se o HTML tiver "{{ }}" literais, eles conflitam com as props.)');
  }
  const exato = remontado === antes;

  // 4) CSS por dono
  const mapa = new Map();
  for (const p of pecas.values()) {
    const toks = new Set();
    for (const m of p.html.matchAll(/\bclass="([^"]*)"/g)) m[1].split(/\s+/).filter(Boolean).forEach(c => toks.add('.' + c));
    for (const m of p.html.matchAll(/\bid="([^"]*)"/g)) toks.add('#' + m[1]);
    toks.forEach(t => { if (!mapa.has(t)) mapa.set(t, new Set()); mapa.get(t).add(p.chave); });
  }
  const dono = sel => {
    const s = sel.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '');
    const comp = s.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean).pop() || '';
    for (const t of comp.match(/[.#][_a-zA-Z][\w-]*/g) || []) { const o = mapa.get(t); if (o && o.size === 1) return [...o][0]; }
    return 'base';
  };
  const cssLimpo = cssOrig.replace(/\/\*[\s\S]*?\*\//g, '');
  const baldes = cssLimpo.trim() ? distribuir(parseBlocos(cssLimpo), dono) : new Map();
  const cssDe = k => (baldes.get(k) || []).join('\n\n');
  const regrasOrig = achatar(parseBlocos(cssLimpo)).sort();
  const regrasNovo = achatar(parseBlocos([...baldes.values()].flat().join('\n'))).sort();
  if (JSON.stringify(regrasOrig) !== JSON.stringify(regrasNovo))
    throw new Error('Verificação falhou: o CSS redistribuído não confere com o original. Nada foi gravado.');
  if (/\/\*/.test(cssOrig)) avisos.push('Comentários do CSS não são preservados.');

  // 5) JS por dono
  const jsBase = []; const jsPeca = new Map(); let nStmt = 0;
  for (const src of scripts) {
    let ast;
    try { ast = acorn.parse(src, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }); }
    catch (err) { avisos.push('Script não analisável (' + err.message + '): mantido inteiro em js/base.js.'); jsBase.push(src.trim()); continue; }
    let ant = 0;
    for (const st of ast.body) {
      const trecho = src.slice(ant, st.end).trim(); ant = st.end; nStmt++;
      let alvo = null;
      if (st.type === 'ExpressionStatement') {
        const s = src.slice(st.start, st.end); const toks = new Set();
        for (const m of s.matchAll(/getElementById\(\s*['"`]([^'"`]+)['"`]/g)) toks.add('#' + m[1]);
        for (const m of s.matchAll(/getElementsByClassName\(\s*['"`]([^'"`]+)['"`]/g)) toks.add('.' + m[1].trim().split(/\s+/)[0]);
        for (const m of s.matchAll(/['"`]([^'"`\n]*)['"`]/g)) for (const t of m[1].match(/[.#][_a-zA-Z][\w-]*/g) || []) toks.add(t);
        const donos = new Set(); toks.forEach(t => mapa.get(t)?.forEach(c => donos.add(c)));
        if (donos.size === 1) alvo = [...donos][0];
      }
      if (alvo) { if (!jsPeca.has(alvo)) jsPeca.set(alvo, []); jsPeca.get(alvo).push(trecho); } else jsBase.push(trecho);
    }
    const resto = src.slice(ant).trim(); if (resto) jsBase.push(resto);
  }
  const chk = (nome, cod, modulo) => {
    try { acorn.parse(cod, { ecmaVersion: 'latest', allowReturnOutsideFunction: true, sourceType: modulo ? 'module' : 'script' }); }
    catch (err) { throw new Error('JS inválido gerado em ' + nome + ': ' + err.message); }
  };
  const jsArquivos = [];
  const saidas = new Map();
  if (jsBase.length) { const c = jsBase.join('\n\n') + '\n'; chk('js/base.js', c); saidas.set('js/base.js', c); jsArquivos.push('js/base.js'); }
  for (const k of [...jsPeca.keys()].sort()) {
    const c = jsPeca.get(k).join('\n\n') + '\n'; chk('js/' + k + '.js', c);
    saidas.set('js/' + k + '.js', c); jsArquivos.push('js/' + k + '.js');
  }

  // 6) montagem dos arquivos de saída
  saidas.set('original.html', html);
  const todasPecas = [...pecas.values()];
  if (modo === 'html') {
    head.childNodes.push(comentario(head, '@estilos'));
    body.childNodes.push(comentario(body, '@scripts'));
    saidas.set('src/pagina.html', serialize(doc));
    for (const p of todasPecas) saidas.set('src/' + p.chave + '.html', p.html);
    if (baldes.has('base')) saidas.set('css/base.css', cssDe('base') + '\n');
    for (const p of todasPecas) if (baldes.has(p.chave)) saidas.set('css/' + p.chave + '.css', cssDe(p.chave) + '\n');
    saidas.set('build.cjs', fs.readFileSync(path.join(AQUI, 'templates/build.cjs'), 'utf8'));
  } else {
    body.childNodes.length = 0;
    body.childNodes.push(comentario(body, '@corpo'));
    const tags = ['<script type="module" src="src/main.js"></script>', ...jsArquivos.map(f => '<script defer src="' + f + '"></script>')].join('\n');
    saidas.set('index.html', serialize(doc).replace('<!--@corpo-->', () => tags));
    saidas.set('src/runtime.js', 'export const estilos = new Set();\nexport const css = (t) => estilos.add(t);\n');
    saidas.set('src/base-css.js', "import { css } from './runtime.js';\n" + (baldes.has('base') ? 'css(`' + escJs(cssDe('base')) + '`);\n' : ''));
    saidas.set('src/main.js',
      "import { estilos } from './runtime.js';\nimport './base-css.js';\nimport pagina from './pagina.js';\n\n" +
      "const st = document.createElement('style');\nst.textContent = [...estilos].join('\\n');\ndocument.head.append(st);\n" +
      "document.body.insertAdjacentHTML('afterbegin', pagina());\n");
    saidas.set('src/pagina.js', gerarModulo(corpo, './', ''));
    for (const p of todasPecas) saidas.set('src/' + p.chave + '.js', gerarModulo(p.html, '../', cssDe(p.chave)));
    for (const [rel, c] of saidas) if (rel.startsWith('src/')) chk(rel, c, true);
    saidas.set('servir.cjs', fs.readFileSync(path.join(AQUI, 'templates/servir.cjs'), 'utf8'));
  }

  // 7) relatório
  const cont = { secoes: 0, componentes: 0, atomos: 0 };
  todasPecas.forEach(p => cont[p.tipo]++);
  const nCss = [...baldes.keys()].length;
  const nJsPeca = [...jsPeca.values()].reduce((s, a) => s + a.length, 0);
  const L = [];
  L.push('# ' + (ctx.simular ? 'Simulação' : 'Modularização') + ' concluída', '');
  L.push('**Destino:** `' + destino + '`  ');
  L.push('**Formato:** ' + (modo === 'js' ? 'módulos JS' : 'HTML concatenado') + ' · **Profundidade:** ' + nivel, '');
  L.push('## Resumo', '');
  L.push('- Seções: **' + cont.secoes + '** · Componentes: **' + cont.componentes + '** · Átomos: **' + cont.atomos + '**');
  L.push('- Repetidos unificados: **' + grupos.length + '** grupo(s)');
  for (const g of grupos.slice(0, 12)) L.push('  - `' + g.chave + '` ×' + g.vezes + (g.props.length ? ' (props: ' + g.props.map(x => '`' + x + '`').join(', ') + ')' : ' (idênticos)'));
  L.push('- CSS: **' + regrasOrig.length + '** regra(s) em **' + nCss + '** arquivo(s)');
  L.push('- JS: **' + nStmt + '** instrução(ões), **' + nJsPeca + '** ligada(s) a peças, o resto em `base`', '');
  L.push('## Verificação', '');
  L.push('- ✔ HTML remontado ' + (exato ? 'idêntico ao original' : 'equivalente ao original (espaços de formatação normalizados)'));
  L.push('- ✔ CSS: ' + regrasOrig.length + ' regra(s) preservadas');
  L.push('- ✔ JS: sintaxe válida em todos os arquivos', '');
  L.push('## Como abrir', '');
  if (modo === 'html') L.push('Abra `dist/index.html`. Edite as peças em `src/` e rode `node build.cjs` para remontar.');
  else L.push('Módulos ES não abrem direto do arquivo. Rode `cd ' + destino + ' && node servir.cjs` e abra `http://localhost:5173`.');
  L.push('', 'Imagens e outros arquivos referenciados no HTML precisam ser copiados para a pasta de saída.');
  if (avisos.length) { L.push('', '## Avisos', ''); avisos.forEach(a => L.push('- ' + a)); }
  L.push('', '> Ordem do CSS e do JS: o CSS fica em `base` primeiro e depois nas peças; no JS as declarações ficam em `base` e os listeners de uma peça vão para o arquivo dela. Se algo depender da ordem original, confira.');
  const relatorio = L.join('\n');
  saidas.set('RELATORIO.md', relatorio + '\n');

  // 8) escrita
  if (existe && !ctx.simular) {
    ctx.backup(destino);
    for (const f of fs.readdirSync(destino)) if (f !== '.modularizado') fs.rmSync(path.join(destino, f), { recursive: true, force: true });
  }
  for (const [rel, c] of saidas) ctx.escrever(path.join(destino, rel), c);
  ctx.escrever(marca, 'gerado pela Fábrica de Ferramentas\n');
  if (modo === 'html' && !ctx.simular) {
    execFileSync(process.execPath, ['build.cjs'], { cwd: destino, stdio: 'pipe' });
    ctx.log('build.cjs executado → dist/');
  }
  ctx.log('Concluído: ' + saidas.size + ' arquivo(s).');
  return { markdown: relatorio };
}
