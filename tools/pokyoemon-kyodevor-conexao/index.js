import path from 'node:path';

const PADRAO = 'https://kyodevor.onrender.com/mcp';
const NL = String.fromCharCode(10);

function validar(bruto) {
  const txt = String(bruto || '').trim() || PADRAO;
  let u;
  try { u = new URL(txt); } catch (e) { throw new Error('URL inválida. Onde: campo url. Corrija: use https://servidor/mcp.'); }
  if (u.protocol !== 'https:') throw new Error('Só https é aceito. Onde: campo url. Corrija: comece com https://.');
  if (u.username || u.password) throw new Error('A URL não pode ter usuário nem senha. Onde: campo url. Corrija: remova; a senha é digitada só na tela de login do KyDevor.');
  if (u.search || u.hash) throw new Error('A URL não pode ter parâmetros nem token. Onde: campo url. Corrija: remova tudo depois do caminho.');
  return u;
}

function lerSalvo(ctx, arq) {
  try { return JSON.parse(ctx.ler(arq)).url || ''; } catch (e) { return ''; }
}

export async function run(entradas, ctx) {
  const acao = entradas.acao || 'link';
  const arq = path.join(ctx.pasta, 'config.json');
  const u = validar(entradas.url || lerSalvo(ctx, arq));
  const L = [];

  if (acao === 'salvar') {
    if (ctx.simular) {
      L.push('# Simulação', '', 'Gravaria o endereço ' + u.href + ' em config.json desta ferramenta. Nenhuma senha é gravada.');
      return L.join(NL);
    }
    ctx.backup(arq);
    ctx.escrever(arq, JSON.stringify({ url: u.href, salvo_em: new Date().toISOString() }, null, 2));
    L.push('# Endereço salvo', '', 'KyDevor: ' + u.href, '', 'Só o endereço foi gravado. A senha nunca passa por esta ferramenta.');
    return L.join(NL);
  }

  if (acao === 'verificar') {
    if (ctx.simular) {
      L.push('# Simulação', '', 'Faria um GET sem credenciais em ' + u.host + ' e devolveria só o status HTTP. A rede fica bloqueada na simulação.');
      return L.join(NL);
    }
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 25000);
    try {
      const r = await fetch(u.href, { method: 'GET', redirect: 'manual', signal: ac.signal, headers: { accept: 'application/json, text/event-stream, text/html' } });
      L.push('# KyDevor · verificação', '', 'Servidor: ' + u.host, 'Status HTTP: ' + r.status, '');
      if (r.status < 500) L.push('Resultado: o servidor respondeu. Isso não prova que a senha funciona; o login é conferido na tela do KyDevor.');
      else L.push('Resultado: o servidor respondeu com erro. Onde: ' + u.host + '. Corrija: veja os logs do Render do KyDevor.');
    } catch (e) {
      L.push('# KyDevor · verificação', '', 'Servidor: ' + u.host, 'Resultado: sem resposta (' + (e && e.name ? e.name : 'erro') + ').', 'Corrija: no Render o serviço pode estar acordando; repita em 1 minuto.');
    } finally {
      clearTimeout(t);
    }
    return L.join(NL);
  }

  L.push('# KyDevor · conexão', '', 'Endereço do MCP: ' + u.href, '', '1. Cole este endereço no conector MCP do KyDevor.', '2. A tela de login do KyDevor abre; digite a senha do MCP ali.', '3. Depois do login, as ferramentas do KyDevor ficam disponíveis ao conector.', '', 'Nunca digite a senha em campo de ferramenta, no chat ou no diário: tudo isso é gravado.');
  return L.join(NL);
}
