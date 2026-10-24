const NL = String.fromCharCode(10);
const CHUNK = 250000;
const PRESETS = {
  tudo: 'chat, menções, testes, backlog, ideias e decisões',
  testes: 'testes e critérios de aceite',
  backlog: 'backlog e prioridades',
  ideias: 'ideias',
  decisoes: 'decisões técnicas',
  chat: 'o chat do livro e as menções'
};

async function ponte(ctx, ferramenta, args) {
  const p = await import('../pokyoemon-kyodevor-ponte/index.js');
  return p.run({ acao: 'chamar', url: '', ferramenta: ferramenta, argumentos: JSON.stringify(args), sem_corte: true }, ctx);
}

function corpo(r) {
  if (r.includes('marcou esta resposta como erro')) {
    const k = r.indexOf('ERRO');
    throw new Error('O KyDevor recusou. ' + (k >= 0 ? r.slice(k, k + 300) : '') + ' Onde: ferramenta do KyDevor. Corrija: confira os campos.');
  }
  const k = r.indexOf('Resposta:');
  return k < 0 ? r : r.slice(k + 9).trim();
}

function jsonDe(r) {
  const t = corpo(r);
  try { return JSON.parse(t); } catch (e) { return null; }
}

function plano(s) {
  return Array.from(String(s || '').normalize('NFD')).filter((c) => { const k = c.charCodeAt(0); return k < 768 || k > 879; }).join('').toLowerCase().trim();
}

function soId(s) {
  return Array.from(plano(s)).map((c) => (/[a-z0-9]/.test(c) ? c : '-')).join('').slice(0, 60);
}

function escolherLivro(livros, bruto) {
  const alvo = plano(bruto || 'pokemon');
  const b = livros.find((x) => plano(x.id) === alvo || plano(x.nome) === alvo);
  if (!b) throw new Error('Livro ' + bruto + ' não existe. Onde: campo livro. Corrija: use um destes: ' + livros.map((x) => x.id).join(', ') + '.');
  return b.id;
}

async function livrosDoKyodevor(ctx) {
  const j = jsonDe(await ponte(ctx, 'livro', { acao: 'listar' }));
  return (j && j.livros) || [];
}

async function listaDocs(ctx, livro) {
  const j = jsonDe(await ponte(ctx, 'painel_ler', { secao: 'docs', livro: livro }));
  return Array.isArray(j) ? j : [];
}

async function acharDoc(ctx, livro, bruto) {
  const ref = String(bruto || '').trim();
  if (!ref) throw new Error('Informe o documento. Onde: campo doc. Corrija: use o id ou parte do título (veja acao=catalogo).');
  const docs = await listaDocs(ctx, livro);
  const alvo = plano(ref);
  let achados = docs.filter((d) => d.id === ref || plano(d.titulo) === alvo);
  if (!achados.length) achados = docs.filter((d) => plano(d.titulo).includes(alvo));
  if (achados.length !== 1) {
    const motivo = achados.length ? 'Mais de um documento combina com ' + ref + ': ' + achados.slice(0, 6).map((d) => d.id + ' ' + d.titulo).join('; ') : 'Documento ' + ref + ' não encontrado no livro ' + livro + '.';
    throw new Error(motivo + ' Onde: campo doc. Corrija: use o id exato (acao=catalogo).');
  }
  return achados[0];
}

async function conteudoDoc(ctx, id) {
  const j = jsonDe(await ponte(ctx, 'painel_ler', { secao: 'doc', id: id }));
  if (!j || typeof j.content !== 'string') throw new Error('Não consegui ler o conteúdo do documento ' + id + '. Onde: painel_ler. Corrija: confira o id.');
  return j;
}

function dividir(txt, max) {
  const partes = [];
  let resto = txt;
  while (resto.length > max) {
    let corte = resto.lastIndexOf(NL, max);
    if (corte < max * 0.5) corte = max;
    partes.push(resto.slice(0, corte));
    resto = resto.slice(corte);
  }
  if (resto.length) partes.push(resto);
  return partes;
}

async function mongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MongoDB indisponível. Onde: variável MONGODB_URI. Corrija: configure no Render.');
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 6000, connectTimeoutMS: 5000, socketTimeoutMS: 20000 });
  await client.connect();
  return { client, col: client.db(process.env.MONGODB_DB || 'synapse').collection('kyodevor_envios') };
}

async function avisar(ctx, entradas, livro, titulo, n) {
  if (String(entradas.avisar) !== 'sim') return '';
  const foco = PRESETS[String(entradas.preset_aviso || 'tudo')] || PRESETS.tudo;
  const texto = '@mcp1 @mcp2 @mcp3 Novo documento no livro ' + livro + ': ' + titulo + (n > 1 ? ' (' + n + ' partes)' : '') + '. Não leiam inteiro: usem a ferramenta Documentos do KyDevor com acao=buscar e acao=ler por fatias. Organizem: ' + foco + '. mcp1 coordena, mcp2 e mcp3 executam.';
  const c = { acao: 'enviar', livro: livro, texto: texto };
  if (entradas.agente) c.agente = String(entradas.agente).trim();
  await ponte(ctx, 'chat', c);
  return NL + NL + 'Aviso enviado no chat do livro ' + livro + ' (foco: ' + foco + ').';
}

async function enviarTexto(ctx, entradas, livro, texto) {
  const titulo = String(entradas.titulo || '').trim();
  if (!titulo) throw new Error('Informe o título. Onde: campo titulo. Corrija: preencha o título do documento.');
  if (!texto.trim()) throw new Error('Documento vazio. Onde: campo conteudo. Corrija: cole o texto ou use acao=parte e acao=fechar.');
  const tags = String(entradas.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
  const partes = dividir(texto, CHUNK);
  if (partes.length > 1 && entradas.doc) throw new Error('Documento grande demais para atualizar um só (' + partes.length + ' partes). Onde: campo doc. Corrija: deixe doc vazio para criar as partes.');
  const saida = [];
  for (let i = 0; i < partes.length; i++) {
    const t = partes.length === 1 ? titulo : titulo + ' · parte ' + (i + 1) + '/' + partes.length;
    const args = { acao: 'salvar', livro: livro, titulo: t, conteudo: partes[i], tags: partes.length === 1 ? tags : tags.concat(['parte']) };
    if (partes.length === 1 && entradas.doc) args.id = (await acharDoc(ctx, livro, entradas.doc)).id;
    const j = jsonDe(await ponte(ctx, 'doc', args));
    saida.push('- ' + t + ' (' + partes[i].length + ' caracteres): ' + ((j && j.id) ? j.id : 'enviado'));
  }
  const aviso = await avisar(ctx, entradas, livro, titulo, partes.length);
  return ['# Documento enviado ao livro ' + livro, '', texto.length + ' caracteres em ' + partes.length + ' documento(s):', '', saida.join(NL)].join(NL) + aviso;
}

async function catalogo(ctx, entradas) {
  const tipo = String(entradas.tipo_catalogo || 'tudo');
  const livros = await livrosDoKyodevor(ctx);
  const L = ['# Catálogo do KyDevor', ''];
  if (tipo === 'tudo' || tipo === 'livros') {
    L.push('## Livros');
    livros.forEach((b) => L.push('- ' + b.id + ': ' + b.nome));
    L.push('');
  }
  const livro = escolherLivro(livros, entradas.livro);
  if (tipo === 'tudo' || tipo === 'docs') {
    const docs = await listaDocs(ctx, livro);
    L.push('## Documentos do livro ' + livro + ' (' + docs.length + ')');
    docs.slice(0, 60).forEach((d) => L.push('- ' + d.id + ' · ' + d.titulo + ' (' + d.caracteres + ' caracteres)'));
    L.push('');
  }
  if (tipo === 'tudo' || tipo === 'chat') {
    const j = jsonDe(await ponte(ctx, 'chat', { acao: 'ler', livro: livro, limite: 12 }));
    const msgs = Array.isArray(j) ? j : [];
    L.push('## Chat do livro ' + livro + ' (últimas ' + msgs.length + ')');
    msgs.forEach((m) => L.push('- ' + m.id + ' · ' + m.de + ': ' + String(m.texto || '').split(NL).join(' ').slice(0, 110)));
  }
  return L.join(NL);
}

export async function run(entradas, ctx) {
  const acao = String(entradas.acao || 'catalogo');
  const validas = ['catalogo', 'enviar', 'parte', 'fechar', 'ler', 'buscar'];
  if (!validas.includes(acao)) throw new Error('Ação inválida. Onde: campo acao. Corrija: use ' + validas.join(', ') + '.');
  if (ctx.simular) return ['# Simulação', '', 'Ação ' + acao + '. Nada seria lido nem enviado.'].join(NL);
  if (acao === 'catalogo') return catalogo(ctx, entradas);

  if (acao === 'parte') {
    const envio = soId(entradas.envio);
    const texto = String(entradas.conteudo || '');
    if (!envio || !texto) throw new Error('Informe envio e conteudo. Onde: campos envio e conteudo. Corrija: dê um nome ao envio e cole a parte.');
    const { client, col } = await mongo();
    try {
      const n = (await col.countDocuments({ envio: envio })) + 1;
      await col.insertOne({ envio: envio, n: n, texto: texto, criado_em: new Date().toISOString() });
      return '# Parte ' + n + ' guardada' + NL + NL + 'Envio ' + envio + ': ' + texto.length + ' caracteres nesta parte. Mande a próxima com acao=parte ou termine com acao=fechar.';
    } finally {
      await client.close().catch(() => {});
    }
  }

  const livros = await livrosDoKyodevor(ctx);
  const livro = escolherLivro(livros, entradas.livro);

  if (acao === 'fechar') {
    const envio = soId(entradas.envio);
    if (!envio) throw new Error('Informe envio. Onde: campo envio. Corrija: use o mesmo nome das partes.');
    const { client, col } = await mongo();
    try {
      const itens = await col.find({ envio: envio }).sort({ n: 1 }).toArray();
      if (!itens.length) throw new Error('Nenhuma parte guardada em ' + envio + '. Onde: campo envio. Corrija: envie partes com acao=parte.');
      const r = await enviarTexto(ctx, entradas, livro, itens.map((i) => i.texto).join(''));
      await col.deleteMany({ envio: envio });
      return r;
    } finally {
      await client.close().catch(() => {});
    }
  }

  if (acao === 'enviar') return enviarTexto(ctx, entradas, livro, String(entradas.conteudo || ''));

  const d = await acharDoc(ctx, livro, entradas.doc);
  const doc = await conteudoDoc(ctx, d.id);
  const c = doc.content;

  if (acao === 'ler') {
    const ini = Math.max(0, Number(entradas.inicio || 0));
    const tam = Math.min(Math.max(Number(entradas.tamanho || 6000), 500), 12000);
    const fatia = c.slice(ini, ini + tam);
    const fim = ini + fatia.length;
    return ['# ' + d.titulo, '', 'Fatia ' + ini + ' a ' + fim + ' de ' + c.length + ' caracteres. ' + (fim >= c.length ? 'Fim do documento.' : 'Próxima: inicio=' + fim + '.'), '', fatia].join(NL);
  }

  const q = plano(entradas.consulta);
  if (!q) throw new Error('Informe o termo. Onde: campo consulta. Corrija: preencha o que procurar.');
  const cx = Math.max(0, Math.min(Number(entradas.contexto || 1), 5));
  const linhas = c.split(NL);
  const inicios = [];
  let soma = 0;
  linhas.forEach((l) => { inicios.push(soma); soma += l.length + 1; });
  const achados = [];
  linhas.forEach((l, n) => { if (plano(l).includes(q)) achados.push(n); });
  if (!achados.length) return '# Busca em ' + d.titulo + NL + NL + 'Nenhuma ocorrência de ' + q + ' (documento com ' + c.length + ' caracteres).';
  const blocos = [];
  for (const n of achados.slice(0, 20)) {
    const de = Math.max(0, n - cx);
    const ate = Math.min(linhas.length - 1, n + cx);
    blocos.push('Linha ' + (n + 1) + ' (inicio=' + inicios[n] + '):' + NL + linhas.slice(de, ate + 1).map((l) => l.slice(0, 300)).join(NL));
  }
  return ['# Busca em ' + d.titulo, '', achados.length + ' linha(s) com ' + q + (achados.length > 20 ? ' (mostrando 20)' : '') + '. Use acao=ler com inicio=N para abrir o trecho.', '', blocos.join(NL + NL)].join(NL);
}
