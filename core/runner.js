import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

process.once('message', async ({ dir, inputs, simular }) => {
  const escritos = [];
  const base = process.env.FABRICA_BASE || os.homedir();
  const ctx = {
    simular, raiz: RAIZ, pasta: dir,
    log: (...a) => process.send({ t: 'log', msg: a.join(' ') }),
    resolver: p => {
      p = String(p).trim();
      if (p === '~' || p.startsWith('~/')) p = path.join(os.homedir(), p.slice(1));
      return path.resolve(base, p);
    },
    ler: p => fs.readFileSync(ctx.resolver(p), 'utf8'),
    escrever: (p, conteudo) => {
      const abs = ctx.resolver(p);
      escritos.push(abs);
      if (!simular) { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, conteudo); }
      return abs;
    },
    backup: p => {
      const abs = ctx.resolver(p);
      if (simular || !fs.existsSync(abs)) return null;
      const dest = path.join(RAIZ, '.historico', new Date().toISOString().replace(/[:.]/g, '-'), path.basename(abs));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(abs, dest, { recursive: true });
      return dest;
    },
  };
  const fim = obj => process.send(obj, () => process.exit(0));
  try {
    const mod = await import(pathToFileURL(path.join(dir, 'index.js')).href);
    if (typeof mod.run !== 'function') throw new Error('index.js precisa exportar "run".');
    let res = await mod.run(inputs, ctx);
    if (typeof res === 'string') res = { markdown: res };
    res = res || {};
    res.arquivos = res.arquivos || escritos;
    res.simulado = !!simular;
    fim({ t: 'done', result: res });
  } catch (e) {
    fim({ t: 'err', msg: e && e.message ? e.message : String(e), stack: e && e.stack ? e.stack : '' });
  }
});
