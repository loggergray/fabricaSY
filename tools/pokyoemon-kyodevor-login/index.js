const NL = String.fromCharCode(10);
const DQ = String.fromCharCode(34);
const SQ = String.fromCharCode(39);
const ORIGEM = 'https://kyodevor.onrender.com';

function trecho(txt) { return String(txt || '').slice(0, 200).split(NL).join(' '); }

function dec(s) {
  return String(s).split('&amp;').join('&').split('&quot;').join(DQ).split('&#39;').join(SQ).split('&lt;').join('<').split('&gt;').join('>');
}

function link(bruto) {
  let u;
  try { u = new URL(String(bruto || '').trim()); } catch (e) { throw new Error('Link inválido. Onde: campo link. Corrija: cole o link de login gerado pela Ponte KyDevor.'); }
  if (u.origin !== ORIGEM || u.pathname !== '/oauth/authorize') throw new Error('Só aceito o link de login do KyDevor (' + ORIGEM + '/oauth/authorize). Onde: campo link. Corrija: gere de novo com a Ponte KyDevor, acao=iniciar.');
  return u;
}

function attr(tag, nome) {
  const baixo = tag.toLowerCase();
  for (const q of [DQ, SQ]) {
    const k = baixo.indexOf(' ' + nome + '=' + q);
    if (k >= 0) {
      const ini = k + nome.length + 3;
      const fim = tag.indexOf(q, ini);
      if (fim >= ini) return dec(tag.slice(ini, fim));
    }
  }
  return null;
}

function tags(html, nome) {
  const out = [];
  const baixo = html.toLowerCase();
  let i = 0;
  for (;;) {
    const k = baixo.indexOf('<' + nome, i);
    if (k < 0) break;
    const f = html.indexOf('>', k);
    if (f < 0) break;
    out.push(html.slice(k, f + 1));
    i = f + 1;
  }
  return out;
}

function formulario(html) {
  const baixo = html.toLowerCase();
  const k = baixo.indexOf('<form');
  if (k < 0) return null;
  const fimTag = html.indexOf('>', k);
  if (fimTag < 0) return null;
  const fim = baixo.indexOf('</form', fimTag);
  const tag = html.slice(k, fimTag + 1);
  const corpo = html.slice(fimTag + 1, fim < 0 ? html.length : fim);
  const campos = tags(corpo, 'input').map(t => ({ nome: attr(t, 'name'), tipo: (attr(t, 'type') || 'text').toLowerCase(), valor: attr(t, 'value') || '' }));
  return { action: attr(tag, 'action') || '', metodo: (attr(tag, 'method') || 'get').toLowerCase(), campos: campos };
}

function cookies(r) {
  let lista = [];
  if (typeof r.headers.getSetCookie === 'function') lista = r.headers.getSetCookie();
  else { const c = r.headers.get('set-cookie'); if (c) lista = [c]; }
  return lista.map(c => c.split(';')[0]).join('; ');
}

async function pedir(url, opcoes) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 30000);
  try {
    const r = await fetch(url, Object.assign({ redirect: 'manual', signal: ac.signal }, opcoes));
    const txt = await r.text();
    return { r, txt };
  } catch (e) {
    return { erro: (e && e.name) ? e.name : 'erro' };
  } finally {
    clearTimeout(t);
  }
}

export async function run(entradas, ctx) {
  const acao = String(entradas.acao || 'inspecionar');
  if (acao !== 'inspecionar' && acao !== 'entrar') throw new Error('Ação inválida. Onde: campo acao. Corrija: use inspecionar ou entrar.');
  if (ctx.simular) return ['# Simulação', '', 'Ação ' + acao + '. Nenhuma rede seria usada e nenhuma senha seria lida.'].join(NL);
  const u = link(entradas.link);
  const g = await pedir(u.href, { method: 'GET', headers: { accept: 'text/html' } });
  if (g.erro) throw new Error('KyDevor sem resposta (' + g.erro + '). Onde: página de login. Corrija: o Render pode estar acordando; repita em 1 minuto.');
  if (g.r.status !== 200) throw new Error('A página de login respondeu HTTP ' + g.r.status + '. Onde: ' + u.pathname + '. Corrija: gere um link novo com a Ponte KyDevor, acao=iniciar. Resposta: ' + trecho(g.txt));
  const f = formulario(g.txt);

  if (acao === 'inspecionar') {
    const L = ['# Login do KyDevor · inspeção', '', '- status: ' + g.r.status, '- content-type: ' + (g.r.headers.get('content-type') || 'nenhum')];
    if (!f) {
      L.push('- formulário: nenhum encontrado', '- trecho: ' + trecho(g.txt));
      return L.join(NL);
    }
    let caminho = '(inválido)';
    try { caminho = new URL(f.action || u.href, u.href).pathname; } catch (e) { caminho = '(inválido)'; }
    L.push('- formulário: método ' + f.metodo + ', destino ' + caminho);
    for (const c of f.campos) L.push('  - campo ' + (c.nome || '(sem nome)') + ' (' + c.tipo + (c.tipo === 'hidden' ? ', valor oculto' : '') + ')');
    L.push('', 'Valores dos campos ocultos não são exibidos. Nenhuma senha foi enviada.');
    return L.join(NL);
  }

  const senha = String(entradas.senha || '');
  if (!senha) throw new Error('Informe a senha. Onde: campo senha. Corrija: preencha só para a ação entrar.');
  if (!f || f.metodo !== 'post') throw new Error('Não achei o formulário de login por POST. Onde: página do KyDevor. Corrija: rode acao=inspecionar e veja a estrutura.');
  let destino;
  try { destino = new URL(f.action || u.href, u.href); } catch (e) { throw new Error('Destino do formulário inválido. Onde: página do KyDevor. Corrija: rode acao=inspecionar.'); }
  if (destino.origin !== ORIGEM) throw new Error('O formulário aponta para outro servidor; a senha não foi enviada. Onde: página do KyDevor. Corrija: confira o KyDevor.');
  const corpo = new URLSearchParams();
  let temSenha = false;
  for (const c of f.campos) {
    if (!c.nome) continue;
    if (c.tipo === 'password') { corpo.set(c.nome, senha); temSenha = true; }
    else if (c.tipo === 'text' || c.tipo === 'email') {
      if (!entradas.usuario) throw new Error('O formulário pede usuário. Onde: campo usuario. Corrija: preencha o usuário do KyDevor.');
      corpo.set(c.nome, String(entradas.usuario).trim());
    }
    else if (c.tipo === 'hidden') corpo.set(c.nome, c.valor);
  }
  if (!temSenha) throw new Error('O formulário não tem campo de senha. Onde: página do KyDevor. Corrija: rode acao=inspecionar.');
  let ck = cookies(g.r);
  const cab = { 'content-type': 'application/x-www-form-urlencoded', accept: 'text/html' };
  if (ck) cab.cookie = ck;
  const p = await pedir(destino.href, { method: 'POST', headers: cab, body: corpo.toString() });
  if (p.erro) throw new Error('KyDevor sem resposta (' + p.erro + ') ao enviar o login. Onde: formulário. Corrija: repita em 1 minuto.');
  const loc = p.r.headers.get('location');
  if (!loc || p.r.status < 300 || p.r.status > 399) throw new Error('Login não aceito (HTTP ' + p.r.status + '). Onde: formulário do KyDevor. Corrija: confira a senha ou rode acao=inspecionar. Resposta: ' + trecho(p.txt).split(senha).join('***'));
  ck = [ck, cookies(p.r)].filter(Boolean).join('; ');
  let atual = new URL(loc, destino.href);
  for (let i = 0; i < 4 && atual.origin === ORIGEM; i++) {
    const cab2 = { accept: 'text/html' };
    if (ck) cab2.cookie = ck;
    const s = await pedir(atual.href, { method: 'GET', headers: cab2 });
    if (s.erro) throw new Error('KyDevor sem resposta (' + s.erro + ') depois do login. Onde: ' + atual.pathname + '. Corrija: repita em 1 minuto.');
    const l2 = s.r.headers.get('location');
    if (!l2 || s.r.status < 300 || s.r.status > 399) throw new Error('O KyDevor pediu outro passo no login (HTTP ' + s.r.status + '). Onde: ' + atual.pathname + '. Corrija: rode acao=inspecionar e me mostre.');
    ck = [ck, cookies(s.r)].filter(Boolean).join('; ');
    atual = new URL(l2, atual.href);
  }
  if (atual.origin === ORIGEM) throw new Error('O login ficou em loop no KyDevor. Onde: redirecionamentos. Corrija: gere um link novo com a Ponte KyDevor.');
  const ponte = await import('../pokyoemon-kyodevor-ponte/index.js');
  return await ponte.run({ acao: 'concluir', url: '', retorno: atual.href }, ctx);
}
