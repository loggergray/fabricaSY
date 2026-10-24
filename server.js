import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Loader } from './core/loader.js';
import { criarAgentes, persona } from './core/agentes.js';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const MODO_NUVEM = process.env.FABRICA_MODE === 'cloud';
const PORTA = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || (MODO_NUVEM ? '0.0.0.0' : '127.0.0.1');
const TOKEN = process.env.SYNAPSE_TOKEN || '';
const MCP_PATH = process.env.MCP_PATH || '/mcp';
const DADOS_DIR = path.resolve(process.env.DADOS_DIR || path.join(RAIZ, 'dados'));
const DIARIO_ARQ = path.join(DADOS_DIR, 'diario.jsonl');
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES) || 1024 * 1024;
const MAX_OUTPUT_BYTES = Number(process.env.MAX_OUTPUT_BYTES) || 8192;
const MAX_DIARIO_BUSCA = 500;
const PROTOCOLO_MCP = '2025-06-18';

if (MODO_NUVEM && !TOKEN) {
  console.error('ERRO: FABRICA_MODE=cloud exige SYNAPSE_TOKEN configurado como segredo.');
  process.exit(1);
}

const DADOS_PERSISTENTE = process.env.DADOS_PERSISTENTE === 'true';
fs.mkdirSync(DADOS_DIR, { recursive: true });
const DIR_TOOLS = path.join(RAIZ, 'tools');
const DIR_ARTEFATOS = path.join(RAIZ, 'artefatos');
const IDS_TOOLS_NATIVAS = new Set(fs.existsSync(DIR_TOOLS) ? fs.readdirSync(DIR_TOOLS, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name) : []);
const loader = new Loader(DIR_TOOLS);
let persistir = null, estadoInicial = null, geradosIniciais = [];
const hashesGerados = new Map();
let persistindoGerados = false;
const MAX_GERADO_BYTES = 250000;

function caminhoGerado(relativo) {
  const partes = String(relativo || '').replace(/\\/g, '/').split('/');
  if (partes.some(p => !p || p === '.' || p === '..')) return null;
  if (partes[0] === 'tools' && partes.length === 3 && /^[a-z0-9][a-z0-9-]{0,50}$/.test(partes[1]) && !IDS_TOOLS_NATIVAS.has(partes[1]) && ['manifest.json','index.js','README.md'].includes(partes[2])) return path.join(RAIZ, ...partes);
  if (partes[0] === 'artefatos' && partes.length === 4 && ['scripts','servidores'].includes(partes[1]) && /^[a-z0-9][a-z0-9-]{0,50}$/.test(partes[2]) && ['index.mjs','server.mjs','README.md'].includes(partes[3])) return path.join(RAIZ, ...partes);
  return null;
}
function restaurarGerados(lista) {
  for (const item of lista || []) {
    const destino = caminhoGerado(item.caminho);
    if (!destino || typeof item.conteudo !== 'string' || Buffer.byteLength(item.conteudo, 'utf8') > MAX_GERADO_BYTES) continue;
    try {
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, item.conteudo, 'utf8');
      hashesGerados.set(item.caminho, createHash('sha256').update(item.conteudo).digest('hex'));
    } catch (e) { console.error('Mongo (restauração de artefato):', e.message); }
  }
}
function arquivosGerados() {
  const saida = [];
  const adicionar = relativo => {
    const origem = caminhoGerado(relativo); if (!origem) return;
    try {
      const st = fs.lstatSync(origem);
      if (!st.isFile() || st.isSymbolicLink() || st.size > MAX_GERADO_BYTES) return;
      const conteudo = fs.readFileSync(origem, 'utf8');
      const hash = createHash('sha256').update(conteudo).digest('hex');
      if (hashesGerados.get(relativo) !== hash) saida.push({ caminho: relativo, conteudo, hash });
    } catch {}
  };
  try {
    for (const d of fs.readdirSync(DIR_TOOLS, { withFileTypes: true })) {
      if (d.isDirectory() && /^[a-z0-9][a-z0-9-]{0,50}$/.test(d.name) && !IDS_TOOLS_NATIVAS.has(d.name))
        for (const f of ['manifest.json','index.js','README.md']) adicionar(`tools/${d.name}/${f}`);
    }
  } catch {}
  for (const tipo of ['scripts','servidores']) {
    try {
      for (const d of fs.readdirSync(path.join(DIR_ARTEFATOS, tipo), { withFileTypes: true }))
        if (d.isDirectory() && /^[a-z0-9][a-z0-9-]{0,50}$/.test(d.name))
          for (const f of ['index.mjs','server.mjs','README.md']) adicionar(`artefatos/${tipo}/${d.name}/${f}`);
    } catch {}
  }
  return saida.slice(0, 2000);
}
async function persistirGerados() {
  if (!persistir?.salvarGerado || persistindoGerados) return;
  persistindoGerados = true;
  try {
    for (const item of arquivosGerados()) {
      await persistir.salvarGerado({ caminho: item.caminho, conteudo: item.conteudo });
      hashesGerados.set(item.caminho, item.hash);
    }
  } catch (e) { console.error('Mongo (persistência de artefatos):', e.message); }
  finally { persistindoGerados = false; }
}
if (process.env.MONGODB_URI) {
  try {
    const { abrirMongo } = await import('./core/mongo.js');
    const m = await abrirMongo(process.env.MONGODB_URI, process.env.MONGODB_DB || 'synapse');
    estadoInicial = m.carregado;
    geradosIniciais = await m.carregarGerados();
    persistir = { estado: m.salvarEstado, diario: m.salvarDiario, salvarGerado: m.salvarGerado };
    console.log('MongoDB: conectado (estado ' + (estadoInicial ? 'restaurado' : 'novo') + ')');
  } catch (e) {
    console.error('MongoDB falhou: ' + e.message + ' (seguindo só com arquivos)');
  }
} else if (MODO_NUVEM) {
  console.warn('AVISO: sem MONGODB_URI, o estado some quando o Render reiniciar.');
}
if (MODO_NUVEM && !DADOS_PERSISTENTE) {
  console.warn('AVISO: DADOS_DIR não está declarado como persistente; arquivos locais podem sumir em reinício/deploy.');
}
restaurarGerados(geradosIniciais);
if (MODO_NUVEM && !persistir?.salvarGerado) console.warn('AVISO: sem MongoDB, ferramentas e artefatos gerados não serão preservados após reinício/deploy.');

const agentes = criarAgentes({ dadosDir: DADOS_DIR, raiz: RAIZ, sanitizar, registrar, estadoInicial, persistir });
loader.mudou();

const clientes = new Set();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const ferramentasMcp = [
  {
    name: 'synapse',
    description:
      'Synapse da Fábrica: ferramenta MCP para ferramentas, coordenação, diário ao vivo e contexto do código. Use acao=projeto op=mapa|ler|buscar para inspecionar arquivos permitidos; segredos, dependências e dados são excluídos. Comece com acao=entrar e siga a missão devolvida.',
    inputSchema: {
      type: 'object',
      properties: {
        acao: {
          type: 'string',
          enum: [
            'ajuda',
            'entrar',
            'retomar',
            'listar',
            'executar',
            'simular',
            'criar',
            'gravar',
            'buscar',
            'aguardar',
            'bastao',
            'sair',
            'ler',
            'batimento',
            'agentes',
            'sala',
            'tarefa',
            'trava',
            'decidir',
            'projeto',
          ],
          description: 'Ação da ferramenta mestra.',
        },
        agente: { type: 'string' },
        dispositivo: { type: 'string' },
        papel: { type: 'string' },
        sessao: { type: 'string' },
        ferramenta: { type: 'string' },
        entradas: { type: 'object' },
        consulta: { type: 'string' },
        texto: { type: 'string' },
        limite: { type: 'integer', minimum: 1, maximum: 50 },
        op: { type: 'string', description: 'Subação de tarefa, trava e decidir.' },
        tarefa_id: { type: 'string', description: 'Id de tarefa (t1) ou de proposta (p1).' },
        titulo: { type: 'string' },
        para: { type: 'string', description: 'Agente destinatário de uma tarefa.' },
        destino: { type: 'string', description: 'sala: todos ou nome do agente.' },
        tipo: { type: 'string', description: 'gravar: intencao, raciocinio, acao, resultado, decisao, pergunta, confirmacao_usuario, erro ou nota.' },
        recurso: { type: 'string' },
        ttl_s: { type: 'integer' },
        espera_s: { type: 'integer', minimum: 1, maximum: 40 },
        documento: { type: 'string' },
        parte: { type: 'integer', minimum: 1 },
        caminho: { type: 'string', description: 'Caminho relativo do arquivo dentro do projeto.' },
        linha: { type: 'integer', minimum: 1 },
        quantidade: { type: 'integer', minimum: 1, maximum: 200 },
        confirmar: {
          type: 'boolean',
          description: 'Confirma uma ação de criação real depois de revisar a simulação.',
        },
        id: { type: 'string' },
        nome: { type: 'string' },
        icone: { type: 'string' },
        descricao: { type: 'string' },
        manifest_json: { type: 'string' },
        codigo: { type: 'string' },
      },
      required: ['acao'],
      additionalProperties: true,
    },
  },
];

function corsHeaders(req) {
  const origin = req.headers.origin;
  const permitidas = (process.env.ORIGENS_PERMITIDAS || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  const headers = {
    'Access-Control-Allow-Headers':
      'authorization, content-type, accept, mcp-protocol-version, last-event-id',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Expose-Headers': 'MCP-Protocol-Version, WWW-Authenticate',
    Vary: 'Origin',
  };

  if (!origin) return headers;

  const aceita = permitidas.includes('*') || permitidas.includes(origin);
  if (aceita) headers['Access-Control-Allow-Origin'] = permitidas.includes('*') ? '*' : origin;

  return headers;
}

function responderJson(res, dados, status = 200, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(JSON.stringify(dados));
}

function jsonRpcErro(id, codigo, mensagem, dados) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code: codigo,
      message: mensagem,
      ...(dados === undefined ? {} : { data: dados }),
    },
  };
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let tamanho = 0;
    let excedeu = false;
    req.on('data', parte => {
      if (excedeu) return;
      const bloco = Buffer.isBuffer(parte) ? parte : Buffer.from(parte);
      tamanho += bloco.length;
      if (tamanho > MAX_BODY_BYTES) {
        excedeu = true;
        partes.length = 0;
        reject(new Error('Corpo da requisição excede o limite permitido.'));
        req.destroy();
        return;
      }
      partes.push(bloco);
    });
    req.on('end', () => {
      if (excedeu) return;
      const corpo = Buffer.concat(partes).toString('utf8');
      try {
        resolve(corpo ? JSON.parse(corpo) : {});
      } catch {
        reject(new Error('O corpo da requisição não contém JSON válido.'));
      }
    });
    req.on('error', reject);
  });
}

function hostPermitido(req) {
  const configurados = (process.env.HOSTS_PERMITIDOS || '')
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);

  if (!configurados.length) {
    if (MODO_NUVEM) return true;
    return /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(req.headers.host || '');
  }

  if (configurados.includes('*')) return true;

  const host = String(req.headers.host || '').toLowerCase();
  const hostname = host.replace(/:\d+$/, '');
  return configurados.includes(host) || configurados.includes(hostname);
}

function origemPermitida(req) {
  const origin = req.headers.origin;
  if (!origin) return true;

  const configuradas = (process.env.ORIGENS_PERMITIDAS || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  return configuradas.includes('*') || configuradas.includes(origin);
}

const falhasAuth = new Map();
const JANELA_FALHAS_MS = 10 * 60 * 1000;
const MAX_FALHAS_AUTH = 30;
function ipDe(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
}
function registrarFalhaAuth(req) {
  const ip = ipDe(req), agora = Date.now(), f = falhasAuth.get(ip);
  if (!f || agora - f.inicio > JANELA_FALHAS_MS) falhasAuth.set(ip, { n: 1, inicio: agora });
  else f.n++;
  if (falhasAuth.size > 5000) falhasAuth.clear();
}
function excedeuFalhasAuth(req) {
  const f = falhasAuth.get(ipDe(req));
  return !!f && f.n > MAX_FALHAS_AUTH && Date.now() - f.inicio <= JANELA_FALHAS_MS;
}
function autenticado(req) {
  if (!TOKEN) return !MODO_NUVEM;

  const authorization = String(req.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) return false;

  const dado = Buffer.from(authorization.slice(7).trim()), esperado = Buffer.from(TOKEN);
  return dado.length === esperado.length && timingSafeEqual(dado, esperado);
}

function sanitizar(valor) {
  return String(valor ?? '')
    .replace(/\u0000/g, '')
    .replace(/(bearer\s+)[^\s"'`]+/gi, '$1[REDACTED]')
    .replace(/((?:token|secret|password|api[_-]?key)\s*[:=]\s*)[^\s"'`]+/gi, '$1[REDACTED]')
    .slice(0, 20000);
}

function emitirEvento(evento, dados = {}) {
  const linha = `${dados.seq ? `id: ${dados.seq}\n` : ''}event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
  for (const cliente of clientes) {
    try { if (!cliente.writableEnded) cliente.write(linha); } catch { clientes.delete(cliente); }
  }
}

function registrar(tipo, dados = {}) {
  const base = { hora: new Date().toISOString(), tipo, ...dados };
  try {
    const registro = agentes.espelhar(base) || base;
    fs.appendFileSync(DIARIO_ARQ, JSON.stringify(registro) + '\n', 'utf8');
    emitirEvento('diario', registro);
    emitirEvento('estado', agentes.painel());
    return registro;
  } catch (erro) {
    console.error('Falha ao gravar no diário:', erro.message);
    return base;
  }
}

function lerDiario(limite = 50, depois = 0, antes = 0) {
  try {
    const linhas = fs.readFileSync(DIARIO_ARQ, 'utf8').split('\n').filter(Boolean);
    const registros = linhas.map(linha => { try { return JSON.parse(linha); } catch { return null; } }).filter(Boolean);
    return registros.filter(r => Number(r.seq || 0) > depois && (!antes || Number(r.seq || 0) < antes)).slice(-Math.min(200, Math.max(1, limite)));
  } catch { return []; }
}

const EXTENSOES_TEXTO = new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.json','.html','.css','.md','.yml','.yaml','.sh','.sql','.py','.toml','.txt','.xml','.svg']);
const PASTAS_EXCLUIDAS = new Set(['.git','node_modules','dados','.historico','coverage','dist','build','.cache','vendor','.next','.vercel']);
const MAX_ARQUIVO_PROJETO = 262144;
function nomeSensivel(nome) {
  return /^\.env(?:\.|$)/i.test(nome) || /(?:secret|token|password|credential|private)/i.test(nome) || /\.(?:pem|key|p12|pfx)$/i.test(nome);
}
function extensaoTexto(caminho) {
  return EXTENSOES_TEXTO.has(path.extname(caminho).toLowerCase()) || ['.gitignore','.dockerignore'].includes(path.basename(caminho));
}
function resolverArquivoProjeto(relativo) {
  const pedido = String(relativo || '').trim().replace(/\\/g, '/');
  if (!pedido || pedido.startsWith('/') || pedido.split('/').includes('..') || pedido.includes('\\u0000')) throw new Error('Caminho inválido. Informe um caminho relativo à raiz do projeto.');
  const absoluto = path.resolve(RAIZ, pedido);
  const relativoReal = path.relative(RAIZ, absoluto);
  const partes = relativoReal.split(path.sep);
  if (!relativoReal || relativoReal.startsWith('..') || path.isAbsolute(relativoReal) || partes.some(p => PASTAS_EXCLUIDAS.has(p) || nomeSensivel(p))) throw new Error('Caminho fora da área de leitura permitida.');
  if (!extensaoTexto(absoluto) || !fs.existsSync(absoluto)) throw new Error('Arquivo inexistente ou tipo não permitido para leitura.');
  const info = fs.lstatSync(absoluto);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error('Leitura de links simbólicos e diretórios não é permitida.');
  const real = fs.realpathSync(absoluto), relReal = path.relative(RAIZ, real);
  if (relReal.startsWith('..') || path.isAbsolute(relReal)) throw new Error('Arquivo aponta para fora da raiz do projeto.');
  if (info.size > MAX_ARQUIVO_PROJETO) throw new Error('Arquivo grande demais para leitura direta; use o índice ou um trecho menor.');
  return absoluto;
}
function criarSnapshotProjeto() {
  const arquivos = [], pastas = new Set(); let ignorados = 0;
  function visitar(dir, relativo = '') {
    if (arquivos.length >= 5000) return;
    let itens;
    try { itens = fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)); } catch { return; }
    for (const item of itens) {
      if (arquivos.length >= 5000) break;
      if (item.isSymbolicLink() || nomeSensivel(item.name)) { ignorados++; continue; }
      const rel = relativo ? `${relativo}/${item.name}` : item.name;
      if (item.isDirectory()) {
        if (PASTAS_EXCLUIDAS.has(item.name)) { ignorados++; continue; }
        pastas.add(rel); visitar(path.join(dir, item.name), rel); continue;
      }
      if (!item.isFile() || !extensaoTexto(item.name)) { ignorados++; continue; }
      try {
        const abs = path.join(dir, item.name), info = fs.statSync(abs);
        if (info.size > MAX_ARQUIVO_PROJETO) { arquivos.push({ caminho: rel, bytes: info.size, ignorado: 'limite de tamanho' }); continue; }
        const dados = fs.readFileSync(abs);
        if (dados.includes(0)) { ignorados++; continue; }
        const texto = dados.toString('utf8');
        arquivos.push({ caminho: rel, bytes: info.size, linhas: texto ? texto.split('\n').length : 0, extensao: path.extname(item.name).toLowerCase(), sha256: createHash('sha256').update(dados).digest('hex') });
      } catch { ignorados++; }
    }
  }
  visitar(RAIZ); arquivos.sort((a,b) => a.caminho.localeCompare(b.caminho));
  const snapshot = { id: new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14), gerado_em: new Date().toISOString(), raiz: path.basename(RAIZ), total_arquivos: arquivos.length, total_pastas: pastas.size, ignorados, arquivos };
  const pasta = path.join(DADOS_DIR, 'snapshots'); fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(path.join(pasta, 'projeto-atual.json'), JSON.stringify(snapshot), 'utf8');
  return snapshot;
}
const MAX_TELEMETRIA_BYTES = 5 * 1024 * 1024;
function registrarTelemetriaProjeto(dados) {
  try {
    const arquivo = path.join(DADOS_DIR, 'telemetria-contexto-projeto.jsonl');
    try { if (fs.statSync(arquivo).size > MAX_TELEMETRIA_BYTES) fs.renameSync(arquivo, arquivo + '.antigo'); } catch {}
    const registro = { hora: new Date().toISOString(), ...dados, agente: sanitizar(dados.agente || 'desconhecido') };
    fs.appendFileSync(arquivo, JSON.stringify(registro) + '\n', { encoding: 'utf8', mode: 0o600 });
  } catch (erro) { console.error('Falha ao registrar telemetria de contexto:', sanitizar(erro.message)); }
}
function bytesSnapshot(s) {
  return s.arquivos.reduce((n, x) => n + (!x.ignorado && x.extensao !== '.pdf' ? Number(x.bytes || 0) : 0), 0);
}
const SNAPSHOT_TTL_MS = process.env.SNAPSHOT_TTL_MS !== undefined && process.env.SNAPSHOT_TTL_MS !== '' ? (Number(process.env.SNAPSHOT_TTL_MS) || 0) : 4000;
let snapshotEmCache = null, snapshotEmCacheEm = 0;
function snapshotProjeto(usarCache = false) {
  const agora = Date.now();
  if (usarCache && SNAPSHOT_TTL_MS > 0 && snapshotEmCache && agora - snapshotEmCacheEm < SNAPSHOT_TTL_MS) return { snap: snapshotEmCache, reaproveitado: true };
  snapshotEmCache = criarSnapshotProjeto();
  snapshotEmCacheEm = agora;
  return { snap: snapshotEmCache, reaproveitado: false };
}
function lerTrechoProjeto(caminho, linha = 1, quantidade = 100, agente = 'desconhecido') {
  const abs = resolverArquivoProjeto(caminho), texto = fs.readFileSync(abs, 'utf8'), linhas = texto.split('\n');
  const inicio = Math.max(1, Number(linha) || 1), max = Math.min(200, Math.max(1, Number(quantidade) || 100));
  const trecho = linhas.slice(inicio - 1, inicio - 1 + max).map((v, i) => `${inicio + i}: ${sanitizar(v)}`).join('\n');
  const arquivo = path.relative(RAIZ, abs).split(path.sep).join('/');
  registrarTelemetriaProjeto({ agente, acao: 'ler', caminho: arquivo, linha_inicio: inicio, linhas_pedidas: max, linhas_arquivo: linhas.length, linhas_devolvidas: Math.min(max, Math.max(0, linhas.length - inicio + 1)), bytes_arquivo_lido: Buffer.byteLength(texto), bytes_devolvidos: Buffer.byteLength(trecho) });
  return { caminho: arquivo, total_linhas: linhas.length, inicio, trecho };
}
function buscarProjeto(termo, limite = 20, agente = 'desconhecido') {
  const q = String(termo || '').trim().toLowerCase();
  if (q.length < 2) throw new Error('Informe um termo de busca com pelo menos 2 caracteres.');
  const { snap, reaproveitado } = snapshotProjeto(true), achados = [], max = Math.min(30, Math.max(1, Number(limite) || 20));
  let arquivos_varridos = 0, bytes_varridos = 0;
  for (const item of snap.arquivos) {
    if (achados.length >= max) break;
    if (item.ignorado) continue;
    try {
      const texto = fs.readFileSync(resolverArquivoProjeto(item.caminho), 'utf8');
      arquivos_varridos++; bytes_varridos += Buffer.byteLength(texto);
      const linhas = texto.split('\n');
      for (let i = 0; i < linhas.length; i++) if (linhas[i].toLowerCase().includes(q)) {
        achados.push({ caminho: item.caminho, linha: i + 1, trecho: sanitizar(linhas[i].slice(0, 300)) });
        if (achados.length >= max) break;
      }
    } catch {}
  }
  registrarTelemetriaProjeto({ agente, acao: 'buscar', arquivos_no_projeto: snap.arquivos.length, bytes_snapshot_lidos: reaproveitado ? 0 : bytesSnapshot(snap), arquivos_varridos, bytes_varridos, ocorrencias: achados.length, bytes_devolvidos: Buffer.byteLength(JSON.stringify(achados)), termo_caracteres: q.length });
  return { termo: q, ocorrencias: achados.length, resultados: achados };
}
function limitarSaida(texto) {
  const valor = sanitizar(texto);
  if (Buffer.byteLength(valor, 'utf8') <= MAX_OUTPUT_BYTES) return valor;

  let trecho = valor;
  while (
    trecho.length &&
    Buffer.byteLength(trecho + '\n[saída resumida pelo limite configurado]', 'utf8') >
      MAX_OUTPUT_BYTES
  ) {
    trecho = trecho.slice(0, Math.max(0, Math.floor(trecho.length * 0.9)));
  }

  return trecho + '\n[saída resumida pelo limite configurado]';
}

function saidaFerramentaMcp(id, texto, isError = false) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text: limitarSaida(texto) }],
      isError,
    },
  };
}

function executarStreaming(id, body, res) {
  const ferramenta = loader.tools.get(id);
  if (!ferramenta || ferramenta.erro) {
    responderJson(res, { erro: 'Ferramenta indisponível.' }, 404, corsHeaders({ headers: {} }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });

  const filho = fork(path.join(RAIZ, 'core', 'runner.js'), [], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });

  const enviar = objeto => {
    if (!res.writableEnded) res.write(JSON.stringify(objeto) + '\n');
  };

  let recebeuFim = false;

  const limiteTempo = setTimeout(() => {
    recebeuFim = true;
    enviar({ t: 'err', msg: 'A ferramenta excedeu o tempo máximo de execução.' });
    if (!filho.killed) filho.kill();
  }, Number(process.env.TOOL_STREAM_TIMEOUT_MS) || 600000);
  limiteTempo.unref();
  filho.on('close', () => clearTimeout(limiteTempo));

  filho.on('message', mensagem => {
    if (mensagem.t === 'done' || mensagem.t === 'err') recebeuFim = true;
    enviar(mensagem);
  });

  filho.stdout.on('data', dados => enviar({ t: 'log', msg: sanitizar(dados.toString()) }));
  filho.stderr.on('data', dados => enviar({ t: 'log', msg: sanitizar(dados.toString()) }));

  filho.on('error', erro => {
    enviar({ t: 'err', msg: sanitizar(erro.message) });
    if (!res.writableEnded) res.end();
  });

  filho.on('close', codigo => {
    if (!recebeuFim) {
      enviar({
        t: 'err',
        msg: `O processo terminou sem resposta (código ${codigo}).`,
      });
    }
    if (!res.writableEnded) res.end();
  });

  res.on('close', () => {
    if (!filho.killed) filho.kill();
  });

  filho.send({
    dir: ferramenta.dir,
    inputs: body.inputs || {},
    simular: !!body.simular,
  });
}

function executarFerramenta(id, entradas, simular = false) {
  return new Promise((resolve, reject) => {
    const ferramenta = loader.tools.get(id);

    if (!ferramenta || ferramenta.erro) {
      reject(new Error(`Ferramenta indisponível: ${id}`));
      return;
    }

    const filho = fork(path.join(RAIZ, 'core', 'runner.js'), [], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });

    let terminou = false;
    const logs = [];

    const encerrar = () => {
      if (!filho.killed) filho.kill();
    };

    const timeout = setTimeout(() => {
      encerrar();
      reject(new Error('A ferramenta excedeu o tempo máximo de execução.'));
    }, Number(process.env.TOOL_TIMEOUT_MS) || 120000);

    timeout.unref();

    filho.on('message', mensagem => {
      if (mensagem.t === 'log') {
        logs.push(sanitizar(mensagem.msg));
        return;
      }

      if (mensagem.t === 'done') {
        terminou = true;
        clearTimeout(timeout);
        resolve({ resultado: mensagem.result || {}, logs });
        return;
      }

      if (mensagem.t === 'err') {
        terminou = true;
        clearTimeout(timeout);
        reject(new Error(sanitizar(mensagem.msg || 'Erro durante a execução.')));
      }
    });

    filho.stdout.on('data', dados => logs.push(sanitizar(dados.toString())));
    filho.stderr.on('data', dados => logs.push(sanitizar(dados.toString())));

    filho.on('error', erro => {
      clearTimeout(timeout);
      reject(erro);
    });

    filho.on('close', codigo => {
      clearTimeout(timeout);
      if (!terminou) {
        reject(new Error(`O processo terminou sem resultado (código ${codigo}).`));
      }
    });

    filho.send({
      dir: ferramenta.dir,
      inputs: entradas || {},
      simular: !!simular,
    });
  });
}

function resumoFerramenta(resultado, logs = []) {
  const markdown =
    typeof resultado?.markdown === 'string'
      ? resultado.markdown
      : JSON.stringify(resultado ?? {}, null, 2);

  const linhas = [
    markdown,
    '',
    `Simulação: ${resultado?.simulado ? 'sim' : 'não'}.`,
  ];

  if (Array.isArray(resultado?.arquivos) && resultado.arquivos.length) {
    linhas.push('', 'Arquivos:', ...resultado.arquivos.map(arquivo => `- ${sanitizar(arquivo)}`));
  }

  if (logs.length) {
    linhas.push('', 'Logs:', ...logs.slice(-20).map(log => `- ${sanitizar(log)}`));
  }

  return linhas.join('\n');
}

function validarOrigin(req) {
  if (!req.headers.origin) return true;
  return origemPermitida(req);
}

async function acaoSynapse(argumentos) {
  const acao = String(argumentos.acao || '').toLowerCase();
  const agente = sanitizar(argumentos.agente || 'agente');
  const sessao = sanitizar(argumentos.sessao || `s-${agente}`);

  if (!acao) throw new Error('Informe o campo acao.');

  const delegado = await agentes.tratar(acao, argumentos, { agente, sessao });
  if (delegado !== undefined) return delegado;

  registrar('acao', {
    agente,
    sessao,
    acao,
    ferramenta: sanitizar(argumentos.ferramenta || ''),
  });

  if (acao === 'projeto') {
    const op = String(argumentos.op || 'mapa').toLowerCase();
    if (op === 'mapa' || op === 'snapshot') {
      const s = criarSnapshotProjeto();
      registrarTelemetriaProjeto({ agente, acao: 'mapa', arquivos_no_projeto: s.total_arquivos, bytes_snapshot_lidos: bytesSnapshot(s) });
      const pastas = {};
      for (const f of s.arquivos) { const p = f.caminho.split('/')[0] || '.'; pastas[p] = (pastas[p] || 0) + 1; }
      return JSON.stringify({ snapshot: s.id, gerado_em: s.gerado_em, arquivos: s.total_arquivos, pastas: s.total_pastas, ignorados: s.ignorados, por_pasta: pastas, indice: s.arquivos.slice(0, 45).map(f => ({ caminho: f.caminho, linhas: f.linhas, bytes: f.bytes, sha256: f.sha256, ignorado: f.ignorado })), proximo: 'Use op=ler com caminho e linha para abrir trechos; op=buscar para localizar símbolos.' }, null, 2);
    }
    if (op === 'ler') return JSON.stringify(lerTrechoProjeto(argumentos.caminho, argumentos.linha, argumentos.quantidade, agente), null, 2);
    if (op === 'buscar') return JSON.stringify(buscarProjeto(argumentos.consulta || argumentos.texto, argumentos.limite, agente), null, 2);
    throw new Error('op inválida para projeto. Use: mapa, snapshot, ler ou buscar.');
  }

  if (acao === 'ajuda') {
    const promptPath = path.join(RAIZ, 'PROMPT-AGENTES.md');
    if (!fs.existsSync(promptPath)) {
      return 'Não encontrei PROMPT-AGENTES.md na raiz da Fábrica.';
    }
    return fs.readFileSync(promptPath, 'utf8');
  }

  if (acao === 'entrar') {
    const entrada = {
      agente,
      dispositivo: sanitizar(argumentos.dispositivo || 'não informado'),
      papel: sanitizar(argumentos.papel || 'não informado'),
      sessao,
    };
    registrar('entrada', entrada);
    return [
      'Sessão registrada.',
      `Agente: ${entrada.agente}`,
      `Dispositivo: ${entrada.dispositivo}`,
      `Papel: ${entrada.papel}`,
      `Sessão: ${entrada.sessao}`,
      'Leia ajuda e chame retomar antes de agir.',
    ].join('\n');
  }

  if (acao === 'retomar') {
    const limite = Math.min(50, Math.max(1, Number(argumentos.limite) || 10));
    const registros = lerDiario(limite);
    return JSON.stringify(
      {
        agente,
        sessao,
        ponto_de_parada: registros.at(-1) || null,
        ultimas_entradas: registros,
      },
      null,
      2,
    );
  }

  if (acao === 'listar') {
    return JSON.stringify(
      loader.lista().map(ferramenta => ({
        id: ferramenta.id,
        nome: ferramenta.nome,
        descricao: ferramenta.descricao,
        entradas: ferramenta.entradas,
        erro: ferramenta.erro || null,
      })),
      null,
      2,
    );
  }

  if (acao === 'simular' || acao === 'executar') {
    const id = String(argumentos.ferramenta || '');
    if (!id) throw new Error('Informe ferramenta com o identificador da ferramenta.');

    const simular = acao === 'simular';
    if (!simular) {
      registrar('intencao', {
        agente,
        sessao,
        texto: `Executar ferramenta ${id}`,
        estado: 'aberta',
      });
    }

    const { resultado, logs } = await executarFerramenta(
      id,
      argumentos.entradas || {},
      simular,
    );

    registrar('resultado', {
      agente,
      sessao,
      ferramenta: id,
      simulado: simular,
      resumo: sanitizar(resultado?.markdown || ''),
    });

    return resumoFerramenta(resultado, logs);
  }

  if (acao === 'criar') {
    const criar = loader.tools.get('criar-ferramenta');
    if (!criar || criar.erro) {
      throw new Error('A ferramenta criar-ferramenta não está disponível.');
    }

    const entradas = {
      id: argumentos.id,
      nome: argumentos.nome,
      icone: argumentos.icone,
      descricao: argumentos.descricao,
      manifest_json: argumentos.manifest_json,
      codigo: argumentos.codigo,
    };

    if (!entradas.id || !entradas.nome) {
      throw new Error('Informe id e nome para simular a criação da ferramenta.');
    }

    if (argumentos.confirmar !== true) {
      const { resultado } = await executarFerramenta('criar-ferramenta', entradas, true);
      return [
        'SIMULAÇÃO de criação concluída. Nada foi gravado.',
        resumoFerramenta(resultado),
        '',
        'Revise o resultado. Para criar de verdade, faça uma nova chamada com confirmar=true.',
      ].join('\n');
    }

    registrar('intencao', {
      agente,
      sessao,
      texto: `Criar ferramenta ${sanitizar(entradas.id)}`,
      estado: 'aberta',
    });

    const { resultado, logs } = await executarFerramenta(
      'criar-ferramenta',
      entradas,
      false,
    );

    registrar('resultado', {
      agente,
      sessao,
      ferramenta: 'criar-ferramenta',
      criado: sanitizar(entradas.id),
      resumo: sanitizar(resultado?.markdown || ''),
    });

    return resumoFerramenta(resultado, logs);
  }

  if (acao === 'gravar') {
    const texto = sanitizar(argumentos.texto || '');
    if (!texto) throw new Error('Informe texto para registrar no diário.');

    registrar('nota', { agente, sessao, texto });
    return 'Registro adicionado ao diário.';
  }

  if (acao === 'buscar') {
    const consulta = sanitizar(argumentos.consulta || argumentos.texto || '').toLowerCase();
    if (!consulta) throw new Error('Informe consulta para buscar no diário.');

    const resultados = lerDiario(MAX_DIARIO_BUSCA)
      .filter(item => JSON.stringify(item).toLowerCase().includes(consulta))
      .slice(-20);

    return JSON.stringify(
      { ocorrencias: resultados.length, resultados },
      null,
      2,
    );
  }

  if (acao === 'aguardar') {
    return 'A fila persistente e o mecanismo de espera ainda não estão implementados.';
  }

  if (acao === 'bastao') {
    return JSON.stringify(
      {
        agente,
        sessao,
        ultimas_entradas: lerDiario(30),
        observacao: 'Resumo gerado a partir das últimas entradas do diário.',
      },
      null,
      2,
    );
  }

  if (acao === 'sair') {
    registrar('passagem', {
      agente,
      sessao,
      texto: sanitizar(argumentos.texto || 'Sessão encerrada.'),
    });
    return 'Sessão encerrada e passagem registrada.';
  }

  throw new Error(`Ação desconhecida: ${acao}`);
}

function instrucoesDe(req) {
  const n = String(req.headers['x-agente'] || '').replace(/[^\w.-]/g, '').slice(0, 40);
  return n ? persona(n) : 'Synapse da Fábrica. Chame acao=entrar para receber sua missão.';
}

async function atenderMcp(req, res) {
  const headers = corsHeaders(req);

  if (!hostPermitido(req)) {
    return responderJson(res, { erro: 'Host não permitido.' }, 403, headers);
  }

  if (!validarOrigin(req)) {
    return responderJson(res, { erro: 'Origin não permitido.' }, 403, headers);
  }

  if (!autenticado(req)) {
    registrarFalhaAuth(req);
    if (excedeuFalhasAuth(req)) return responderJson(res, { erro: 'Muitas tentativas sem autorização. Aguarde alguns minutos.' }, 429, { ...headers, 'Retry-After': '600' });
    return responderJson(
      res,
      { erro: 'Não autorizado.' },
      401,
      { ...headers, 'WWW-Authenticate': 'Bearer realm="Synapse"' },
    );
  }


  let mensagem;
  try {
    mensagem = await lerCorpo(req);
  } catch (erro) {
    return responderJson(
      res,
      jsonRpcErro(null, -32700, 'JSON inválido ou corpo inválido.', erro.message),
      400,
      headers,
    );
  }

  if (!mensagem || Array.isArray(mensagem) || mensagem.jsonrpc !== '2.0') {
    return responderJson(
      res,
      jsonRpcErro(mensagem?.id, -32600, 'Requisição JSON-RPC inválida.'),
      400,
      headers,
    );
  }

  const { id, method, params = {} } = mensagem;

  if (typeof method !== 'string') {
    return responderJson(
      res,
      jsonRpcErro(id, -32600, 'O método JSON-RPC é obrigatório.'),
      400,
      headers,
    );
  }

  if (method.startsWith('notifications/')) {
    res.writeHead(202, headers);
    return res.end();
  }

  const versaoSolicitada = params.protocolVersion;
  if (method === 'initialize') {
    const suportadas = ['2025-06-18', '2025-03-26', '2024-11-05'];
    const versao = suportadas.includes(versaoSolicitada) ? versaoSolicitada : PROTOCOLO_MCP;

    return responderJson(
      res,
      {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: versao,
          capabilities: {
            tools: { listChanged: false },
          },
          instructions: instrucoesDe(req),
          serverInfo: {
            name: 'synapse',
            title: 'Synapse da Fábrica',
            version: '1.0.0',
          },
        },
      },
      200,
      { ...headers, 'MCP-Protocol-Version': versao },
    );
  }

  if (method === 'ping') {
    return responderJson(res, { jsonrpc: '2.0', id, result: {} }, 200, headers);
  }

  if (method === 'tools/list') {
    return responderJson(
      res,
      {
        jsonrpc: '2.0',
        id,
        result: { tools: ferramentasMcp },
      },
      200,
      headers,
    );
  }

  if (method === 'tools/call') {
    if (params.name !== 'synapse') {
      return responderJson(
        res,
        jsonRpcErro(id, -32602, 'Ferramenta MCP desconhecida.'),
        200,
        headers,
      );
    }

    try {
      const args = { ...(params.arguments || {}) };
      const fixo = String(req.headers['x-agente'] || '').replace(/[^\w.-]/g, '').slice(0, 40);
      if (fixo) args.agente = fixo;
      const texto = await acaoSynapse(args);
      return responderJson(res, saidaFerramentaMcp(id, texto), 200, headers);
    } catch (erro) {
      const mensagemErro =
        `Falhou: ${sanitizar(erro.message)}. ` +
        `Onde: ação ${sanitizar(params.arguments?.acao || 'desconhecida')}. ` +
        'Como corrigir: confira os argumentos e o estado da ferramenta e tente novamente.';

      return responderJson(
        res,
        saidaFerramentaMcp(id, mensagemErro, true),
        200,
        headers,
      );
    }
  }

  return responderJson(
    res,
    jsonRpcErro(id, -32601, `Método não encontrado: ${method}`),
    200,
    headers,
  );
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname = url.pathname;
  const mAg = pathname.match(/^\/a\/([\w-]{1,30})(\/.*)?$/);
  if (mAg) { req.headers['x-agente'] = mAg[1]; pathname = mAg[2] || '/'; }
  const mTok = pathname.match(/^\/t\/([^/]+)(\/.*)?$/);
  if (mTok) {
    if (!req.headers.authorization) req.headers.authorization = 'Bearer ' + decodeURIComponent(mTok[1]).trim();
    pathname = mTok[2] || '/';
  }
  const qTok = url.searchParams.get('token');
  if (qTok && !req.headers.authorization) req.headers.authorization = 'Bearer ' + qTok.trim();
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  const headers = corsHeaders(req);

  if (req.method === 'OPTIONS') {
    if (!validarOrigin(req)) {
      res.writeHead(403, headers);
      return res.end();
    }
    res.writeHead(204, headers);
    return res.end();
  }

  try {
    if (req.method === 'POST' && !pathname.startsWith('/api/')) {
      return await atenderMcp(req, res);
    }

    if (pathname === MCP_PATH && (req.method === 'GET' || req.method === 'DELETE')) {
      res.writeHead(405, { ...headers, Allow: 'POST' });
      return res.end();
    }

    if (pathname === '/saude' && req.method === 'GET') {
      return responderJson(
        res,
        {
          status: 'ok',
          servico: 'synapse',
          modo: MODO_NUVEM ? 'nuvem' : 'local',
          ferramentas: loader.tools.size,
          extensoes: extensoes.estado().length,
          uptime_s: Math.round(process.uptime()),
          autenticacao: TOKEN ? 'token configurado' : 'sem token',
        },
        200,
        headers,
      );
    }

    if (pathname.startsWith('/api/') && !autenticado(req)) {
      return responderJson(res, { erro: 'Não autorizado. Configure o token SYNAPSE_TOKEN no painel.' }, 401, headers);
    }

    if (pathname === '/api/ext' || pathname.startsWith('/api/ext/')) {
      if (await extensoes.tratar(req, res, { url, pathname, headers })) return;
    }
    if (pathname === '/api/ferramentas' && req.method === 'GET') {
      return responderJson(res, loader.lista(), 200, headers);
    }

    if (pathname === '/api/estado' && req.method === 'GET') return responderJson(res, agentes.painel(), 200, headers);
    if (pathname === '/api/diario' && req.method === 'GET') {
      const limite = Math.min(200, Math.max(1, Number(url.searchParams.get('limite')) || 60));
      const depois = Math.max(0, Number(url.searchParams.get('depois')) || 0);
      const antes = Math.max(0, Number(url.searchParams.get('antes')) || 0);
      return responderJson(res, { registros: lerDiario(limite, depois, antes) }, 200, headers);
    }
    if (pathname === '/api/projeto/snapshot' && req.method === 'GET') {
      const s = criarSnapshotProjeto();
      return responderJson(res, { ...s, arquivos: s.arquivos.slice(0, 250) }, 200, headers);
    }
    if (pathname === '/api/projeto/arquivo' && req.method === 'GET') {
      try {
        const trecho = lerTrechoProjeto(url.searchParams.get('caminho'), url.searchParams.get('linha'), url.searchParams.get('quantidade'), 'painel');
        return responderJson(res, trecho, 200, headers);
      } catch (erro) { return responderJson(res, { erro: sanitizar(erro.message) }, 400, headers); }
    }

    if (pathname === '/api/padrao' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/markdown; charset=utf-8',
        ...headers,
      });
      return res.end(fs.readFileSync(path.join(RAIZ, 'PADRAO.md')));
    }

    if (pathname === '/api/eventos' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...headers,
      });

      res.write('retry: 2000\n\n');
      clientes.add(res);
      emitirEvento('estado', agentes.painel());
      req.on('close', () => clientes.delete(res));
      return;
    }

    const match = pathname.match(/^\/api\/executar\/([\w-]+)$/);
    if (match && req.method === 'POST') {
      if (MODO_NUVEM && !autenticado(req)) {
        return responderJson(res, { erro: 'Não autorizado.' }, 401, headers);
      }

      let corpo;
      try {
        corpo = await lerCorpo(req);
      } catch (erro) {
        return responderJson(res, { erro: erro.message }, 400, headers);
      }

      return executarStreaming(match[1], corpo, res);
    }

    const pastaPublica = path.join(RAIZ, 'public');
    const caminho = path.resolve(
      pastaPublica,
      pathname === '/' ? 'index.html' : `.${pathname}`,
    );
    const relativo = path.relative(pastaPublica, caminho);

    if (
      relativo.startsWith('..') ||
      path.isAbsolute(relativo) ||
      !fs.existsSync(caminho) ||
      fs.statSync(caminho).isDirectory()
    ) {
      res.writeHead(404, headers);
      return res.end('não encontrado');
    }

    res.writeHead(200, {
      'Content-Type': MIME[path.extname(caminho)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
      ...headers,
    });
    fs.createReadStream(caminho).pipe(res);
  } catch (erro) {
    if (!res.headersSent) {
      responderJson(res, { erro: sanitizar(erro.message || erro) }, 500, headers);
    } else if (!res.writableEnded) {
      res.end();
    }
  }
});

setInterval(() => {
  if (loader.mudou()) {
    for (const cliente of clientes) {
      if (!cliente.writableEnded) cliente.write('event: mudou\ndata: {}\n\n');
    }
  }
}, 1500).unref();

setInterval(() => {
  persistirGerados().catch(e => console.error('Mongo (persistência de artefatos):', e.message));
}, 3000).unref();

setInterval(() => {
  for (const cliente of clientes) {
    if (!cliente.writableEnded) cliente.write(': ping\n\n');
  }
}, 25000).unref();

let extensoes = { iniciar: async () => {}, parar: async () => {}, tratar: async () => false, estado: () => [] };
try {
  const { criarExtensoes } = await import('./core/extensoes.js');
  extensoes = criarExtensoes({
    raiz: RAIZ,
    contexto: { raiz: RAIZ, dadosDir: DADOS_DIR, loader, agentes, registrar, sanitizar, emitirEvento, responderJson, lerCorpo, lerDiario, autenticado, executarFerramenta, persistir: () => persistir },
  });
  await extensoes.iniciar();
} catch (e) {
  console.error('Extensões desligadas:', e.message);
}

servidor.keepAliveTimeout = 65000;
servidor.headersTimeout = 66000;

let encerrando = false;
async function encerrar(sinal) {
  if (encerrando) return;
  encerrando = true;
  console.log(`Recebido ${sinal}: encerrando com segurança...`);
  const forcar = setTimeout(() => process.exit(0), 9000);
  forcar.unref();
  try { await extensoes.parar(); } catch (e) { console.error('Extensões (parar):', e.message); }
  try { await persistirGerados(); await new Promise(r => setTimeout(r, 300)); await persistirGerados(); } catch {}
  for (const cliente of clientes) { try { cliente.end(); } catch {} }
  servidor.close(() => process.exit(0));
  if (typeof servidor.closeIdleConnections === 'function') servidor.closeIdleConnections();
}
process.on('SIGTERM', () => { encerrar('SIGTERM'); });
process.on('SIGINT', () => { encerrar('SIGINT'); });
process.on('unhandledRejection', motivo => { console.error('Promessa rejeitada sem tratamento:', sanitizar(motivo?.message || motivo)); });
process.on('uncaughtException', erro => { console.error('Exceção não tratada:', sanitizar(erro?.stack || erro?.message || erro)); });
servidor.listen(PORTA, HOST, () => {
  console.log(`Synapse: modo=${MODO_NUVEM ? 'nuvem' : 'local'} host=${HOST} porta=${PORTA} MCP=${MCP_PATH}`);
  console.log(`Ferramentas carregadas: ${loader.tools.size}`);
  console.log(`Dados: ${DADOS_DIR} | persistência declarada=${DADOS_PERSISTENTE ? 'sim' : 'não'} | estado/diário=${persistir ? 'MongoDB' : 'arquivos locais'}`);
  console.log(`Token: ${TOKEN ? 'configurado' : 'não configurado'}`);
  console.log(`Extensões: ${extensoes.estado().length} | telemetria de contexto: ativa`);
});
