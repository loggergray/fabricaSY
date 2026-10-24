const PADRAO = 'https://kyodevor.onrender.com/mcp';
const NL = String.fromCharCode(10);

function validar(bruto) {
  const txt = String(bruto || '').trim() || PADRAO;
  let u;
  try { u = new URL(txt); } catch (e) { throw new Error('URL inválida. Onde: campo url. Corrija: use https://servidor/mcp.'); }
  if (u.protocol !== 'https:') throw new Error('Só https é aceito. Onde: campo url. Corrija: comece com https://.');
  if (u.username || u.password || u.search || u.hash) throw new Error('A URL não pode ter usuário, senha, parâmetros nem token. Onde: campo url. Corrija: deixe só https://host/caminho.');
  return u;
}

async function pedir(url, opcoes) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 25000);
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

function trecho(txt) {
  return String(txt || '').slice(0, 300).split(NL).join(' ');
}

function chaves(txt) {
  try {
    const j = JSON.parse(txt);
    const out = [];
    const lista = ['issuer', 'authorization_endpoint', 'token_endpoint', 'registration_endpoint', 'resource', 'authorization_servers', 'grant_types_supported', 'token_endpoint_auth_methods_supported', 'scopes_supported', 'code_challenge_methods_supported'];
    for (const k of lista) if (j[k] !== undefined) out.push('- ' + k + ': ' + JSON.stringify(j[k]));
    return out;
  } catch (e) {
    return null;
  }
}

export async function run(entradas, ctx) {
  const u = validar(entradas.url);
  if (ctx.simular) {
    return ['# Simulação', '', 'Faria um initialize sem credenciais em ' + u.host + ' e leria os endereços públicos de autenticação. A rede fica bloqueada na simulação.'].join(NL);
  }
  const L = ['# KyDevor · sonda de autenticação', '', 'Servidor: ' + u.host, ''];
  const corpo = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'synapse-sonda', version: '0.1.0' } } });
  const a = await pedir(u.href, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: corpo });
  L.push('## initialize sem credenciais');
  if (a.erro) {
    L.push('Sem resposta (' + a.erro + '). Corrija: o Render pode estar acordando; repita em 1 minuto.');
  } else {
    L.push('- status: ' + a.r.status);
    L.push('- content-type: ' + (a.r.headers.get('content-type') || 'nenhum'));
    L.push('- www-authenticate: ' + (a.r.headers.get('www-authenticate') || 'nenhum'));
    L.push('- mcp-session-id presente: ' + (a.r.headers.get('mcp-session-id') ? 'sim' : 'não'));
    L.push('- corpo (início): ' + trecho(a.txt));
  }
  L.push('', '## Endereços públicos de autenticação');
  const caminhos = ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource' + u.pathname, '/.well-known/oauth-authorization-server', '/.well-known/openid-configuration'];
  for (const cam of caminhos) {
    const b = await pedir(u.origin + cam, { method: 'GET', headers: { accept: 'application/json' } });
    if (b.erro) { L.push('- ' + cam + ': sem resposta (' + b.erro + ')'); continue; }
    L.push('- ' + cam + ': HTTP ' + b.r.status);
    if (b.r.status === 200) {
      const k = chaves(b.txt);
      if (k && k.length) for (const linha of k) L.push('  ' + linha);
    }
  }
  const h = await pedir(u.origin + '/', { method: 'GET', headers: { accept: 'text/html' } });
  L.push('', '## Página inicial', h.erro ? 'Sem resposta (' + h.erro + ').' : '- HTTP ' + h.r.status + ', ' + (h.r.headers.get('content-type') || 'sem content-type'));
  L.push('', 'Nada foi enviado além de um initialize sem credenciais. Nenhuma senha foi usada.');
  return L.join(NL);
}
