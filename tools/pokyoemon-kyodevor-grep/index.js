const NL = String.fromCharCode(10);

async function ponte(ctx, ferramenta, args) {
  const p = await import('../pokyoemon-kyodevor-ponte/index.js');
  return p.run({ acao: 'chamar', url: '', ferramenta: ferramenta, argumentos: JSON.stringify(args) }, ctx);
}

export async function run(entradas, ctx) {
  const path = String(entradas.path || '').trim();
  const ref = String(entradas.ref || 'kyodevorpokemonsyfabricasy').trim();
  const q = String(entradas.consulta || '').toLowerCase();
  const cx = Math.max(0, Math.min(Number(entradas.contexto || 3), 15));
  if (ctx.simular) return ['# Simulação', '', 'Buscaria "' + q + '" em ' + path + ' (' + ref + '). Nada foi lido.'].join(NL);
  if (!path || !q) throw new Error('Informe path e consulta. Onde: campos path e consulta. Corrija: preencha os dois.');
  const bruto = await ponte(ctx, 'gh_ler', { paths: [path], ref: ref });
  const todas = bruto.split(NL);
  const ini = todas.findIndex((l) => l.startsWith('=== '));
  if (ini < 0) return bruto.slice(0, 2000);
  const linhas = todas.slice(ini + 1);
  const marcadas = new Set();
  let achou = 0;
  linhas.forEach((l, n) => {
    if (l.toLowerCase().includes(q)) {
      achou++;
      for (let k = Math.max(0, n - cx); k <= Math.min(linhas.length - 1, n + cx); k++) marcadas.add(k);
    }
  });
  if (!achou) return '# Busca em ' + path + NL + NL + 'Nenhuma ocorrência de "' + q + '" (arquivo com ' + linhas.length + ' linhas).';
  const ordem = Array.from(marcadas).sort((a, b) => a - b).slice(0, 150);
  const saida = [];
  let ant = -2;
  for (const n of ordem) {
    if (n !== ant + 1) saida.push('...');
    saida.push((n + 1) + ': ' + linhas[n].slice(0, 220));
    ant = n;
  }
  return ['# Busca em ' + path + ' (' + ref + ')', '', achou + ' linha(s) com "' + q + '"; arquivo com ' + linhas.length + ' linhas.', '', saida.join(NL)].join(NL);
}
