import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarAgentes } from './agentes.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, '.teste-agentes');
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

let falhas = 0;
const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if (!c) falhas++; };
const ag = criarAgentes({
  dadosDir: DIR, raiz: RAIZ, sanitizar: s => String(s ?? ''),
  registrar: (tipo, d) => ag.espelhar({ hora: new Date().toISOString(), tipo, ...d })
});
const c = async (acao, agente, args = {}) => {
  const r = await ag.tratar(acao, { agente, ...args }, { agente, sessao: 's-' + agente });
  try { return JSON.parse(r); } catch { return r; }
};
const falha = p => p.then(() => false, () => true);

for (const n of ['mcp1', 'mcp2', 'mcp3']) await c('entrar', n, { dispositivo: 'celular-' + n, papel: n === 'mcp3' ? 'orquestrador' : 'executor' });
ok((await c('agentes', 'mcp1')).agentes.filter(x => x.estado === 'online').length === 3, '3 agentes online ao mesmo tempo');

const t = (await c('tarefa', 'mcp3', { op: 'criar', titulo: 'corrigir manifest' })).criada;
ok(t.id === 't1', 'orquestrador cria tarefa t1');
ok((await c('tarefa', 'mcp1', { op: 'pegar', tarefa_id: 't1' })).pegou.dono === 'mcp1', 'mcp1 pega t1');
ok(await falha(c('tarefa', 'mcp2', { op: 'pegar', tarefa_id: 't1' })), 'mcp2 não consegue pegar a mesma tarefa');

await c('trava', 'mcp1', { op: 'pegar', recurso: 'server.js' });
ok(await falha(c('trava', 'mcp2', { op: 'pegar', recurso: 'server.js' })), 'trava impede o segundo agente');
await c('trava', 'mcp1', { op: 'soltar', recurso: 'server.js' });
ok((await c('trava', 'mcp2', { op: 'pegar', recurso: 'server.js' })).travado === 'server.js', 'mcp2 trava depois que mcp1 solta');
await c('trava', 'mcp2', { op: 'soltar', recurso: 'server.js' });

await c('sala', 'mcp1', { texto: 'oi time' });
ok((await c('sala', 'mcp2')).novas.length === 1, 'mcp2 recebe mensagem da sala');
ok((await c('sala', 'mcp2')).novas.length === 0, 'mensagem não chega duas vezes');
ok((await c('sala', 'mcp1')).novas.length === 0, 'remetente não recebe a própria mensagem');

const p = await c('decidir', 'mcp1', { op: 'propor', texto: 'usar sala para tudo' });
ok((await c('decidir', 'mcp2', { op: 'aceitar', tarefa_id: p.proposta })).estado === 'decidida', 'dois aceites decidem');

await c('sala', 'mcp2');
await c('sala', 'mcp3');
const w = await c('aguardar', 'mcp2', { espera_s: 1 });
ok(w.vencido === true, 'aguardar vence sem novidades');
await c('tarefa', 'mcp3', { op: 'criar', titulo: 'outra' });
ok((await c('aguardar', 'mcp2', { espera_s: 5 })).tarefas_disponiveis.length === 1, 'aguardar acorda com tarefa nova');

await c('gravar', 'mcp2', { tipo: 'intencao', texto: 'mexer no loader' });
ok((await c('bastao', 'mcp2')).intencoes_abertas.length === 1, 'bastão mostra intenção aberta');
await c('gravar', 'mcp2', { tipo: 'resultado', texto: 'feito' });
ok((await c('bastao', 'mcp2')).intencoes_abertas.length === 0, 'resultado fecha a intenção');

const s = await c('sair', 'mcp1');
ok(s.tarefas_devolvidas.includes('t1'), 'sair devolve a tarefa à fila');
ok((await c('tarefa', 'mcp3', { op: 'listar' })).tarefas.find(x => x.id === 't1').estado === 'aberta', 'tarefa t1 voltou a aberta');

ag.salvarAgora();
const ag2 = criarAgentes({ dadosDir: DIR, raiz: RAIZ, sanitizar: s => String(s ?? ''), registrar: () => {} });
const r2 = JSON.parse(await ag2.tratar('tarefa', { agente: 'mcp3', op: 'listar' }, { agente: 'mcp3', sessao: 's-mcp3' }));
ok(r2.tarefas.length >= 2, 'estado persiste após reiniciar');

if (fs.existsSync(path.join(RAIZ, 'HISTORICO-E-DECISOES.md')))
  ok(String(await c('ler', 'mcp1', { documento: 'HISTORICO-E-DECISOES.md' })).startsWith('[HISTORICO-E-DECISOES.md parte 1/'), 'ler entrega documento em partes');
ok(fs.readdirSync(path.join(DIR, 'diario')).length >= 3, 'diário por sessão em arquivos separados');

fs.rmSync(DIR, { recursive: true, force: true });
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
process.exit(falhas ? 1 : 0);
