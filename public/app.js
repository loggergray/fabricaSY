const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const T3 = '`'.repeat(3);
let ferramentas = [];
let rodando = false;
let authDialogPromise = null;
let authDialogCancelled = false;
let tokenMemoria = '';
const TOKEN_KEY = 'synapse.token';

function lerToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || tokenMemoria; } catch { return tokenMemoria; }
}
function guardarToken(valor) {
  tokenMemoria = valor || '';
  try { if (valor) sessionStorage.setItem(TOKEN_KEY, valor); else sessionStorage.removeItem(TOKEN_KEY); } catch {}
  atualizarBotaoToken();
}
function atualizarBotaoToken() {
  const b = $('#tokenButton');
  if (b) b.textContent = lerToken() ? 'Token configurado' : 'Configurar token';
}
function abrirTokenDialog({ forcar = false, mensagem = '' } = {}) {
  if (authDialogPromise) return authDialogPromise;
  if (!forcar && authDialogCancelled) return Promise.resolve(null);
  authDialogCancelled = false;
  const dialog = $('#tokenDialog');
  const input = $('#tokenInput');
  const msg = $('#tokenMessage');
  msg.textContent = mensagem || 'O token fica somente nesta aba até ela ser fechada e é enviado em cabeçalho HTTPS. Ele não fica no código nem na URL.';
  input.value = '';
  dialog.showModal();
  input.focus();
  authDialogPromise = new Promise(resolve => {
    dialog._resolveToken = resolve;
  }).finally(() => { authDialogPromise = null; });
  return authDialogPromise;
}
function fecharTokenDialog(valor = null, cancelado = false) {
  const dialog = $('#tokenDialog');
  if (cancelado) authDialogCancelled = true;
  if (dialog.open) dialog.close();
  const resolve = dialog._resolveToken;
  delete dialog._resolveToken;
  if (resolve) resolve(valor);
}
async function apiFetch(url, options = {}) {
  const fazer = () => {
    const headers = new Headers(options.headers || {});
    const token = lerToken();
    if (token) headers.set('Authorization', 'Bearer ' + token);
    return fetch(url, { ...options, headers });
  };
  let resposta = await fazer();
  if (resposta.status !== 401 || authDialogCancelled) return resposta;
  const token = await abrirTokenDialog({ mensagem: 'Este painel precisa do token SYNAPSE_TOKEN para acessar a API. Cole o valor configurado no servidor.' });
  if (!token) return resposta;
  resposta = await fazer();
  if (resposta.status === 401) {
    authDialogCancelled = true;
    aviso('Token rejeitado. Use “Token configurado” para corrigir.');
  }
  return resposta;
}
async function checarResposta(resposta) {
  if (resposta.ok) return resposta;
  let mensagem = `Erro HTTP ${resposta.status}`;
  try { const corpo = await resposta.clone().json(); if (corpo.erro) mensagem = corpo.erro; } catch {}
  throw new Error(mensagem);
}

// ---------- mini renderizador de markdown (estilo documento) ----------
function md(src = '') {
  const blocos = [];
  const reBloco = new RegExp('(?:' + T3 + '|~~~)(\\w*)\\n([\\s\\S]*?)(?:' + T3 + '|~~~)', 'g');
  src = src.replace(reBloco, (_, l, c) => {
    blocos.push('<pre><code>' + esc(c.replace(/\n$/, '')) + '</code></pre>');
    return '\n\x00' + (blocos.length - 1) + '\x00\n';
  });
  const inline = t => esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const out = []; let lista = null; let par = [];
  const fechaPar = () => { if (par.length) { out.push('<p>' + inline(par.join(' ')) + '</p>'); par = []; } };
  const fechaLista = () => { if (lista) { out.push('</' + lista + '>'); lista = null; } };
  const abreLista = tipo => { if (lista !== tipo) { fechaLista(); out.push('<' + tipo + '>'); lista = tipo; } };
  for (const l of src.split('\n')) {
    let m;
    if ((m = l.match(/^\x00(\d+)\x00$/))) { fechaPar(); fechaLista(); out.push(blocos[m[1]]); }
    else if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { fechaPar(); fechaLista(); out.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>'); }
    else if ((m = l.match(/^\s*[-*]\s+(.*)$/))) { fechaPar(); abreLista('ul'); out.push('<li>' + inline(m[1]) + '</li>'); }
    else if ((m = l.match(/^\s*\d+\.\s+(.*)$/))) { fechaPar(); abreLista('ol'); out.push('<li>' + inline(m[1]) + '</li>'); }
    else if ((m = l.match(/^>\s?(.*)$/))) { fechaPar(); fechaLista(); out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); }
    else if (/^---+$/.test(l.trim())) { fechaPar(); fechaLista(); out.push('<hr>'); }
    else if (!l.trim()) { fechaPar(); fechaLista(); }
    else { fechaLista(); par.push(l.trim()); }
  }
  fechaPar(); fechaLista();
  return out.join('\n');
}

// ---------- utilidades ----------
async function carregar() {
  const r = await checarResposta(await apiFetch('/api/ferramentas'));
  ferramentas = await r.json();
}
function aviso(t) {
  const a = $('#aviso'); a.textContent = t; a.hidden = false;
  clearTimeout(aviso.t); aviso.t = setTimeout(() => { a.hidden = true; }, 2600);
}

// ---------- telas ----------
function telaHome() {
  const cards = ferramentas.map(t => t.erro
    ? `<div class="item erro"><span class="ico">⚠️</span><span><strong>${esc(t.id)}</strong><small>${esc(t.erro)}</small></span></div>`
    : `<a class="item" href="#/f/${t.id}"><span class="ico">${esc(t.icone)}</span><span><strong>${esc(t.nome)}</strong><small>${esc(t.descricao)}</small></span></a>`).join('');
  app.innerHTML = `<article class="doc"><h1>Suas ferramentas</h1>
    <p class="sub">${ferramentas.length} ferramenta(s) rodando ao vivo. Solte uma pasta em <code>tools/</code> e ela aparece aqui sozinha.</p></article>
    <div class="lista">${cards || '<p class="sub">Nenhuma ferramenta ainda.</p>'}</div>`;
}

async function telaAtividade() {
  const [er, dr] = await Promise.all([checarResposta(await apiFetch('/api/estado')), checarResposta(await apiFetch('/api/diario?limite=60'))]);
  const estado = await er.json(); const diario = (await dr.json()).registros || [];
  const agentes = (estado.agentes || []).map(a => `<article class="painel-card"><strong>${esc(a.nome)}</strong><span class="selo ${esc(a.estado)}">${esc(a.estado)}</span><small>${esc(a.papel || '')} · ${esc(a.dispositivo || '')}${a.tarefa ? ' · tarefa ' + esc(a.tarefa) : ''}</small></article>`).join('');
  const tarefas = (estado.tarefas || []).map(t => `<li><strong>${esc(t.id)} · ${esc(t.titulo)}</strong><small>${esc(t.estado)}${t.dono ? ' · ' + esc(t.dono) : ''}</small></li>`).join('') || '<li>Nenhuma tarefa registrada.</li>';
  const travas = (estado.travas || []).map(t => `<li><code>${esc(t.recurso)}</code> · ${esc(t.dono)} · ${esc(t.expira_em_s)}s</li>`).join('') || '<li>Nenhuma trava ativa.</li>';
  const entradas = diario.slice().reverse().map(e => `<article class="evento"><time>${esc(e.hora || '')}</time><b>${esc(e.tipo || '')}</b><span>${esc(e.agente || '')}</span><p>${esc(e.texto || e.resumo || e.acao || '')}</p></article>`).join('') || '<p class="sub">Ainda não há entradas no diário.</p>';
  app.innerHTML = `<article class="doc"><h1>Atividade real do Synapse</h1><p class="sub">Estado e diário servidos pelo MCP; atualização ao vivo enquanto a conexão estiver aberta.</p><div class="painel-grid">${agentes || '<p>Sem agentes registrados.</p>'}</div><h2>Tarefas</h2><ul>${tarefas}</ul><h2>Travas</h2><ul>${travas}</ul><h2>Diário ao vivo</h2><div id="linhaTempo">${entradas}</div></article>`;
}

async function telaProjeto() {
  const r = await checarResposta(await apiFetch('/api/projeto/snapshot'));
  const s = await r.json();
  const arquivos = (s.arquivos || []).filter(f => !f.ignorado).slice(0, 250).map(f => `<button class="arquivo" data-caminho="${esc(f.caminho)}"><strong>${esc(f.caminho)}</strong><small>${esc(f.linhas || 0)} linhas · ${esc(f.bytes)} bytes · ${esc((f.sha256 || '').slice(0,12))}</small></button>`).join('');
  app.innerHTML = `<article class="doc"><h1>Snapshot real do projeto</h1><p class="sub">Gerado ${esc(s.gerado_em || '')} · ${esc(s.total_arquivos || 0)} arquivos · ${esc(s.total_pastas || 0)} pastas · segredos, binários, dependências e dados excluídos.</p><div class="acoes"><button class="prim" id="atualizarSnapshot">Atualizar snapshot</button></div><div class="arquivo-lista">${arquivos || '<p>Nenhum arquivo de texto elegível encontrado.</p>'}</div><section id="arquivoPreview"></section></article>`;
  $('#atualizarSnapshot').onclick = () => telaProjeto().catch(e => aviso(e.message));
  app.querySelectorAll('[data-caminho]').forEach(b => b.onclick = async () => {
    const caminho = b.dataset.caminho;
    const x = await checarResposta(await apiFetch('/api/projeto/arquivo?caminho=' + encodeURIComponent(caminho)));
    const d = await x.json();
    $('#arquivoPreview').innerHTML = `<h2>${esc(d.caminho)}</h2><p class="sub">${esc(d.total_linhas)} linhas; exibindo a partir da ${esc(d.inicio)}.</p><pre class="source-preview">${esc(d.trecho || '')}</pre>`;
  });
}

async function telaPadrao() {
  const r = await checarResposta(await apiFetch('/api/padrao'));
  const txt = await r.text();
  app.innerHTML = `<article class="doc">${md(txt)}</article>`;
}

function campo(e, salvo) {
  const id = 'c_' + e.nome;
  const v = salvo[e.nome] ?? e.padrao ?? (e.tipo === 'booleano' ? false : '');
  const aj = e.ajuda ? `<p class="ajuda">${esc(e.ajuda)}</p>` : '';
  const rot = `<label for="${id}">${esc(e.rotulo || e.nome)}${e.obrigatorio ? ' <i>*</i>' : ''}</label>`;
  if (e.tipo === 'booleano')
    return `<div class="campo"><label class="chk"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${esc(e.rotulo || e.nome)}</label>${aj}</div>`;
  if (e.tipo === 'areatexto')
    return `<div class="campo">${rot}<textarea id="${id}" spellcheck="false">${esc(v)}</textarea>${aj}</div>`;
  if (e.tipo === 'opcoes') {
    const ops = (e.opcoes || []).map(o => { const val = typeof o === 'object' ? o.valor : o; const rt = typeof o === 'object' ? o.rotulo : o;
      return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(rt)}</option>`; }).join('');
    return `<div class="campo">${rot}<select id="${id}">${ops}</select>${aj}</div>`;
  }
  if (e.tipo === 'numero')
    return `<div class="campo">${rot}<input type="number" id="${id}" value="${esc(v)}" inputmode="decimal">${aj}</div>`;
  const extra = e.tipo === 'caminho' ? 'autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="url"' : '';
  return `<div class="campo">${rot}<input type="text" id="${id}" value="${esc(v)}" ${extra}>${aj}</div>`;
}

function telaFerramenta(id) {
  const t = ferramentas.find(x => x.id === id);
  if (!t || t.erro) {
    app.innerHTML = `<article class="doc"><h1>Indisponível</h1><p>${esc(t ? t.erro : 'Ferramenta não encontrada.')}</p><p><a href="#/">← Voltar</a></p></article>`;
    return;
  }
  const salvo = JSON.parse(localStorage.getItem('f:' + id) || '{}');
  app.innerHTML = `<article class="doc">
    <p class="crumb"><a href="#/">← Ferramentas</a></p>
    <h1>${esc(t.icone)} ${esc(t.nome)}</h1>
    <p class="sub">${esc(t.descricao)}</p>${md(t.doc)}</article>
    <form id="form">${t.entradas.map(e => campo(e, salvo)).join('')}
      <div class="campo"><label class="chk"><input type="checkbox" id="simular" ${salvo.__simular ? 'checked' : ''}> Simular (não grava nada)</label></div>
      <div class="acoes"><button class="prim" id="go">Executar</button></div></form>
    <section id="saida" class="doc"></section>`;
  $('#form').onsubmit = async ev => {
    ev.preventDefault();
    if (rodando) return;
    const valores = {};
    for (const e of t.entradas) {
      const el = $('#c_' + e.nome);
      valores[e.nome] = e.tipo === 'booleano' ? el.checked : e.tipo === 'numero' ? (el.value === '' ? '' : Number(el.value)) : el.value;
      if (e.obrigatorio && valores[e.nome] === '') { aviso('Preencha: ' + (e.rotulo || e.nome)); el.focus(); return; }
    }
    const simular = $('#simular').checked;
    const guardar = { __simular: simular };
    for (const e of t.entradas) if (e.tipo !== 'areatexto') guardar[e.nome] = valores[e.nome];
    localStorage.setItem('f:' + id, JSON.stringify(guardar));
    await executar(t, valores, simular);
  };
}

async function executar(t, inputs, simular) {
  rodando = true;
  const btn = $('#go'); btn.disabled = true; btn.textContent = 'Executando…';
  const saida = $('#saida');
  saida.innerHTML = '<h2>Execução</h2><pre class="log" id="log"></pre><div id="res"></div>';
  const log = $('#log'); const res = $('#res');
  const trata = m => {
    if (m.t === 'log') { log.textContent += m.msg + '\n'; log.scrollTop = log.scrollHeight; }
    else if (m.t === 'done') {
      const r = m.result || {}; const arqs = r.arquivos || [];
      res.innerHTML = (r.simulado ? '<blockquote>Simulação: nada foi gravado.</blockquote>' : '') + md(r.markdown || '# Concluído') +
        (arqs.length ? `<details><summary>${arqs.length} arquivo(s)</summary><pre>${esc(arqs.join('\n'))}</pre></details>` : '');
    } else if (m.t === 'err') {
      res.innerHTML = `<div class="erro-box"><strong>Erro:</strong> ${esc(m.msg)}</div>` +
        (m.stack ? `<details><summary>detalhes técnicos</summary><pre>${esc(m.stack)}</pre></details>` : '');
    }
  };
  try {
    const r = await checarResposta(await apiFetch('/api/executar/' + t.id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inputs, simular }) }));
    const rd = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await rd.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) trata(JSON.parse(l)); }
    }
  } catch (e) { trata({ t: 'err', msg: String(e.message || e) }); }
  rodando = false; btn.disabled = false; btn.textContent = 'Executar';
  res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------- rotas e ao vivo ----------
function rota() {
  const h = location.hash.slice(1) || '/';
  const m = h.match(/^\/f\/([\w-]+)$/);
  if (h === '/padrao') telaPadrao();
  else if (h === '/atividade') telaAtividade().catch(e => { app.innerHTML = `<article class="doc"><h1>Atividade indisponível</h1><p class="erro-box">${esc(e.message)}</p></article>`; });
  else if (h === '/projeto') telaProjeto().catch(e => { app.innerHTML = `<article class="doc"><h1>Snapshot indisponível</h1><p class="erro-box">${esc(e.message)}</p></article>`; });
  else if (m) telaFerramenta(m[1]);
  else telaHome();
  window.scrollTo(0, 0);
}

async function configurarToken() {
  const token = await abrirTokenDialog({ forcar: true });
  if (!token) return;
  authDialogCancelled = false;
  try {
    const r = await fetch('/api/ferramentas', { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) {
      authDialogCancelled = true;
      aviso('O servidor recusou esse token. Confira e tente novamente.');
      return;
    }
    ferramentas = await r.json();
    aviso('Token aceito e guardado neste navegador.');
    if (!location.hash || location.hash === '#/') telaHome();
  } catch (e) { aviso('Não consegui validar o token: ' + (e.message || e)); }
}

$('#tokenButton').addEventListener('click', configurarToken);
$('#tokenForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  const token = $('#tokenInput').value.trim();
  if (!token) { $('#tokenMessage').textContent = 'Cole o token antes de salvar.'; return; }
  const submit = $('#tokenForm button[type="submit"]');
  submit.disabled = true;
  try {
    const r = await fetch('/api/ferramentas', { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) {
      $('#tokenMessage').textContent = 'O servidor recusou este token. Confira o valor e tente novamente.';
      return;
    }
    guardarToken(token);
    fecharTokenDialog(token);
  } catch (e) {
    $('#tokenMessage').textContent = 'Não consegui validar o token: ' + (e.message || e);
  } finally { submit.disabled = false; }
});
$('#tokenCancel').addEventListener('click', () => fecharTokenDialog(null, true));
$('#tokenClear').addEventListener('click', () => {
  guardarToken('');
  fecharTokenDialog(null, true);
  aviso('Token removido deste navegador.');
});
$('#tokenDialog').addEventListener('cancel', ev => { ev.preventDefault(); fecharTokenDialog(null, true); });

async function acompanharEventos() {
  for (;;) {
    if (authDialogCancelled) {
      $('#vivo').classList.remove('on');
      await new Promise(resolve => setTimeout(resolve, 2000));
      continue;
    }
    try {
      const r = await apiFetch('/api/eventos', { headers: { Accept: 'text/event-stream' } });
      await checarResposta(r);
      $('#vivo').classList.add('on');
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let corte;
        while ((corte = buffer.indexOf('\n\n')) >= 0) {
          const bloco = buffer.slice(0, corte); buffer = buffer.slice(corte + 2);
          const evento = bloco.split('\n').find(l => l.startsWith('event:'))?.slice(6).trim();
          if (evento === 'mudou') {
            await carregar();
            aviso('Ferramentas atualizadas ao vivo');
            if (!location.hash || location.hash === '#/') telaHome();
          } else if (evento === 'diario' && location.hash === '#/atividade') {
            await telaAtividade();
          } else if (evento === 'estado' && location.hash === '#/atividade') {
            await telaAtividade();
          }
        }
      }
    } catch (e) {
      $('#vivo').classList.remove('on');
      if (e.message && e.message.includes('Não autorizado')) aviso('Configure o token para reconectar o painel.');
    }
    $('#vivo').classList.remove('on');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

atualizarBotaoToken();
try {
  await carregar();
  rota();
} catch (e) {
  app.innerHTML = `<article class="doc"><h1>Não foi possível carregar</h1><p class="erro-box">${esc(e.message || e)}</p><p>Use <strong>Configurar token</strong> no topo para autenticar o painel.</p></article>`;
}
window.addEventListener('hashchange', rota);
acompanharEventos();
