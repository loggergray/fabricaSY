// Monta dist/ a partir de src/ (includes), css/ e js/.  Uso: node build.cjs
const fs = require('fs');
const path = require('path');
const R = __dirname;
const MARC = /<!--@include ([\w\/-]+)(?: (\{[\s\S]*?\}))?-->|\{\{(\w+)\}\}/g;
const ler = f => fs.readFileSync(path.join(R, f), 'utf8');
const resolver = (h, props = {}) => h.replace(MARC, (m, k, j, ph) =>
  ph !== undefined ? (props[ph] ?? '') : resolver(ler('src/' + k + '.html'), j ? JSON.parse(j) : {}));
const listar = dir => {
  const abs = path.join(R, dir); const out = [];
  if (!fs.existsSync(abs)) return out;
  (function v(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name); e.isDirectory() ? v(p) : out.push(path.relative(R, p)); } })(abs);
  return out;
};
const juntar = (dir, ext) => {
  const base = path.join(dir, 'base' + ext);
  return listar(dir).filter(f => f.endsWith(ext))
    .sort((a, b) => ((a === base ? 0 : 1) - (b === base ? 0 : 1)) || a.localeCompare(b))
    .map(f => '/* ' + f + ' */\n' + ler(f)).join('\n');
};
fs.mkdirSync(path.join(R, 'dist'), { recursive: true });
const css = juntar('css', '.css'); const js = juntar('js', '.js');
if (css.trim()) fs.writeFileSync(path.join(R, 'dist/style.css'), css);
if (js.trim()) fs.writeFileSync(path.join(R, 'dist/app.js'), js);
let pagina = ler('src/pagina.html')
  .replace('<!--@estilos-->', () => css.trim() ? '<link rel="stylesheet" href="style.css">' : '')
  .replace('<!--@scripts-->', () => js.trim() ? '<script src="app.js"></script>' : '');
fs.writeFileSync(path.join(R, 'dist/index.html'), resolver(pagina));
console.log('dist/ gerado: index.html' + (css.trim() ? ', style.css' : '') + (js.trim() ? ', app.js' : ''));
