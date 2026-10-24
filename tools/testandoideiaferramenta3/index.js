import { parse } from 'parse5';

const attr = (n, k) => (n.attrs || []).find(a => a.name === k)?.value;
const tem = (n, k) => (n.attrs || []).some(a => a.name === k);
const ehEl = n => !!n.tagName;

function walk(n, fn, pais = []) {
  for (const f of n.childNodes || []) {
    if (!ehEl(f)) continue;
    fn(f, pais);
    walk(f, fn, [...pais, f]);
  }
}

function texto(n) {
  let t = '';
  (function v(x) {
    for (const c of x.childNodes || []) {
      if (c.nodeName === '#text') t += c.value;
      else if (ehEl(c)) {
        if (c.tagName === 'img' && attr(c, 'alt')) t += ' ' + attr(c, 'alt');
        if (c.tagName === 'title') t += ' ' + texto(c);
        if (attr(c, 'aria-label')) t += ' ' + attr(c, 'aria-label');
        v(c);
      }
    }
  })(n);
  return t.replace(/\s+/g, ' ').trim();
}

function estilo(n) {
  const o = {};
  for (const par of (attr(n, 'style') || '').split(';')) {
    const i = par.indexOf(':');
    if (i > 0) o[par.slice(0, i).trim().toLowerCase()] = par.slice(i + 1).trim().toLowerCase();
  }
  return o;
}

const px = v => { const m = String(v || '').match(/^([\d.]+)px$/); return m ? parseFloat(m[1]) : null; };

const NOMES = { white: [255, 255, 255], black: [0, 0, 0], red: [255, 0, 0], gray: [128, 128, 128], grey: [128, 128, 128],
  yellow: [255, 255, 0], silver: [192, 192, 192], lightgray: [211, 211, 211], lightgrey: [211, 211, 211] };

function cor(s) {
  s = String(s || '').trim().toLowerCase();
  if (NOMES[s]) return NOMES[s];
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return [...m[1]].map(c => parseInt(c + c, 16));
  m = s.match(/^#([0-9a-f]{6})$/);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  m = s.match(/^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  return null;
}

function lum([r, g, b]) {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contraste = (a, b) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

export async function run(e, ctx) {
  let html;
  if (e.origem && e.origem.trim()) html = ctx.ler(e.origem);
  else if (e.html_colado && e.html_colado.trim()) html = e.html_colado;
  else throw new Error('Informe o caminho do HTML ou cole o conteúdo.');

  const alvo = Number(e.alvo_toque) || 44;
  ctx.log('Analisando ' + html.length + ' caracteres…');
  const doc = parse(html, { sourceCodeLocationInfo: true });
  const raiz = doc.childNodes.find(n => n.tagName === 'html');
  const problemas = [];

  const trecho = n => {
    const loc = n.sourceCodeLocation?.startTag || n.sourceCodeLocation;
    if (!loc) return '<' + n.tagName + '>';
    return html.slice(loc.startOffset, Math.min(loc.endOffset, loc.startOffset + 110)).replace(/\s+/g, ' ').replace(/`/g, "'");
  };
  const add = (sev, regra, n, sugestao) =>
    problemas.push({ sev, regra, linha: n?.sourceCodeLocation?.startLine || null, trecho: n ? trecho(n) : '', sugestao });

  // --- documento ---
  const head = raiz.childNodes.find(n => n.tagName === 'head');
  let viewport = null, titulo = null;
  walk(raiz, n => {
    if (n.tagName === 'meta' && attr(n, 'name')?.toLowerCase() === 'viewport') viewport = n;
    if (n.tagName === 'title') titulo = n;
  });
  if (!viewport) add('erro', 'Sem meta viewport', head, 'Adicione <meta name="viewport" content="width=device-width, initial-scale=1"> no <head>. Sem isso o celular mostra a página "encolhida".');
  else {
    const c = (attr(viewport, 'content') || '').toLowerCase().replace(/\s/g, '');
    if (/user-scalable=(no|0)/.test(c)) add('erro', 'Zoom bloqueado', viewport, 'Remova user-scalable=no. Quem enxerga mal precisa dar zoom.');
    const mx = c.match(/maximum-scale=([\d.]+)/);
    if (mx && parseFloat(mx[1]) < 2) add('erro', 'Zoom limitado (maximum-scale)', viewport, 'Remova maximum-scale ou use 5 ou mais.');
  }
  if (!tem(raiz, 'lang') || !attr(raiz, 'lang').trim()) add('erro', 'Sem idioma na página', raiz, 'Use <html lang="pt-BR">. Leitores de tela usam isso para a pronúncia.');
  if (!titulo || !texto(titulo)) add('erro', 'Sem <title>', head, 'Adicione um <title> descritivo. É a primeira coisa que o leitor de tela anuncia.');

  // --- elementos ---
  const labelsFor = new Set();
  const ids = new Map();
  walk(raiz, n => {
    if (n.tagName === 'label' && attr(n, 'for')) labelsFor.add(attr(n, 'for'));
    const id = attr(n, 'id');
    if (id) ids.set(id, (ids.get(id) || []).concat(n));
  });
  for (const [id, lista] of ids)
    if (lista.length > 1) add('aviso', 'id duplicado "' + id + '"', lista[1], 'ids devem ser únicos. Rótulos (label for) e ARIA se confundem com repetidos.');

  let ultimoNivel = 0, h1 = 0, temMain = false;
  walk(raiz, (n, pais) => {
    const t = n.tagName;
    const st = estilo(n);
    const emSvg = pais.some(p => p.tagName === 'svg');

    if (t === 'main' || attr(n, 'role') === 'main') temMain = true;

    if (t === 'img' && !tem(n, 'alt'))
      add('erro', 'Imagem sem alt', n, 'Adicione alt="descrição". Se for só decoração, alt="" (vazio).');

    if ((t === 'input' || t === 'select' || t === 'textarea')) {
      const tipo = (attr(n, 'type') || 'text').toLowerCase();
      if (!['hidden', 'submit', 'button', 'reset', 'image'].includes(tipo)) {
        const rotulado = tem(n, 'aria-label') || tem(n, 'aria-labelledby') || tem(n, 'title') ||
          (attr(n, 'id') && labelsFor.has(attr(n, 'id'))) || pais.some(p => p.tagName === 'label');
        if (!rotulado) add('erro', 'Campo sem rótulo', n, 'Use <label for="id"> ligado ao campo. placeholder não substitui rótulo.');
        if (t === 'input' && ['text', ''].includes(tipo)) {
          const nome = ((attr(n, 'name') || '') + ' ' + (attr(n, 'id') || '')).toLowerCase();
          if (/mail/.test(nome)) add('aviso', 'E-mail sem type="email"', n, 'Use type="email" para abrir o teclado certo no celular.');
          else if (/(tel|fone|phone|celular)/.test(nome)) add('aviso', 'Telefone sem type="tel"', n, 'Use type="tel" para abrir o teclado numérico.');
        }
      }
    }

    if (t === 'button' || (t === 'a' && tem(n, 'href')) || attr(n, 'role') === 'button') {
      const nome = tem(n, 'aria-label') || tem(n, 'aria-labelledby') || tem(n, 'title') || texto(n);
      if (!nome) add('erro', (t === 'a' ? 'Link' : 'Botão') + ' sem texto acessível', n, 'Coloque texto visível ou aria-label="o que faz" (comum em botões só com ícone).');
      else if (t === 'a' && /^(clique aqui|aqui|saiba mais|leia mais|click here|here|more)$/i.test(texto(n)))
        add('aviso', 'Texto de link genérico', n, 'Troque "' + texto(n) + '" por algo que faça sentido sozinho, como "Ver planos de preço".');
    }

    if (t === 'a' && attr(n, 'target') === '_blank' && !/noopener/.test(attr(n, 'rel') || ''))
      add('aviso', 'target="_blank" sem rel', n, 'Adicione rel="noopener noreferrer".');

    if (/^h[1-6]$/.test(t)) {
      const nivel = +t[1];
      if (nivel === 1) h1++;
      if (ultimoNivel && nivel > ultimoNivel + 1) add('aviso', 'Salto de título (h' + ultimoNivel + ' → h' + nivel + ')', n, 'Não pule níveis. Leitores de tela navegam pela hierarquia.');
      ultimoNivel = nivel;
      if (!texto(n)) add('aviso', 'Título vazio', n, 'Remova ou preencha o título.');
    }

    if (t === 'iframe' && !tem(n, 'title')) add('erro', 'iframe sem title', n, 'Adicione title="o que é este conteúdo".');
    if (t === 'video' && !tem(n, 'controls') && !tem(n, 'autoplay')) add('aviso', 'Vídeo sem controles', n, 'Adicione controls.');
    if (t === 'video' && tem(n, 'autoplay') && !tem(n, 'muted')) add('aviso', 'Vídeo com autoplay e som', n, 'Autoplay com som atrapalha. Use muted ou remova.');

    const ti = attr(n, 'tabindex');
    if (ti && parseInt(ti, 10) > 0) add('aviso', 'tabindex positivo', n, 'Use tabindex="0" ou "-1". Valores positivos quebram a ordem de navegação.');

    if (tem(n, 'onclick') && !['button', 'a', 'input', 'select', 'summary'].includes(t) && !tem(n, 'role'))
      add('erro', 'Clique em elemento não interativo', n, 'Use <button> no lugar, ou adicione role="button" tabindex="0" e tratamento de teclado.');

    // --- tamanhos inline ---
    if (!emSvg && ['button', 'a', 'input', 'select'].includes(t) && !['hidden'].includes(attr(n, 'type'))) {
      const w = px(st.width), h = px(st.height);
      if ((w !== null && w < alvo) || (h !== null && h < alvo))
        add('aviso', 'Alvo de toque pequeno (' + (w ?? '?') + '×' + (h ?? '?') + 'px)', n, 'Use pelo menos ' + alvo + '×' + alvo + 'px (ou padding para chegar lá) e espaço entre alvos vizinhos.');
    }
    const fs = px(st['font-size']);
    if (fs !== null && fs < 12) add('aviso', 'Fonte muito pequena (' + fs + 'px)', n, 'Prefira 16px no corpo do texto. Abaixo de 12px é difícil de ler no celular.');
    if (t === 'input' && fs !== null && fs < 16) add('aviso', 'Fonte menor que 16px em campo', n, 'No iPhone, campos com menos de 16px dão zoom automático ao focar.');

    // --- contraste inline ---
    const fg = cor(st.color), bg = cor(st['background-color'] || (/^[^\s]+$/.test(st.background || '') ? st.background : ''));
    if (fg && bg) {
      const r = contraste(fg, bg);
      if (r < 4.5) add('erro', 'Contraste baixo (' + r.toFixed(2) + ':1)', n, 'O mínimo recomendado é 4.5:1 para texto normal (3:1 para texto grande).');
    }
  });

  if (h1 === 0) add('aviso', 'Sem título principal (h1)', null, 'Inclua um <h1> descrevendo a página.');
  if (h1 > 1) add('aviso', 'Mais de um h1 (' + h1 + ')', null, 'Prefira um único <h1> por página.');
  if (!temMain) add('aviso', 'Sem região <main>', null, 'Envolva o conteúdo principal em <main> para pular direto a ele.');

  // --- relatório ---
  const erros = problemas.filter(p => p.sev === 'erro');
  const avisos = problemas.filter(p => p.sev === 'aviso');
  const nota = Math.max(0, 100 - erros.length * 8 - avisos.length * 3);

  const L = ['# Auditoria de acessibilidade mobile', ''];
  L.push('**Nota:** ' + nota + '/100 · **Erros:** ' + erros.length + ' · **Avisos:** ' + avisos.length, '');
  if (!problemas.length) L.push('Nenhum problema encontrado nas verificações automáticas. 🎉');

  const secao = (titulo, lista) => {
    if (!lista.length) return;
    L.push('## ' + titulo + ' (' + lista.length + ')', '');
    const porRegra = new Map();
    for (const p of lista) {
      const k = p.regra.replace(/\s*\(.*\)$/, '').replace(/\s*"[^"]*"$/, '');
      if (!porRegra.has(k)) porRegra.set(k, []);
      porRegra.get(k).push(p);
    }
    for (const [regra, itens] of porRegra) {
      L.push('### ' + regra + ' ×' + itens.length, '');
      L.push('**Como corrigir:** ' + itens[0].sugestao, '');
      for (const p of itens.slice(0, 8))
        L.push('- ' + (p.linha ? 'linha ' + p.linha + ': ' : '') + (p.trecho ? '`' + p.trecho + '`' : p.regra));
      if (itens.length > 8) L.push('- …e mais ' + (itens.length - 8));
      L.push('');
    }
  };
  secao('Erros', erros);
  secao('Avisos', avisos);

  L.push('---', '');
  L.push('> **Limites:** a análise é automática e cobre o HTML e os estilos escritos inline. Tamanhos e cores definidos em CSS externo ou em `<style>` não são medidos. Teste também com o TalkBack ligado e com zoom de 200%.');

  const md = L.join('\n');
  if (e.salvar_em && e.salvar_em.trim()) {
    const abs = ctx.escrever(e.salvar_em.trim(), md + '\n');
    ctx.log('Relatório ' + (ctx.simular ? '(simulado) ' : 'salvo em ') + abs);
  }
  ctx.log('Concluído: ' + erros.length + ' erro(s), ' + avisos.length + ' aviso(s).');
  return { markdown: md };
}
