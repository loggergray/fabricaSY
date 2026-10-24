import path from 'node:path';
export async function run({ confirmar = false } = {}, ctx) {
  const arquivo = path.join(ctx.raiz, 'server.js');
  let s = ctx.ler(arquivo);
  const a = "      const s = criarSnapshotProjeto();\n      const pastas = {};";
  const b = "      const s = criarSnapshotProjeto();\n      const bytes_snapshot_lidos = s.arquivos.reduce((n,x)=>n+(!x.ignorado && x.extensao !== '.pdf' ? Number(x.bytes||0) : 0),0);\n      registrarTelemetriaProjeto({ agente, acao: 'mapa', arquivos_no_projeto: s.total_arquivos, bytes_snapshot_lidos });\n      const pastas = {};";
  const c = "  const bytes_snapshot = snap.arquivos.reduce((s, x) => s + Number(x.bytes || 0), 0);";
  const d = "  const bytes_snapshot = snap.arquivos.reduce((s,x)=>s+(!x.ignorado && x.extensao !== '.pdf' ? Number(x.bytes||0) : 0),0);";
  if (s.includes("registrarTelemetriaProjeto({ agente, acao: 'mapa'")) throw new Error('Métrica de mapa já instalada; nada alterado.');
  if (s.split(a).length !== 2 || s.split(c).length !== 2) throw new Error('Âncoras não únicas; patch cancelado sem escrita.');
  s = s.replace(a,b).replace(c,d);
  if (ctx.simular) return '# Simulação aprovada — 2 ajustes: mapear varreduras completas por agente e excluir PDF/itens ignorados da soma de bytes de snapshot. Sem escrita.';
  if (!confirmar) return '# Nada gravado — confirme o patch depois da simulação.';
  ctx.backup(arquivo); ctx.escrever(arquivo,s);
  return '# Patch aplicado com backup. Inclui eventos de mapa e soma apenas conteúdo textual efetivamente elegível; aguarda o servidor carregar a fonte atualizada.';
}
