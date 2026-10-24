// core/agentes.js: sessões, sala, tarefas, travas, decisões e aguardar do Synapse (roadmap F2, F3 e F13).
// Até 3 agentes (ou mais) do MESMO usuário, em chats e dispositivos diferentes, no mesmo servidor.
import fs from 'node:fs';
import path from 'node:path';

const TIPOS = ['intencao', 'raciocinio', 'acao', 'resultado', 'decisao', 'pergunta', 'confirmacao_usuario', 'erro', 'nota', 'passagem'];
const DOCS = ['HISTORICO-E-DECISOES.md', 'ROADMAP-SUPREMO.md', 'FORGE.md', 'CATALOGO-FERRAMENTAS.md', 'PROMPT-AGENTES.md', 'PADRAO.md', 'SYNAPSE.md'];
const ACOES = ['ajuda', 'ler', 'entrar', 'retomar', 'batimento', 'agentes', 'sala', 'tarefa', 'trava', 'decidir', 'gravar', 'aguardar', 'bastao', 'sair'];
const PARTE = 5500;
const MAXW = Number(process.env.AGUARDAR_MAX_S) || 55;
// INSTRUCAO_LOOP: o aguardar devolve ordens como resultado da chamada pendente (único canal para chat parado).
const J = o => JSON.stringify(o);
const dormir = ms => new Promise(r => setTimeout(r, ms));
const erro = m => { throw new Error(m); };

const PROTOCOLO = `SYNAPSE: protocolo rápido (regras completas: acao=ler documento=PROMPT-AGENTES.md)
Você é um agente do MESMO usuário. Até 3 agentes (ex.: mcp1, mcp2, mcp3) trabalham juntos em chats diferentes. O usuário fala com um e os outros recebem pela sala.
Envie SEMPRE agente="<seu nome fixo>" em toda chamada: o nome identifica sua sessão.
1. entrar (agente, dispositivo, papel=executor|revisor|orquestrador): devolve agentes online, tarefas, travas, decisões, mensagens novas e intenções abandonadas.
2. ler documento=HISTORICO-E-DECISOES.md, depois ROADMAP-SUPREMO.md, FORGE.md, CATALOGO-FERRAMENTAS.md (parte=1,2,3… até o fim).
3. Antes de agir: gravar tipo=intencao texto=... Depois: gravar tipo=resultado (ou erro). Raciocínio e decisões também: tipo=raciocinio, decisao.
4. Tarefas: tarefa op=listar|criar|pegar|soltar|concluir (campos: titulo, descricao, para, tarefa_id, texto). Só uma pessoa pega cada tarefa.
5. Travas: trava op=pegar recurso=<arquivo/projeto> ttl_s=300 antes de mexer; trava op=soltar ao terminar. Recurso travado por outro: espere ou escolha outra coisa.
6. Sala: sala texto=... destino=todos|<agente>. Sem texto, só lê mensagens novas.
7. Decidir juntos: decidir op=propor texto=...; outro agente op=aceitar tarefa_id=<id>. Dois aceites = decidida. O usuário desempata: op=usuario.
8. Ocioso: aguardar espera_s=30 (devolve mensagens e tarefas novas). batimento a cada ~1 min enquanto ativo. Sem sinal por 3 min você vira ausente e suas travas e tarefas voltam à fila.
9. Ao parar: sair (gera o bastão). Quem assume depois chama entrar e continua dele.
Regras: só ferramentas do MCP; simular antes de executar; confirmação do usuário antes de escrita real; nunca escrever segredos; não afirmar que funciona sem o resultado colado pelo usuário.`;

export function criarAgentes({ dadosDir, raiz, sanitizar, registrar, estadoInicial, persistir }) {
  const AUSENTE_MS = (Number(process.env.AGENTE_AUSENTE_S) || 180) * 1000;
  const arqEstado = path.join(dadosDir, 'estado.json');
  const dirDiario = path.join(dadosDir, 'diario');
  fs.mkdirSync(dirDiario, { recursive: true });

  const vazio = () => ({ seq: 0, agentes: {}, sala: [], tarefas: [], travas: {}, propostas: [], intencoes: {}, lidas: {}, prox: { msg: 0, tarefa: 0, proposta: 0 } });
  let E;
  if (estadoInicial) E = { ...vazio(), ...estadoInicial };
  else try { E = { ...vazio(), ...JSON.parse(fs.readFileSync(arqEstado, 'utf8')) }; } catch { E = vazio(); }

  function salvarAgora() {
    try {
      if (persistir) persistir.estado(E);
      const novo = arqEstado + '.novo';
      fs.writeFileSync(novo, JSON.stringify(E));
      fs.renameSync(novo, arqEstado);
    } catch (err) { console.error('Falha ao salvar estado dos agentes:', err.message); }
  }
  let timer = null;
  function agendar() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; salvarAgora(); }, 300);
    timer.unref();
  }

  const T = (s, n = 2000) => sanitizar(s).slice(0, n);
  const nomeAg = s => String(s || 'agente').replace(/[^\w.-]+/g, '-').slice(0, 40) || 'agente';
  const arqSessao = s => path.join(dirDiario, String(s || 'geral').replace(/[^\w.-]/g, '-').slice(0, 60) + '.jsonl');
  const sec = ms => Math.round(ms / 1000);

  function cauda(arq, n) {
    try {
      const st = fs.statSync(arq);
      const len = Math.min(st.size, 65536);
      const fd = fs.openSync(arq, 'r');
      const b = Buffer.alloc(len);
      fs.readSync(fd, b, 0, len, st.size - len);
      fs.closeSync(fd);
      let linhas = b.toString('utf8').split('\n').filter(Boolean);
      if (st.size > len) linhas = linhas.slice(1);
      return linhas.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
  }

  // ---------- diário por sessão (F2.1 a F2.5) ----------
  function espelhar(registro) {
    E.seq++;
    const r = { seq: E.seq, id: 'e' + E.seq, ...registro };
    if (persistir) persistir.diario(r);
    const rc = (E.recentes ||= {});
    (rc[registro.sessao] ||= []).push({ seq: r.seq, tipo: r.tipo, texto: String(r.texto || r.resumo || r.acao || '').slice(0, 140) });
    if (rc[registro.sessao].length > 15) rc[registro.sessao].shift();
    try { fs.appendFileSync(arqSessao(registro.sessao), J(r) + '\n', 'utf8'); } catch (err) { console.error('Falha no diário da sessão:', err.message); }
    const ag = registro.agente;
    if (ag) {
      if (registro.tipo === 'intencao') {
        const l = (E.intencoes[ag] ||= []);
        l.push({ seq: E.seq, hora: registro.hora, texto: String(registro.texto || '').slice(0, 300) });
        if (l.length > 20) l.shift();
      } else if ((registro.tipo === 'resultado' || registro.tipo === 'erro') && E.intencoes[ag]?.length) {
        E.intencoes[ag].pop();
      }
    }
    agendar();
    return r;
  }

  // ---------- presença (F3.6, F13.8) ----------
  function tocar(nome, a, sessao) {
    const t = Date.now();
    const g = (E.agentes[nome] ||= { nome, entrou: t });
    g.sessao = sessao || g.sessao || 's-' + nome;
    if (a.dispositivo) g.dispositivo = T(a.dispositivo, 60);
    if (a.papel) g.papel = T(a.papel, 30);
    g.dispositivo ||= 'não informado';
    g.papel ||= (nome === 'mcp1' ? 'orquestrador' : 'executor');
    g.visto = t;
    g.estado = 'online';
    agendar();
    return g;
  }

  function varrer() {
    const t = Date.now();
    let mudou = false;
    for (const g of Object.values(E.agentes)) {
      if (g.estado === 'online' && t - g.visto > AUSENTE_MS) {
        g.estado = 'ausente';
        mudou = true;
        registrar('nota', { agente: g.nome, sessao: g.sessao, texto: 'Agente ausente: sem batimento. Travas e tarefas voltam à fila.' });
      }
    }
    for (const [rec, tr] of Object.entries(E.travas)) {
      const dono = E.agentes[tr.dono];
      if (tr.expira < t || !dono || dono.estado !== 'online') { delete E.travas[rec]; mudou = true; }
    }
    for (const k of E.tarefas) {
      if (k.estado === 'em_andamento') {
        const dono = E.agentes[k.dono];
        if (!dono || dono.estado !== 'online') {
          k.nota = `devolvida: ${k.dono} ficou ausente`;
          k.estado = 'aberta';
          k.dono = null;
          mudou = true;
        }
      }
    }
    if (E.sala.length > 300) E.sala.splice(0, E.sala.length - 300);
    const conc = E.tarefas.filter(k => k.estado === 'concluida');
    if (conc.length > 200) E.tarefas = E.tarefas.filter(k => !conc.slice(0, conc.length - 200).includes(k));
    if (E.propostas.length > 100) E.propostas.splice(0, E.propostas.length - 100);
    if (mudou) agendar();
  }
  setInterval(varrer, 30000).unref();

  // ---------- consultas ----------
  const resumoT = k => ({ id: k.id, titulo: k.titulo, estado: k.estado, dono: k.dono, para: k.para || null, nota: k.nota || undefined });

  function novasMsgs(nome, consumir) {
    const ult = E.lidas[nome] || 0;
    const l = E.sala.filter(m => m.seq > ult && m.de !== nome && (m.para === 'todos' || m.para === nome))
      .map(m => ({ id: m.id, de: m.de, para: m.para, tipo: m.tipo, texto: m.texto }));
    if (consumir) { E.lidas[nome] = E.prox.msg; agendar(); }
    return l;
  }

  function livres(nome) { return E.tarefas.filter(k => k.estado === 'aberta' && (!k.para || k.para === nome)); }

  function listaAgentes() {
    const t = Date.now();
    return Object.values(E.agentes).map(x => ({
      nome: x.nome, papel: x.papel, dispositivo: x.dispositivo, estado: x.estado, sem_sinal_s: sec(t - x.visto),
      tarefa: E.tarefas.find(k => k.dono === x.nome && k.estado === 'em_andamento')?.id || null
    }));
  }

  function decisoesRecentes() { return E.propostas.filter(p => p.estado === 'decidida').slice(-5).map(p => ({ id: p.id, texto: p.texto.slice(0, 200) })); }

  function ultimasEntradas(g, n) {
    return (E.recentes?.[g.sessao] || []).slice(-n);
  }

  function bastao(nome) {
    const g = E.agentes[nome];
    return {
      de: nome, hora: new Date().toISOString(), papel: g?.papel,
      intencoes_abertas: (E.intencoes[nome] || []).map(i => i.texto.slice(0, 200)),
      tarefas: E.tarefas.filter(k => k.dono === nome && k.estado === 'em_andamento').map(resumoT),
      travas: Object.entries(E.travas).filter(([, v]) => v.dono === nome).map(([r]) => r),
      decisoes_recentes: decisoesRecentes(),
      ultimas_entradas: g ? ultimasEntradas(g, 10) : []
    };
  }

  function visao(nome) {
    const abandonadas = [];
    for (const [ag, l] of Object.entries(E.intencoes)) {
      if (ag !== nome && l.length && ['ausente', 'saiu'].includes(E.agentes[ag]?.estado))
        abandonadas.push({ agente: ag, intencoes: l.map(i => i.texto.slice(0, 160)), aviso: 'verifique em simulação antes de repetir' });
    }
    const g = E.agentes[nome];
    return {
      voce: { nome, sessao: g.sessao, papel: g.papel, dispositivo: g.dispositivo },
      agentes: listaAgentes(),
      mensagens_novas: novasMsgs(nome, true),
      tarefas_abertas: livres(nome).map(resumoT),
      tarefas_minhas: E.tarefas.filter(k => k.dono === nome && k.estado === 'em_andamento').map(resumoT),
      travas: Object.entries(E.travas).map(([r, v]) => ({ recurso: r, dono: v.dono, expira_em_s: sec(v.expira - Date.now()) })),
      decisoes_recentes: decisoesRecentes(),
      propostas_abertas: E.propostas.filter(p => p.estado === 'aberta').map(p => ({ id: p.id, de: p.de, texto: p.texto.slice(0, 200), aceites: p.aceites })),
      intencoes_minhas_abertas: (E.intencoes[nome] || []).map(i => i.texto.slice(0, 160)),
      intencoes_abandonadas: abandonadas,
      ultimas_entradas: ultimasEntradas(g, 8)
    };
  }

  // ---------- ação principal ----------
  async function tratar(acao, a, { agente, sessao }) {
    const nome = nomeAg(agente);
    const g = tocar(nome, a, sessao);
    varrer();
    if (!ACOES.includes(acao)) return undefined;
    const op = String(a.op || '').toLowerCase();

    switch (acao) {
      case 'ajuda':
        return PROTOCOLO + '\nDocumentos: ' + DOCS.join(', ') + '.';

      case 'ler': {
        const doc = String(a.documento || '');
        if (!DOCS.includes(doc)) erro('Documento inválido. Use um destes: ' + DOCS.join(', ') + '.');
        let txt;
        try { txt = fs.readFileSync(path.join(raiz, doc), 'utf8'); } catch { erro('Não consegui abrir ' + doc + ' na raiz da Fábrica.'); }
        const total = Math.max(1, Math.ceil(txt.length / PARTE));
        const parte = Math.min(Math.max(1, Number(a.parte) || 1), total);
        return `[${doc} parte ${parte}/${total}]\n` + txt.slice((parte - 1) * PARTE, parte * PARTE);
      }

      case 'entrar':
        registrar('entrada', { agente: nome, sessao: g.sessao, dispositivo: g.dispositivo, papel: g.papel });
        return J({ ok: true, missao: persona(nome), proximo_passo: 'Chame ler documento=HISTORICO-E-DECISOES.md (e os demais) e confira a sala.', ...visao(nome) });

      case 'retomar':
        return J(visao(nome));

      case 'batimento':
        return J({ ok: true, hora: new Date().toISOString(), mensagens_novas: novasMsgs(nome, false).length, tarefas_livres: livres(nome).length });

      case 'agentes':
        return J({ agentes: listaAgentes() });

      case 'gravar': {
        if (a.tipo && !TIPOS.includes(a.tipo)) erro('Tipo inválido. Use: ' + TIPOS.join(', ') + '.');
        const tipo = a.tipo || 'nota';
        const texto = T(a.texto, 4000);
        if (!texto) erro('Informe texto para gravar no diário.');
        registrar(tipo, { agente: nome, sessao: g.sessao, texto, ...(tipo === 'intencao' ? { estado: 'aberta' } : {}) });
        return J({ gravado: true, tipo, seq: E.seq });
      }

      case 'sala': {
        const texto = T(a.texto || a.mensagem, 2000);
        let enviada = null, aviso;
        if (texto) {
          const para = !a.destino || a.destino === 'todos' ? 'todos' : nomeAg(a.destino);
          if (para !== 'todos' && !E.agentes[para]) aviso = `${para} ainda não entrou; a mensagem fica guardada para quando entrar.`;
          const n = ++E.prox.msg;
          enviada = { id: 'm' + n, seq: n, hora: new Date().toISOString(), de: nome, para, tipo: T(a.tipo, 20) || 'msg', texto };
          E.sala.push(enviada);
          registrar('nota', { agente: nome, sessao: g.sessao, texto: `[sala para ${para}] ${texto}` });
          agendar();
        }
        return J({ enviada: enviada?.id || null, aviso, novas: novasMsgs(nome, true) });
      }

      case 'tarefa': {
        const id = a.tarefa_id || a.id;
        const o = op || 'listar';
        if (o === 'listar') {
          const f = a.estado ? E.tarefas.filter(k => k.estado === a.estado) : E.tarefas.filter(k => k.estado !== 'concluida');
          return J({ tarefas: f.map(resumoT) });
        }
        if (o === 'criar') {
          const titulo = T(a.titulo || a.nome, 200);
          if (!titulo) erro('Informe titulo da tarefa.');
          const k = { id: 't' + (++E.prox.tarefa), titulo, descricao: T(a.descricao, 2000), estado: 'aberta', dono: null, para: a.para ? nomeAg(a.para) : null, criada_por: nome, criada: Date.now() };
          E.tarefas.push(k);
          registrar('nota', { agente: nome, sessao: g.sessao, texto: `Tarefa ${k.id} criada: ${titulo}` });
          salvarAgora();
          return J({ criada: resumoT(k) });
        }
        if (o === 'pegar') {
          let k;
          if (id) { k = E.tarefas.find(x => x.id === id); if (!k) erro(`Tarefa ${id} não existe. Use tarefa op=listar.`); }
          else k = livres(nome)[0];
          if (!k) return J({ pegou: null, motivo: 'sem tarefa aberta para você' });
          if (k.estado !== 'aberta') erro(`Tarefa ${k.id} já está ${k.estado}${k.dono ? ' com ' + k.dono : ''}.`);
          if (k.para && k.para !== nome) erro(`Tarefa ${k.id} é destinada a ${k.para}.`);
          k.estado = 'em_andamento'; k.dono = nome; k.pegada = Date.now(); delete k.nota;
          registrar('nota', { agente: nome, sessao: g.sessao, texto: `Pegou tarefa ${k.id}: ${k.titulo}` });
          salvarAgora();
          return J({ pegou: { ...resumoT(k), descricao: k.descricao } });
        }
        const k = E.tarefas.find(x => x.id === id);
        if (!k) erro(`Informe tarefa_id válido. Use tarefa op=listar.`);
        if (k.dono !== nome) erro(`Tarefa ${k.id} não está com você (dono: ${k.dono || 'ninguém'}).`);
        if (o === 'soltar') { k.estado = 'aberta'; k.dono = null; salvarAgora(); return J({ solta: k.id }); }
        if (o === 'concluir') {
          k.estado = 'concluida'; k.resultado = T(a.texto, 2000); k.concluida = Date.now();
          for (const [r, tr] of Object.entries(E.travas)) if (tr.tarefa === k.id) delete E.travas[r];
          registrar('resultado', { agente: nome, sessao: g.sessao, texto: `Tarefa ${k.id} concluída. ${k.resultado}` });
          salvarAgora();
          return J({ concluida: k.id });
        }
        return erro('op inválida para tarefa. Use: listar, criar, pegar, soltar, concluir.');
      }

      case 'trava': {
        const o = op || 'listar';
        const lista = () => Object.entries(E.travas).map(([r, v]) => ({ recurso: r, dono: v.dono, expira_em_s: sec(v.expira - Date.now()), tarefa: v.tarefa || null }));
        if (o === 'listar') return J({ travas: lista() });
        const rec = T(a.recurso, 200);
        if (!rec) erro('Informe recurso (arquivo, pasta ou projeto) para a trava.');
        if (o === 'pegar') {
          const atual = E.travas[rec];
          if (atual && atual.expira > Date.now() && atual.dono !== nome)
            erro(`Recurso "${rec}" travado por ${atual.dono} até ${new Date(atual.expira).toISOString().slice(11, 19)}Z. Espere, escolha outro recurso ou fale pela sala.`);
          const ttl = Math.min(Math.max(Number(a.ttl_s) || 300, 10), 3600);
          E.travas[rec] = { dono: nome, expira: Date.now() + ttl * 1000, tarefa: a.tarefa_id || undefined };
          salvarAgora();
          return J({ travado: rec, expira_em_s: ttl, dica: 'Renove com trava op=pegar de novo antes de expirar.' });
        }
        if (o === 'soltar') {
          const atual = E.travas[rec];
          if (!atual) return J({ solta: rec, aviso: 'já estava livre' });
          if (atual.dono !== nome) erro(`Trava de "${rec}" pertence a ${atual.dono}.`);
          delete E.travas[rec]; salvarAgora();
          return J({ solta: rec });
        }
        return erro('op inválida para trava. Use: pegar, soltar, listar.');
      }

      case 'decidir': {
        const o = op || 'listar';
        const id = a.tarefa_id || a.id;
        if (o === 'listar') return J({ propostas: E.propostas.slice(-15).map(p => ({ id: p.id, estado: p.estado, de: p.de, texto: p.texto.slice(0, 200), aceites: p.aceites, recusas: p.recusas })) });
        if (o === 'propor') {
          const texto = T(a.texto, 1000);
          if (!texto) erro('Informe texto da proposta.');
          const p = { id: 'p' + (++E.prox.proposta), estado: 'aberta', de: nome, texto, aceites: [nome], recusas: [], hora: new Date().toISOString() };
          E.propostas.push(p);
          const n = ++E.prox.msg;
          E.sala.push({ id: 'm' + n, seq: n, hora: p.hora, de: nome, para: 'todos', tipo: 'proposta', texto: `Proposta ${p.id}: ${texto} (decidir op=aceitar tarefa_id=${p.id})` });
          salvarAgora();
          return J({ proposta: p.id, precisa_de: '1 aceite de outro agente (ou do usuário)' });
        }
        const p = E.propostas.find(x => x.id === id);
        if (!p) erro('Informe tarefa_id com o id da proposta (ex.: p1). Use decidir op=listar.');
        if (p.estado !== 'aberta') erro(`Proposta ${p.id} já está ${p.estado}.`);
        if (o === 'aceitar') {
          if (!p.aceites.includes(nome)) p.aceites.push(nome);
          if (p.aceites.length >= 2) { p.estado = 'decidida'; registrar('decisao', { agente: nome, sessao: g.sessao, texto: `[${p.id}] ${p.texto} (aceita por ${p.aceites.join(', ')})` }); }
        } else if (o === 'recusar') {
          if (!p.recusas.includes(nome)) p.recusas.push(nome);
          if (p.recusas.length >= 2) p.estado = 'recusada';
        } else if (o === 'usuario') {
          const aceita = a.confirmar !== false;
          p.estado = aceita ? 'decidida' : 'recusada';
          registrar('confirmacao_usuario', { agente: nome, sessao: g.sessao, texto: `[${p.id}] usuário ${aceita ? 'aceitou' : 'recusou'}: ${p.texto}` });
          if (aceita) registrar('decisao', { agente: nome, sessao: g.sessao, texto: `[${p.id}] ${p.texto} (decidida pelo usuário)` });
        } else erro('op inválida para decidir. Use: propor, aceitar, recusar, usuario, listar.');
        salvarAgora();
        return J({ proposta: p.id, estado: p.estado, aceites: p.aceites, recusas: p.recusas });
      }

      case 'aguardar': {
        const espera = Math.min(Math.max(Number(a.espera_s) || MAXW, 1), MAXW) * 1000;
        const fim = Date.now() + espera;
        for (;;) {
          tocar(nome, {}, g.sessao);
          varrer();
          const msgs = novasMsgs(nome, false);
          const abertas = livres(nome);
          if (msgs.length || abertas.length || Date.now() >= fim) {
            return J({ mensagens: novasMsgs(nome, true), tarefas_disponiveis: abertas.map(k => ({ ...resumoT(k), descricao: k.descricao })), vencido: !msgs.length && !abertas.length, instrucao: msgs.some(m => m.tipo === 'pausar') ? 'PAUSAR: chame sair, avise o usuário em uma linha e encerre o loop. Não chame aguardar de novo.' : abertas.length ? 'ORDEM: pegue a tarefa (tarefa op=pegar), execute só com ferramentas do MCP, conclua (tarefa op=concluir texto=resultado) e IMEDIATAMENTE chame aguardar de novo.' : (msgs.length ? 'Leia as mensagens, responda pela sala se precisar e chame aguardar de novo.' : 'Nada novo. Chame aguardar de novo AGORA, sem escrever texto ao usuário.') });
          }
          await dormir(500);
        }
      }

      case 'bastao':
        return J(bastao(nomeAg(a.de || nome)));

      case 'sair': {
        const b = bastao(nome);
        const devolvidas = [];
        for (const k of E.tarefas) if (k.dono === nome && k.estado === 'em_andamento') { k.estado = 'aberta'; k.dono = null; k.nota = `devolvida: ${nome} saiu`; devolvidas.push(k.id); }
        for (const [r, tr] of Object.entries(E.travas)) if (tr.dono === nome) delete E.travas[r];
        g.estado = 'saiu';
        registrar('passagem', { agente: nome, sessao: g.sessao, texto: T(a.texto, 500) || 'Sessão encerrada.' });
        salvarAgora();
        return J({ ok: true, tarefas_devolvidas: devolvidas, bastao: b });
      }
    }
    return undefined;
  }

  function painel() {
    return {
      seq: E.seq,
      agentes: listaAgentes(),
      tarefas: E.tarefas.map(resumoT),
      travas: Object.entries(E.travas).map(([recurso, v]) => ({ recurso, dono: v.dono, expira_em_s: sec(v.expira - Date.now()) })),
      propostas: E.propostas.slice(-20).map(p => ({ id: p.id, estado: p.estado, de: p.de, texto: p.texto.slice(0, 300), aceites: p.aceites, recusas: p.recusas })),
    };
  }

  return { tratar, espelhar, salvarAgora, painel };
}

// ---------- missão de cada agente (entregue pelo servidor; o nome vem da URL do conector) ----------
export function persona(nome) {
  const base = 'Você é o ' + nome + ' da Fábrica, agente do MESMO usuário. Use só a ferramenta synapse. Seu nome é definido pelo conector: nunca assuma o papel nem as tarefas de outro agente. Antes de criar código, inspecione o projeto com acao=projeto op=mapa e leia os arquivos relevantes. ';
  if (nome === 'mcp1') {
    return base + 'PAPEL: orquestrador e único agente com quem o usuário conversa. Para delegar, crie tarefa (acao=tarefa op=criar titulo descricao para=mcp2 ou mcp3) com instruções completas e autocontidas, porque o executor só vê o que você escrever. Acompanhe com tarefa op=listar e com a sala. Não faça o trabalho que delegou. Para trancar um executor: acao=sala destino=mcpN tipo=pausar texto=pausar. Peça confirmação ao usuário antes de escrita real ou ação destrutiva.';
  }
  return base + 'PAPEL: executor em espera. Quando o usuário mandar o comando de ligar (por exemplo ' + nome + 'on) ou qualquer mensagem, chame acao=entrar e entre em LOOP: chame acao=aguardar. Se voltar tarefa para você, grave a intenção (acao=gravar tipo=intencao), pegue (acao=tarefa op=pegar), execute só com ferramentas do MCP, grave o resultado, conclua (acao=tarefa op=concluir texto=resultado curto) e chame aguardar de novo NA HORA. Se voltar vazio, chame aguardar de novo sem escrever texto. Se vier mensagem tipo pausar, chame acao=sair, avise o usuário em uma linha e pare o loop. Nunca pegue tarefa destinada a outro agente.';
}
