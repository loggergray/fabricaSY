const NL = String.fromCharCode(10);
const BASE = 'https://kyodevor.onrender.com';

function cookies(r) {
  let lista = [];
  if (typeof r.headers.getSetCookie === 'function') lista = r.headers.getSetCookie();
  else { const c = r.headers.get('set-cookie'); if (c) lista = [c]; }
  return lista.map((c) => c.split(';')[0]).join('; ');
}

async function pedir(url, opcoes) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 30000);
  try {
    const r = await fetch(url, Object.assign({ redirect: 'manual', signal: ac.signal }, opcoes));
    const txt = await r.text();
    let j = null;
    try { j = JSON.parse(txt); } catch (e) { j = null; }
    return { r, txt, j };
  } catch (e) {
    return { erro: (e && e.name) ? e.name : 'erro' };
  } finally {
    clearTimeout(t);
  }
}

export async function run(entradas, ctx) {
  if (ctx.simular) return ['# Simulação', '', 'Faria login no KyDevor, criaria e apagaria um doc de teste. Nada foi enviado.'].join(NL);
  const usuario = String(entradas.usuario || '').trim();
  const senha = String(entradas.senha || '');
  const livro = String(entradas.livro || 'pokemon').trim();
  if (!usuario || !senha) throw new Error('Informe usuario e senha. Onde: campos usuario e senha. Corrija: preencha os dois.');
  const L = ['# Teste de criação de doc como pessoa (mesmo caminho da tela)', ''];
  const lg = await pedir(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: usuario, password: senha }) });
  if (lg.erro) throw new Error('KyDevor sem resposta (' + lg.erro + ') no login. Onde: /api/login. Corrija: repita em 1 minuto.');
  L.push('- login: HTTP ' + lg.r.status + (lg.j && lg.j.error ? ' (' + lg.j.error + ')' : ''));
  if (lg.r.status !== 200) return L.join(NL);
  const ck = cookies(lg.r);
  L.push('- cookie de sessão recebido: ' + (ck ? 'sim' : 'não'));
  const h = { 'content-type': 'application/json', cookie: ck };
  const cr = await pedir(BASE + '/api/docs', { method: 'POST', headers: h, body: JSON.stringify({ title: 'Teste UI (pode apagar)', book: livro, content: 'teste', tags: ['teste'] }) });
  if (cr.erro) throw new Error('KyDevor sem resposta (' + cr.erro + ') ao criar doc. Onde: /api/docs.');
  L.push('- criar doc: HTTP ' + cr.r.status + (cr.j && cr.j.error ? ' (' + cr.j.error + ')' : ''));
  const id = cr.j && cr.j.doc && cr.j.doc.id;
  if (id) {
    L.push('- livro gravado: ' + (cr.j.doc.book || 'nenhum'));
    const db = await pedir(BASE + '/api/db', { method: 'GET', headers: { cookie: ck } });
    const docs = (db.j && db.j.docs) || [];
    const achou = docs.find((d) => d.id === id);
    L.push('- aparece em /api/db: ' + (achou ? 'sim (livro ' + (achou.book || 'nenhum') + ')' : 'não') + '; total de docs: ' + docs.length);
    const ap = await pedir(BASE + '/api/docs/' + id, { method: 'DELETE', headers: h });
    L.push('- apagar o teste: HTTP ' + (ap.r ? ap.r.status : 'sem resposta'));
  }
  return L.join(NL);
}
