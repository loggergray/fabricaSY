import fs from 'node:fs';
import path from 'node:path';

const TIPOS = ['texto', 'areatexto', 'caminho', 'opcoes', 'booleano', 'numero'];

export class Loader {
  constructor(dir) { this.dir = dir; this.tools = new Map(); this.sig = ''; }

  pastas() {
    try {
      return fs.readdirSync(this.dir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !/^[_.]/.test(d.name)).map(d => d.name).sort();
    } catch { return []; }
  }

  assinatura() {
    let s = '';
    for (const n of this.pastas())
      for (const f of ['manifest.json', 'index.js', 'README.md']) {
        try { s += n + f + fs.statSync(path.join(this.dir, n, f)).mtimeMs + ';'; } catch { s += n + f + '-;'; }
      }
    return s;
  }

  scan() {
    const novo = new Map();
    for (const id of this.pastas()) {
      const dir = path.join(this.dir, id);
      try {
        const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
        if (!fs.existsSync(path.join(dir, 'index.js'))) throw new Error('index.js não encontrado');
        const entradas = (m.entradas || []).map(e => {
          if (!e.nome) throw new Error('entrada sem "nome"');
          if (e.tipo && !TIPOS.includes(e.tipo)) throw new Error(`tipo inválido: ${e.tipo}`);
          return { tipo: 'texto', ...e };
        });
        let doc = '';
        try { doc = fs.readFileSync(path.join(dir, 'README.md'), 'utf8'); } catch {}
        novo.set(id, { id, dir, nome: m.nome || id, icone: m.icone || '🔧', descricao: m.descricao || '',
          versao: m.versao || '0.0.1', tags: m.tags || [], entradas, doc });
      } catch (e) {
        novo.set(id, { id, dir, nome: id, icone: '⚠️', descricao: '', erro: e.message, entradas: [], doc: '' });
      }
    }
    this.tools = novo;
  }

  mudou() {
    const s = this.assinatura();
    if (s === this.sig) return false;
    this.sig = s; this.scan(); return true;
  }

  lista() { return [...this.tools.values()].map(({ dir, ...resto }) => resto); }
}
