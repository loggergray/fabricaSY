import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ID_OK = /^ext-[a-z0-9][a-z0-9-]{0,46}$/;
const SUB_OK = /^[a-z0-9][a-z0-9/_-]{0,80}$/i;
const TIMEOUT_MS = Number(process.env.EXT_TIMEOUT_MS) || 30000;
const TIQUE_MS = Number(process.env.EXT_TIQUE_MS) || 5000;

export function criarExtensoes({ raiz, contexto = {} }) {
  const pasta = path.join(raiz, 'artefatos', 'scripts');
  const ativas = new Map();
  let varrendo = false, tiqueando = false, tVarrer = null, tTique = null;

  const log = (...a) => console.log('[extensoes]', ...a);
  const erro = (...a) => console.error('[extensoes]', ...a);
  const ctxExt = id => ({ ...contexto, id, log: (...a) => log(id, ...a) });
  const arquivo = id => path.join(pasta, id, 'index.mjs');
  const json = (res, obj, code, headers) => contexto.responderJson
    ? contexto.responderJson(res, obj, code, headers)
    : (res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...headers }), res.end(JSON.stringify(obj)));

  function ids() {
    try {
      return fs.readdirSync(pasta, { withFileTypes: true })
        .filter(d => d.isDirectory() && ID_OK.test(d.name)).map(d => d.name).sort();
    } catch { return []; }
  }
  function assinatura(id) {
    try {
      const s = fs.lstatSync(arquivo(id));
      return s.isFile() && !s.isSymbolicLink() ? s.mtimeMs + ':' + s.size : null;
    } catch { return null; }
  }
  function validarRotas(id, rotas = []) {
    if (!Array.isArray(rotas)) throw new Error('"rotas" precisa ser um array.');
    return rotas.map((r, i) => {
      const metodo = String(r.metodo || 'GET').toUpperCase();
      if (!['GET', 'POST'].includes(metodo)) throw new Error(`rota ${i}: método inválido`);
      const sub = String(r.caminho || '').replace(/^\/+/, '');
      if (!SUB_OK.test(sub) || sub.includes('//')) throw new Error(`rota ${i}: caminho inválido`);
      if (typeof r.tratar !== 'function') throw new Error(`rota ${i}: falta "tratar"`);
      return { id, metodo, caminho: `/api/ext/${id}/${sub}`, tratar: r.tratar, semTimeout: !!r.semTimeout };
    });
  }
  async function descarregar(id) {
    const e = ativas.get(id);
    ativas.delete(id);
    if (e?.mod && typeof e.mod.parar === 'function') {
      try { await e.mod.parar(); } catch (err) { erro(id, 'parar falhou:', err.message); }
    }
  }
  async function carregar(id, sig) {
    const antigo = ativas.get(id);
    let antigoParado = false;
    try {
      const mod = await import(pathToFileURL(arquivo(id)).href + '?v=' + encodeURIComponent(sig));
      const rotas = validarRotas(id, mod.rotas);
      if (antigo) { await descarregar(id); antigoParado = true; }
      if (typeof mod.iniciar === 'function') await mod.iniciar(ctxExt(id));
      ativas.set(id, { id, sig, mod, rotas, erro: null, desde: new Date().toISOString() });
      log('carregada', id, rotas.length + ' rota(s)');
    } catch (err) {
      erro(id, 'falhou ao carregar:', err.message);
      if (antigo && !antigoParado) ativas.set(id, { ...antigo, sig, erro: err.message });
      else ativas.set(id, { id, sig, mod: null, rotas: [], erro: err.message, desde: null });
    }
  }
  async function varrer() {
    if (varrendo) return;
    varrendo = true;
    try {
      const presentes = new Set(ids());
      for (const id of [...ativas.keys()]) {
        if (!presentes.has(id) || assinatura(id) === null) { await descarregar(id); log('removida', id); }
      }
      for (const id of presentes) {
        const sig = assinatura(id);
        if (!sig) continue;
        const atual = ativas.get(id);
        if (!atual || atual.sig !== sig) await carregar(id, sig);
      }
    } finally { varrendo = false; }
  }
  async function tique() {
    if (tiqueando) return;
    tiqueando = true;
    try {
      for (const e of ativas.values()) {
        if (typeof e.mod?.aCadaTick !== 'function') continue;
        try { await e.mod.aCadaTick(ctxExt(e.id)); } catch (err) { erro(e.id, 'aCadaTick:', err.message); }
      }
    } finally { tiqueando = false; }
  }
  function estado() {
    return [...ativas.values()].map(e => ({
      id: e.id, rotas: e.rotas.map(r => r.metodo + ' ' + r.caminho), erro: e.erro || null, desde: e.desde || null,
    }));
  }
  async function iniciar() {
    if (process.env.EXTENSOES === 'off') { log('desligadas por EXTENSOES=off'); return; }
    await Promise.race([varrer(), new Promise(r => setTimeout(r, 10000))]);
    tVarrer = setInterval(() => varrer().catch(e => erro('varredura:', e.message)), 2000); tVarrer.unref();
    tTique = setInterval(() => tique().catch(e => erro('tique:', e.message)), TIQUE_MS); tTique.unref();
  }
  async function parar() {
    clearInterval(tVarrer); clearInterval(tTique);
    for (const id of [...ativas.keys()]) await descarregar(id);
  }
  async function tratar(req, res, { url, pathname, headers }) {
    if (pathname === '/api/ext' && req.method === 'GET') { json(res, { extensoes: estado() }, 200, headers); return true; }
    const rota = [...ativas.values()].flatMap(e => e.rotas).find(r => r.metodo === req.method && r.caminho === pathname);
    if (!rota) { json(res, { erro: 'Rota de extensão não encontrada.' }, 404, headers); return true; }
    const ctx = { ...ctxExt(rota.id), url, pathname, headers };
    let t;
    try {
      const exec = Promise.resolve(rota.tratar(req, res, ctx));
      if (rota.semTimeout) await exec;
      else await Promise.race([exec, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('Tempo esgotado na extensão.')), TIMEOUT_MS); })]);
    } catch (e) {
      erro(rota.id, e.message);
      const msg = contexto.sanitizar ? contexto.sanitizar(e.message) : e.message;
      if (!res.headersSent) json(res, { erro: msg }, 500, headers);
      else if (!res.writableEnded) res.end();
    } finally { clearTimeout(t); }
    return true;
  }
  return { iniciar, parar, tratar, estado };
}
