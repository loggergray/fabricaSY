import crypto from 'node:crypto';

const PADRAO = 'https://kyodevor.onrender.com/mcp';
const NL = String.fromCharCode(10);
const LIMITE = 50000;

function validar(bruto) {
  const txt = String(bruto || '').trim() || PADRAO;
  let u;
  try { u = new URL(txt); } catch (e) { throw new Error('URL inválida. Onde: campo url. Corrija: use https://servidor/mcp.'); }
  if (u.protocol !== 'https:') throw new Error('Só https é aceito. Onde: campo url. Corrija: comece com https://.');
  if (u.username || u.password || u.search || u.hash) throw new Error('A URL não pode ter usuário, senha, parâmetros nem token. Onde: campo url. Corrija: deixe só https://host/caminho.');
  return u;
}

function b64url(buf) { return Buffer.from(buf).toString('base64url'); }
function json(txt) { try { return JSON.parse(txt); } catch (e) { return null; } }
function trecho(txt) { return String(txt || '').slice(0, 200).split(NL).join(' '); }
function cortar(txt) {
  const s = String(txt);
  return s.length > LIMITE ? s.slice(0, LIMITE) + NL + NL + '(cortado em ' + LIMITE + ' caracteres)' : s;
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

async function abrir() {
  const uri = process.env.MONGODB_URI;
  if (typeof uri !== 'string' || !uri.trim()) throw new Error('MongoDB indisponível. Onde: variável MONGODB_URI. Corrija: configure no Render.');
  let client;
  try {
    const { MongoClient } = await import('mongodb');
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 6000, connectTimeoutMS: 5000, socketTimeoutMS: 8000 });
    await client.connect();
  } catch (e) {
    if (client) await client.close().catch(() => {});
    throw new Error('Falha ao conectar no MongoDB. Onde: coleção kyodevor_oauth. Corrija: confira MONGODB_URI e a rede.');
  }
  return { client, col: client.db(process.env.MONGODB_DB || 'synapse').collection('kyodevor_oauth') };
}

async function descobrir(u) {
  const m = await pedir(u.origin + '/.well-known/oauth-authorization-server', { method: 'GET', headers: { accept: 'application/json' } });
  const j = (m.erro || m.r.status !== 200) ? null : json(m.txt);
  if (!j) throw new Error('Não achei os endereços de login do KyDevor. Onde: /.well-known/oauth-authorization-server. Corrija: confira se o KyDevor está no ar.');
  for (const k of ['authorization_endpoint', 'token_endpoint', 'registration_endpoint']) {
    let e = null;
    try { e = new URL(j[k]); } catch (x) { e = null; }
    if (!e || e.origin !== u.origin) throw new Error('Endereço ' + k + ' inválido ou de outro servidor. Onde: metadados OAuth. Corrija: confira o KyDevor.');
  }
  return j;
}

function redirecionamento() {
  let base = String(process.env.RENDER_EXTERNAL_URL || 'https://syfabricasy.onrender.com');
  while (base.endsWith('/')) base = base.slice(0, -1);
  return base + '/oauth/kyodevor/callback';
}

function guardar(j, antigo) {
  const o = { access_token: j.access_token, atualizado_em: new Date().toISOString() };
  o.refresh_token = j.refresh_token || (antigo && antigo.refresh_token) || null;
  o.expira_em = j.expires_in ? Date.now() + Number(j.expires_in) * 1000 : null;
  o.scope = j.scope || (antigo && antigo.scope) || null;
  return o;
}

async function tokenValido(col, u) {
  const d = await col.findOne({ _id: 'conexao' });
  if (!d || !d.access_token) throw new Error('Não conectado. Onde: ponte KyDevor. Corrija: rode acao=iniciar e depois acao=concluir.');
  if (d.origem && d.origem !== u.origin) throw new Error('A URL não é a do login feito. Onde: campo url. Corrija: use ' + d.origem + '/mcp ou refaça o login.');
  if (!d.expira_em || Date.now() < d.expira_em - 30000) return d.access_token;
  if (!d.refresh_token) throw new Error('Token expirado e sem renovação. Onde: ponte KyDevor. Corrija: rode acao=iniciar de novo.');
  const meta = await descobrir(u);
  const corpo = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: d.refresh_token, client_id: d.client_id });
  const t = await pedir(meta.token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: corpo.toString() });
  const j = t.erro ? null : json(t.txt);
  if (!j || !j.access_token) throw new Error('Renovação recusada (HTTP ' + (t.r ? t.r.status : 'sem resposta') + '). Onde: token do KyDevor. Corrija: rode acao=iniciar de novo.');
  await col.updateOne({ _id: 'conexao' }, { $set: guardar(j, d) });
  return j.access_token;
}

function lerResposta(a, id) {
  const ct = a.r.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) {
    let achado = null;
    for (const linha of a.txt.split(NL)) {
      if (linha.startsWith('data:')) {
        const j = json(linha.slice(5).trim());
        if (j && j.id === id) achado = j;
      }
    }
    return achado;
  }
  return json(a.txt);
}

async function mcp(u, token, metodo, params) {
  const base = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: 'Bearer ' + token };
  const ini = await pedir(u.href, { method: 'POST', headers: base, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'synapse-ponte', version: '0.1.0' } } }) });
  if (ini.erro) throw new Error('KyDevor sem resposta (' + ini.erro + '). Onde: initialize. Corrija: o Render pode estar acordando; repita em 1 minuto.');
  if (ini.r.status === 401) throw new Error('KyDevor recusou o token (401). Onde: initialize. Corrija: rode acao=iniciar de novo.');
  if (ini.r.status >= 400) throw new Error('KyDevor respondeu HTTP ' + ini.r.status + ' no initialize. Onde: initialize. Corrija: veja os logs do KyDevor.');
  const info = lerResposta(ini, 1);
  if (metodo === 'initialize') return info;
  const h = Object.assign({}, base);
  const sessao = ini.r.headers.get('mcp-session-id');
  if (sessao) h['mcp-session-id'] = sessao;
  h['mcp-protocol-version'] = '2025-03-26';
  await pedir(u.href, { method: 'POST', headers: h, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
  const res = await pedir(u.href, { method: 'POST', headers: h, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: metodo, params: params || {} }) });
  if (res.erro) throw new Error('KyDevor sem resposta (' + res.erro + '). Onde: ' + metodo + '. Corrija: repita em 1 minuto.');
  if (res.r.status >= 400) throw new Error('KyDevor respondeu HTTP ' + res.r.status + ' em ' + metodo + '. Onde: ' + metodo + '. Corrija: veja os logs do KyDevor.');
  const out = lerResposta(res, 2);
  if (!out) throw new Error('Resposta ilegível do KyDevor. Onde: ' + metodo + '. Corrija: repita; se persistir, veja os logs do KyDevor.');
  return out;
}

async function iniciar(col, u) {
  const meta = await descobrir(u);
  const redir = redirecionamento();
  const reg = await pedir(meta.registration_endpoint, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ client_name: 'Synapse (syfabricasy)', redirect_uris: [redir], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none', scope: 'claude-conect' }) });
  const rj = reg.erro ? null : json(reg.txt);
  if (!rj || !rj.client_id) throw new Error('Registro recusado (HTTP ' + (reg.r ? reg.r.status : 'sem resposta') + '). Onde: ' + new URL(meta.registration_endpoint).pathname + '. Corrija: o KyDevor pode exigir outro endereço de retorno. Resposta: ' + trecho(reg.txt));
  const verificador = b64url(crypto.randomBytes(32));
  const desafio = b64url(crypto.createHash('sha256').update(verificador).digest());
  const estado = b64url(crypto.randomBytes(16));
  await col.updateOne({ _id: 'conexao' }, { $set: { pendente: { client_id: rj.client_id, redirect_uri: redir, verifier: verificador, state: estado, criado_em: new Date().toISOString() } } }, { upsert: true });
  const a = new URL(meta.authorization_endpoint);
  a.searchParams.set('response_type', 'code');
  a.searchParams.set('client_id', rj.client_id);
  a.searchParams.set('redirect_uri', redir);
  a.searchParams.set('scope', 'claude-conect');
  a.searchParams.set('state', estado);
  a.searchParams.set('code_challenge', desafio);
  a.searchParams.set('code_challenge_method', 'S256');
  a.searchParams.set('resource', u.href);
  return ['# Ponte KyDevor · login iniciado', '', 'Cliente registrado no KyDevor. Abra este link, digite a senha do MCP na tela do KyDevor e aprove:', '', a.href, '', 'Depois do login o navegador vai para uma página do syfabricasy que pode mostrar erro 404. É esperado. Copie o endereço completo da barra do navegador (tem code= e state=) e cole no campo retorno com acao=concluir.', '', 'O código do endereço vale uma vez e só funciona com o segredo guardado aqui. A senha nunca passa pelo Synapse.'].join(NL);
}

async function concluir(col, u, entradas) {
  const bruto = String(entradas.retorno || '').trim();
  if (!bruto) throw new Error('Cole o endereço completo da página aberta depois do login. Onde: campo retorno. Corrija: copie da barra do navegador.');
  let q;
  try { q = bruto.includes('://') ? new URL(bruto).searchParams : new URLSearchParams(bruto.startsWith('?') ? bruto.slice(1) : bruto); } catch (e) { throw new Error('Retorno ilegível. Onde: campo retorno. Corrija: cole o endereço completo.'); }
  const erro = q.get('error');
  if (erro) throw new Error('O KyDevor recusou o login (' + erro + '). Onde: tela de login. Corrija: rode acao=iniciar de novo.');
  const code = q.get('code');
  const estado = q.get('state');
  const d = await col.findOne({ _id: 'conexao' });
  const p = d && d.pendente;
  if (!p) throw new Error('Nenhum login pendente. Onde: ponte KyDevor. Corrija: rode acao=iniciar.');
  if (!code || estado !== p.state) throw new Error('Código ou state não conferem. Onde: campo retorno. Corrija: rode acao=iniciar de novo e use o retorno novo.');
  const meta = await descobrir(u);
  const corpo = new URLSearchParams({ grant_type: 'authorization_code', code: code, redirect_uri: p.redirect_uri, client_id: p.client_id, code_verifier: p.verifier, resource: u.href });
  const t = await pedir(meta.token_endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: corpo.toString() });
  const j = t.erro ? null : json(t.txt);
  if (!j || !j.access_token) throw new Error('Troca do código recusada (HTTP ' + (t.r ? t.r.status : 'sem resposta') + '). Onde: token do KyDevor. Corrija: rode acao=iniciar de novo; o código vale uma vez.');
  const set = Object.assign({ client_id: p.client_id, origem: u.origin, conectado_em: new Date().toISOString() }, guardar(j, null));
  await col.updateOne({ _id: 'conexao' }, { $set: set, $unset: { pendente: '' } });
  return ['# Ponte KyDevor · conectado', '', 'Escopo: ' + (set.scope || 'não informado'), 'Renovação automática: ' + (set.refresh_token ? 'sim' : 'não'), set.expira_em ? 'Token atual vale por ' + Math.max(0, Math.round((set.expira_em - Date.now()) / 60000)) + ' min.' : 'Validade do token: não informada.', '', 'O token ficou só no MongoDB e não é exibido. Use acao=listar e acao=chamar.'].join(NL);
}

async function status(col, u) {
  const d = await col.findOne({ _id: 'conexao' });
  const L = ['# Ponte KyDevor · status', ''];
  if (!d || !d.access_token) {
    L.push('Conectado: não.', (d && d.pendente) ? 'Há um login pendente: cole o retorno com acao=concluir.' : 'Rode acao=iniciar para abrir o login do KyDevor.');
    return L.join(NL);
  }
  L.push('Conectado: sim (origem ' + (d.origem || 'não registrada') + ').', 'Escopo: ' + (d.scope || 'não informado'), 'Renovação automática: ' + (d.refresh_token ? 'sim' : 'não'), d.expira_em ? 'Token atual vale por mais ' + Math.max(0, Math.round((d.expira_em - Date.now()) / 60000)) + ' min.' : 'Validade do token: não informada.');
  try {
    const token = await tokenValido(col, u);
    const info = await mcp(u, token, 'initialize');
    const si = info && info.result && info.result.serverInfo;
    L.push('', 'Teste ao vivo: o KyDevor aceitou o token' + ((si && si.name) ? ' (servidor ' + si.name + (si.version ? ' ' + si.version : '') + ').' : '.'));
  } catch (e) {
    L.push('', 'Teste ao vivo falhou: ' + e.message);
  }
  return L.join(NL);
}

async function listar(col, u, entradas) {
  const token = await tokenValido(col, u);
  const r = await mcp(u, token, 'tools/list');
  if (r.error) throw new Error('KyDevor devolveu erro em tools/list: ' + trecho(JSON.stringify(r.error)) + '. Onde: tools/list. Corrija: veja os logs do KyDevor.');
  const ts = (r.result && r.result.tools) || [];
  const alvo = String((entradas && entradas.ferramenta) || '').trim();
  if (alvo) {
    const t = ts.find(x => x.name === alvo);
    if (!t) throw new Error('Ferramenta ' + alvo + ' não existe no KyDevor. Onde: campo ferramenta. Corrija: use acao=listar sem ferramenta.');
    return cortar('# Esquema de ' + alvo + NL + NL + String(t.description || '') + NL + NL + JSON.stringify(t.inputSchema));
  }
  const L = ['# Ferramentas do KyDevor (' + ts.length + ')', ''];
  for (const t of ts) L.push('- ' + t.name + ': ' + String(t.description || '').slice(0, 110).split(NL).join(' '));
  if (r.result && r.result.nextCursor) L.push('', 'Há mais ferramentas; esta versão não lê a paginação.');
  return cortar(L.join(NL));
}

async function chamar(col, u, entradas) {
  const nome = String(entradas.ferramenta || '').trim();
  if (!nome) throw new Error('Informe a ferramenta do KyDevor. Onde: campo ferramenta. Corrija: use acao=listar para ver os nomes.');
  let args = {};
  const bruto = String(entradas.argumentos || '').trim();
  if (bruto) {
    args = json(bruto);
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Argumentos precisam ser um objeto JSON. Onde: campo argumentos. Corrija: envie JSON válido de objeto.');
  }
  const token = await tokenValido(col, u);
  const r = await mcp(u, token, 'tools/call', { name: nome, arguments: args });
  if (r.error) throw new Error('KyDevor devolveu erro em ' + nome + ': ' + trecho(JSON.stringify(r.error)) + '. Onde: tools/call. Corrija: confira o nome e os argumentos.');
  const c = (r.result && r.result.content) || [];
  const partes = c.map(x => (x && x.type === 'text') ? x.text : '[conteúdo ' + (x && x.type) + ' omitido]');
  const L = ['# KyDevor · ' + nome, '', (r.result && r.result.isError) ? 'O KyDevor marcou esta resposta como erro.' : 'Resposta:', '', partes.join(NL + NL)];
  return entradas.sem_corte ? L.join(NL) : cortar(L.join(NL));
}

async function sair(col) {
  await col.updateOne({ _id: 'conexao' }, { $unset: { access_token: '', refresh_token: '', expira_em: '', pendente: '', origem: '', client_id: '', scope: '' } });
  return '# Ponte KyDevor · desconectado' + NL + NL + 'Token apagado do MongoDB do Synapse. Isso não revoga o acesso dentro do KyDevor.';
}

export async function run(entradas, ctx) {
  const acao = String(entradas.acao || 'status');
  const lista = ['status', 'iniciar', 'concluir', 'listar', 'chamar', 'sair'];
  if (!lista.includes(acao)) throw new Error('Ação inválida. Onde: campo acao. Corrija: use ' + lista.join(', ') + '.');
  const u = validar(entradas.url);
  if (ctx.simular) return ['# Simulação', '', 'Ação ' + acao + ' em ' + u.host + '. Não usaria rede nem MongoDB agora e não leria senha nem token.'].join(NL);
  const { client, col } = await abrir();
  try {
    if (acao === 'iniciar') return await iniciar(col, u);
    if (acao === 'concluir') return await concluir(col, u, entradas);
    if (acao === 'sair') return await sair(col);
    if (acao === 'status') return await status(col, u);
    if (acao === 'listar') return await listar(col, u, entradas);
    return await chamar(col, u, entradas);
  } finally {
    await client.close().catch(() => {});
  }
}
