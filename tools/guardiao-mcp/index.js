import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));
function vivo(pid) { try { process.kill(Number(pid), 0); return true; } catch { return false; } }
function ler(ctx, arquivo) { try { return ctx.ler(arquivo); } catch { return ''; } }

export async function run({ acao = 'status', confirmar = false, periodo = '7', agente = '' } = {}, ctx) {
  const root = ctx.raiz;
  const script = path.join(root, 'artefatos', 'servidores', 'guardiao-mcp', 'server.mjs');
  const pidFile = path.join(root, 'dados', 'guardiao-mcp.pid');
  const stateFile = path.join(root, 'dados', 'guardiao-mcp-state.json');
  const rawPid = ler(ctx, pidFile).trim();
  const pid = Number(rawPid);

  if (acao === 'relatorio') { if (ctx.simular) return '# Simulação: consultaria o dashboard, avisaria os MCPs e registraria no Synapse; sem enviar mensagens.'; const base = (process.env.SYNAPSE_BASE_URL || ('http://127.0.0.1:' + (process.env.PORT || 3000))).replace(/\/$/, ''); const mp = process.env.MCP_PATH || '/mcp'; const token = process.env.SYNAPSE_TOKEN || ''; let rid = 0; const chamar = async (nome, argumentos) => { const headers = { 'Content-Type': 'application/json', 'x-agente': 'guardiao-mcp' }; if (token) headers.Authorization = 'Bearer ' + token; const body = { jsonrpc: '2.0', id: ++rid, method: 'tools/call', params: { name: 'synapse', arguments: { agente: 'guardiao-mcp', acao: nome, ...argumentos } } }; const resposta = await fetch(base + mp, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }); const dados = await resposta.json(); if (!resposta.ok || dados.error || dados.result?.isError) throw new Error('Chamada Synapse falhou.'); return dados.result?.content?.[0]?.text || ''; }; const relatorio = await chamar('executar', { ferramenta: 'dashboard-contexto-projeto', entradas: { periodo, agente } }); const mensagem = ('[GUARDIÃO ' + new Date().toISOString() + '] Dashboard de contexto do projeto' + String.fromCharCode(10) + relatorio).slice(0, 7000); await chamar('sala', { destino: 'todos', texto: mensagem }); await chamar('gravar', { tipo: 'resultado', texto: mensagem }); return relatorio + ' Relatório enviado aos MCPs e registrado no Synapse.'; } if (acao === 'status') {
    let state = {};
    try { state = JSON.parse(ler(ctx, stateFile) || '{}'); } catch {}
    const active = Number.isInteger(pid) && pid > 0 && vivo(pid);
    return `# Guardião MCP\n\n- Processo: **${active ? 'ativo' : 'não iniciado/encerrado'}**${active ? ` (PID ${pid})` : ''}\n- Heartbeat: ${state.heartbeat || 'ainda não recebido'}\n- MCP conectado: ${state.online ? 'sim' : 'não confirmado'}\n- Agentes online observados: ${(state.onlineAtivos || []).join(', ') || 'nenhum'}\n- Regras novas sincronizadas: ${state.regrasAtualizadas || 0}\n- Ocorrências registradas: ${Object.values(state.ocorrencias || {}).reduce((a, b) => a + Number(b || 0), 0)}\n- Último erro: ${state.ultimoErro || 'nenhum registrado'}`;
  }

  if (acao === 'ligar') {
    if (ctx.simular) return '# Simulação de início\n\nSeriam checados o processo existente e a fonte `artefatos/servidores/guardiao-mcp/server.mjs`; se não estiver ativo, seria iniciado um processo residente destacável. Nenhum processo foi iniciado.';
    if (!confirmar) return '# Início não confirmado\n\nNada foi iniciado. A execução real requer `confirmar=true`.';
    if (Number.isInteger(pid) && pid > 0 && vivo(pid)) return '# Já está ativo\n\nO guardião já está em execução (PID ' + pid + ').';
    if (!fs.existsSync(script)) throw new Error('Fonte do guardião ausente: ' + script + '. Onde: iniciar. Como corrigir: crie o artefato servidor guardiao-mcp no Synapse.');
    const child = spawn(process.execPath, [script], {
      cwd: root,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, GUARDIAO_ROOT: root, GUARDIAO_STATE_DIR: path.join(root, 'dados') }
    });
    child.unref();
    if (!child.pid) throw new Error('O processo não forneceu PID. Onde: iniciar guardião. Como corrigir: verifique se o ambiente permite processos residentes.');
    ctx.escrever(pidFile, String(child.pid) + '\n');
    ctx.log('Guardião iniciado em processo separado; aguardando primeiro heartbeat.');
    await esperar(1800);
    let state = {};
    try { state = JSON.parse(ler(ctx, stateFile) || '{}'); } catch {}
    return `# Guardião iniciado\n\n- PID: ${child.pid}\n- Heartbeat: ${state.heartbeat || 'pendente'}\n- MCP conectado: ${state.online ? 'sim' : 'ainda não confirmado'}\n- Último erro: ${state.ultimoErro || 'nenhum registrado'}\n\nO processo não abre porta pública; monitora a API local e grava heartbeat.`;
  }

  if (acao === 'parar') {
    if (ctx.simular) return '# Simulação de parada\n\nSeria enviado SIGTERM ao processo registrado, sem apagar arquivos ou dados.';
    if (!confirmar) return '# Parada não confirmada\n\nNada foi encerrado. A execução real requer `confirmar=true`.';
    if (!Number.isInteger(pid) || pid <= 0 || !vivo(pid)) return '# Não estava ativo\n\nNenhum processo residente válido foi encontrado.';
    process.kill(pid, 'SIGTERM');
    ctx.escrever(pidFile, 'encerrado\n');
    return '# Guardião encerrado\n\nSIGTERM enviado ao processo ' + pid + '.';
  }

  throw new Error('Ação inválida: ' + acao + '. Onde: controlador. Como corrigir: use ligar, status ou parar.');
}
