import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const EXTENSOES = new Set(['.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.css', '.html', '.svg']);
const IGNORAR_DIR = new Set(['node_modules', '.git', '.historico', '_modelo', '_quarentena']);
const SIGILO_NOME = /(^|[._-])(\.env|secret|credential|token|private-key|id_rsa)([._-]|$)/i;
const PADROES_SEGREDO = [
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/i,
  /\b(?:sk|pk|ghp|gho|ghu|ghs|github_pat|AIza)[-_][A-Za-z0-9_-]{20,}\b/,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*['"`][A-Za-z0-9_./+=-]{16,}['"`]/i
];
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zip(entries) {
  const locals = [], centrals = []; let offset = 0;
  const now = new Date(), dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const item of entries) {
    const name = Buffer.from(item.name.replace(/\\/g, '/'), 'utf8');
    const raw = Buffer.from(item.text, 'utf8'), packed = zlib.deflateRawSync(raw, { level: 6 }), crc = crc32(raw);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8); local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, name, packed);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(dosTime, 12); central.writeUInt16LE(dosDate, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42);
    centrals.push(central, name); offset += local.length + name.length + packed.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, end]);
}
function arquivosTool(ctx) {
  const base = path.join(ctx.raiz, 'tools');
  const saida = [], omitidos = [];
  function walk(abs, rel) {
    for (const item of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const local = path.join(abs, item.name), caminho = path.posix.join(rel, item.name);
      if (item.isSymbolicLink() || IGNORAR_DIR.has(item.name) || SIGILO_NOME.test(item.name)) { if (item.isFile()) omitidos.push(caminho); continue; }
      if (item.isDirectory()) { if (!item.name.startsWith('.') && !item.name.startsWith('_')) walk(local, caminho); continue; }
      if (!item.isFile() || !EXTENSOES.has(path.extname(item.name).toLowerCase())) continue;
      let text;
      try { text = ctx.ler(local); } catch { omitidos.push(caminho); continue; }
      if (PADROES_SEGREDO.some(re => re.test(text))) { omitidos.push(caminho); continue; }
      saida.push({ name: caminho, text });
    }
  }
  for (const d of fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!d.isDirectory() || d.isSymbolicLink() || d.name.startsWith('.') || d.name.startsWith('_') || IGNORAR_DIR.has(d.name)) continue;
    walk(path.join(base, d.name), `tools/${d.name}`);
  }
  return { saida, omitidos };
}
function instalarBlobUI(ctx) {
  const arquivo = path.join(ctx.raiz, 'public', 'app.js');
  let app = ctx.ler(arquivo);
  if (app.includes('r.zipDownload && r.zipDownload.base64')) return false;
  const anchor = "    } else if (m.t === 'err') {";
  if (!app.includes(anchor)) throw new Error('Ponto de inserção da UI não encontrado. Onde: public/app.js. Como corrigir: reabra o mapa do projeto e revise a versão do painel.');
  const insert = `      if (r.zipDownload && r.zipDownload.base64) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'prim'; b.textContent = 'Baixar ZIP';
        b.addEventListener('click', () => { try {
          const bin = atob(r.zipDownload.base64), bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const blob = new Blob([bytes], { type: r.zipDownload.mime || 'application/zip' });
          const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = r.zipDownload.filename || 'ferramentas.zip';
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch (e) { aviso('Falha no download ZIP: ' + e.message); } });
        res.appendChild(b);
      }
`;
  ctx.backup(arquivo);
  ctx.escrever(arquivo, app.replace(anchor, insert + anchor));
  return true;
}

export async function run(_entradas = {}, ctx) {
  const { saida, omitidos } = arquivosTool(ctx);
  if (ctx.simular) return `# Simulação do ZIP\n\n- Arquivos elegíveis: ${saida.length}\n- Arquivos omitidos por nome sensível, segredo detectado ou leitura bloqueada: ${omitidos.length}\n- Interface: ${ctx.ler(path.join(ctx.raiz, 'public', 'app.js')).includes('r.zipDownload && r.zipDownload.base64') ? 'Blob já instalado' : 'instalaria botão Baixar ZIP'}\n\nNenhum arquivo foi gravado nem compactado.`;
  const patch = instalarBlobUI(ctx);
  if (!saida.length) throw new Error('Nenhum arquivo elegível. Onde: tools/. Como corrigir: confirme que existem pastas de ferramentas com arquivos de texto permitidos.');
  const bytes = zip(saida);
  if (bytes.length > 12000000) throw new Error('ZIP ultrapassa 12 MB. Onde: exportação. Como corrigir: divida a exportação por famílias em execuções separadas.');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  ctx.log(`ZIP pronto em memória: ${saida.length} arquivos; ${omitidos.length} omitidos; ${bytes.length} bytes.`);
  return { markdown: `# Exportação ZIP pronta\n\n- Ferramentas empacotadas: ${saida.length} arquivo(s).\n- Conteúdo sensível omitido: ${omitidos.length} arquivo(s) (somente caminhos, sem valores).\n- Tamanho: ${bytes.length} bytes.\n- Interface Blob: ${patch ? 'instalada; atualize/recarregue o painel antes de baixar' : 'já estava instalada'}.\n\nExecute esta ferramenta no painel após recarregar e toque em **Baixar ZIP**.`, zipDownload: { filename: `ferramentas-${stamp}.zip`, mime: 'application/zip', base64: bytes.toString('base64') }, simulado: false };
}
