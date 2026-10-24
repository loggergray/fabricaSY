import fs from 'node:fs';
import path from 'node:path';

const n = x => Number.isFinite(Number(x)) ? Number(x) : 0;
const fmt = x => `${(n(x) / 1024).toFixed(1)} KiB`;
const safe = s => String(s || '').replace(/[|\n\r]/g, ' ').slice(0, 100);
const mdTable = (headers, rows) => rows.length ? `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map(r => `| ${r.map(safe).join(' | ')} |`).join('\n')}` : '_Ainda não há eventos para este recorte._';

export async function run({ periodo = '7', agente = '' } = {}, ctx) {
  const dir = process.env.DADOS_DIR || path.join(ctx.raiz, 'dados');
  const log = path.join(dir, 'telemetria-contexto-projeto.jsonl');
  const server = path.join(ctx.raiz, 'server.js');
  const instrumentado = (() => { try { return ctx.ler(server).includes('function registrarTelemetriaProjeto('); } catch { return false; } })();
  let eventos = [];
  try {
    const raw = ctx.ler(log);
    eventos = raw.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  } catch {}
  const dias = periodo === 'todos' ? Infinity : Math.max(1, Math.min(3650, n(periodo) || 7));
  const desde = dias === Infinity ? 0 : Date.now() - dias * 86400000;
  const filtro = String(agente || '').trim().toLowerCase();
  eventos = eventos.filter(e => (!filtro || String(e.agente || '').toLowerCase() === filtro) && (!e.hora || Date.parse(e.hora) >= desde));
  const agents = new Map(), files = new Map();
  let maps = 0, searches = 0, scans = 0, scanBytes = 0, snapshotBytes = 0, directReads = 0, readBytes = 0, returnedBytes = 0, partialReads = 0;
  for (const e of eventos) {
    const who = safe(e.agente || 'desconhecido');
    const a = agents.get(who) || { reads: 0, maps: 0, searches: 0, bytes: 0, returned: 0, scanned: 0 };
    if (e.acao === 'ler') {
      directReads++; readBytes += n(e.bytes_arquivo_lido); returnedBytes += n(e.bytes_devolvidos);
      if (n(e.bytes_arquivo_lido) > n(e.bytes_devolvidos) * 2) partialReads++;
      a.reads++; a.bytes += n(e.bytes_arquivo_lido); a.returned += n(e.bytes_devolvidos);
      const f = safe(e.caminho || '(caminho não registrado)');
      const v = files.get(f) || { count: 0, read: 0, returned: 0 };
      v.count++; v.read += n(e.bytes_arquivo_lido); v.returned += n(e.bytes_devolvidos); files.set(f, v);
    } else if (e.acao === 'mapa') { maps++; snapshotBytes += n(e.bytes_snapshot_lidos); a.maps++; a.scanned += n(e.bytes_snapshot_lidos); } else if (e.acao === 'buscar') {
      searches++; scans += n(e.arquivos_varridos); scanBytes += n(e.bytes_varridos); snapshotBytes += n(e.bytes_snapshot_lidos);
      a.searches++; a.scanned += n(e.bytes_snapshot_lidos) + n(e.bytes_varridos); a.returned += n(e.bytes_devolvidos);
    }
    agents.set(who, a);
  }
  const totalBytes = readBytes + scanBytes + snapshotBytes;
  const totalReturned = returnedBytes + eventos.filter(e => e.acao === 'buscar').reduce((s, e) => s + n(e.bytes_devolvidos), 0);
  const agentRows = [...agents.entries()].sort((a,b) => (b[1].bytes + b[1].scanned) - (a[1].bytes + a[1].scanned)).map(([who,x]) => [who, x.reads, x.maps, x.searches, fmt(x.bytes + x.scanned), fmt(x.returned)]);
  const fileRows = [...files.entries()].sort((a,b) => b[1].read - a[1].read).slice(0,15).map(([file,x]) => [file, x.count, fmt(x.read), fmt(x.returned)]);
  const suggestions = [];
  if ((searches || maps) && snapshotBytes > 0) suggestions.push(`Mapas e buscas somaram ${fmt(snapshotBytes)} em snapshots completos; avalie índice/cache ou busca incremental, após validar precisão.`);
  if (partialReads) suggestions.push(`${partialReads} leitura(s) trouxeram um trecho bem menor que o arquivo total; a API atualmente abre o arquivo inteiro para extrair o trecho. Um leitor por faixa/stream pode reduzir I/O e memória.`);
  const large = [...files.entries()].filter(([,v]) => v.read >= 512 * 1024);
  if (large.length) suggestions.push(`${large.length} caminho(s) tiveram pelo menos 512 KiB acumulados; revise se consultas por trechos bastam.`);
  if (!suggestions.length && eventos.length) suggestions.push('Amostra sem sinal forte de desperdício pelos limites deste relatório; isso não prova uso ideal do contexto do modelo.');
  if (!eventos.length) suggestions.push(instrumentado ? 'Patch detectado, mas ainda não há telemetria no período. Faça o servidor carregar a nova versão e gere leituras de projeto.' : 'A instrumentação ainda não está instalada.');
  const status = eventos.length ? 'TELEMETRIA DISPONÍVEL' : instrumentado ? 'INSTRUMENTAÇÃO INSTALADA; AGUARDANDO ATIVAÇÃO/PRIMEIROS EVENTOS' : 'SEM INSTRUMENTAÇÃO';
  const faixa = periodo === 'todos' ? 'todo o histórico' : `últimos ${dias} dia(s)`;
  return `# Dashboard de contexto do projeto\n\n**Estado:** ${status}  \n**Filtro:** ${filtro || 'todos os agentes'} · ${faixa}  \n**Eventos observados:** ${eventos.length}\n\n## Resumo\n\n- Leituras diretas de arquivo: **${directReads}** · arquivo(s) abertos: **${fmt(readBytes)}** · trecho(s) devolvidos: **${fmt(returnedBytes)}**\n- Mapas: **${maps}** · buscas: **${searches}** · arquivo(s) percorridos por busca: **${scans}** · bytes em snapshots: **${fmt(snapshotBytes)}** · bytes na varredura de busca: **${fmt(scanBytes)}**\n- Volume aproximado lido pela aplicação: **${fmt(totalBytes)}** · devolvido em leituras/resultados: **${fmt(totalReturned)}**\n\n## Por agente\n\n${mdTable(['Agente','Leituras','Mapas','Buscas','Volume lido (aprox.)','Volume devolvido'], agentRows)}\n\n## Arquivos mais lidos\n\n${mdTable(['Arquivo','Acessos','Bytes lidos (aprox.)','Bytes devolvidos'], fileRows)}\n\n## Oportunidades para revisar\n\n${suggestions.map(s => `- ${s}`).join('\n') || '- Nenhuma recomendação automática neste recorte.'}\n\n## Limites da medição\n\nMede bytes/linhas de leitura do processo Synapse e o volume das respostas registradas. Não mede tokens, janela interna, conteúdo realmente retido pelo modelo, custo do provedor nem RAM do processo de IA. Buscas gravam só contagens e tamanho, não o termo nem o conteúdo; leituras guardam caminho e medidas, não o trecho. Recomendações são observacionais e não aplicam alterações.`;
}
