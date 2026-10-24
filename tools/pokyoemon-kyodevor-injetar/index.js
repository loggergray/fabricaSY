const NL = String.fromCharCode(10);
const MAX = 200000;

function lista(v) {
  return String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
}

async function ponte(ctx, ferramenta, args) {
  const p = await import('../pokyoemon-kyodevor-ponte/index.js');
  return p.run({ acao: 'chamar', url: '', ferramenta: ferramenta, argumentos: JSON.stringify(args) }, ctx);
}

function semAcento(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Aceita o id (pokemon) ou o nome do livro (Pokémon Fight Club) e devolve o id real. Livro que não existe dá erro, em vez de criar doc invisível.
async function resolverLivro(ctx, bruto) {
  const r = await ponte(ctx, 'livro', { acao: 'listar' });
  let livros = [];
  try { livros = JSON.parse(r.slice(r.indexOf('{'), r.lastIndexOf('}') + 1)).livros || []; } catch (e) { livros = []; }
  const alvo = semAcento(bruto);
  const achado = livros.find((b) => semAcento(b.id) === alvo || semAcento(b.nome) === alvo);
  if (!achado) throw new Error('Livro "' + bruto + '" não existe. Onde: campo livro. Corrija: use um destes ids: ' + livros.map((b) => b.id).join(', ') + '.');
  return achado.id;
}

// Presets: lista docs (id, título, tags) e as tags mais usadas do livro, sem trazer o conteúdo.
async function listar(ctx, livroBruto) {
  const livroId = await resolverLivro(ctx, livroBruto);
  const r = await ponte(ctx, 'painel_ler', { secao: 'docs', livro: livroId });
  let docs = [];
  try { docs = JSON.parse(r.slice(r.indexOf('['), r.lastIndexOf(']') + 1)); } catch (e) { return r; }
  const cont = {};
  docs.forEach((d) => (d.tags || []).forEach((t) => { cont[t] = (cont[t] || 0) + 1; }));
  const tags = Object.keys(cont).sort((a, b) => cont[b] - cont[a]);
  return ['# Presets do livro ' + livroId, '', '## Documentos (' + docs.length + ')', ...docs.map((d) => '- ' + d.titulo + ' — id ' + d.id + ' — tags: ' + (d.tags || []).join(', ')), '', '## Tags em uso', tags.map((t) => t + ' (' + cont[t] + ')').join(', ') || '(nenhuma)', '', 'Para atualizar um doc, copie o id para o campo doc_id. Mesmo título no mesmo livro também atualiza em vez de duplicar.'].join(NL);
}

export async function run(entradas, ctx) {
  const livro = String(entradas.livro_outro || entradas.livro || 'pokemon').trim();
  if (String(entradas.acao) === 'listar') return listar(ctx, livro);
  const titulo = String(entradas.titulo || '').trim();
  const conteudo = String(entradas.conteudo || '');
  if (ctx.simular) return ['# Simulação', '', 'Enviaria o documento "' + titulo + '" (' + conteudo.length + ' caracteres) ao livro ' + livro + ' do KyDevor. Nada foi enviado.'].join(NL);
  if (!titulo) throw new Error('Informe o título. Onde: campo titulo. Corrija: preencha o título do documento.');
  if (!conteudo.trim()) throw new Error('Documento vazio. Onde: campo conteudo. Corrija: cole o texto.');
  if (conteudo.length > MAX) throw new Error('Documento com ' + conteudo.length + ' caracteres; o limite é ' + MAX + '. Onde: campo conteudo. Corrija: divida em partes.');
  const livroId = await resolverLivro(ctx, livro);
  const args = { acao: 'salvar', livro: livroId, titulo: titulo, conteudo: conteudo, tags: lista(entradas.tags) };
  if (entradas.doc_id) args.id = String(entradas.doc_id).trim();
  const r = await ponte(ctx, 'doc', args);
  let extra = '';
  if (String(entradas.avisar) === 'sim') {
    const texto = '@mcp1 @mcp2 @mcp3 Novo documento no livro ' + livro + ': "' + titulo + '". Leiam e organizem o que ele descreve: chat, menções, testes, backlog, ideias e decisões. mcp1 coordena, mcp2 e mcp3 executam.';
    const c = { acao: 'enviar', livro: livroId, texto: texto };
    if (entradas.agente) c.agente = String(entradas.agente).trim();
    extra = NL + NL + '--- Aviso no chat ---' + NL + (await ponte(ctx, 'chat', c));
  }
  return r + extra;
}
