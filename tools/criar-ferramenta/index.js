import fs from 'node:fs';
import path from 'node:path';

export async function run({ id, nome, icone, descricao, codigo, manifest_json }, ctx) {
  id = String(id || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error('Identificador inválido: use minúsculas, números e hífen.');
  const destino = path.join(ctx.raiz, 'tools', id);
  if (fs.existsSync(destino)) throw new Error('Já existe tools/' + id + '.');
  const modelo = path.join(ctx.raiz, 'tools', '_modelo');
  const js = s => JSON.stringify(String(s ?? '')).slice(1, -1);
  const subs = (txt, json) => {
    const f = json ? js : x => String(x ?? '');
    return txt.replaceAll('__NOME__', f(nome || id)).replaceAll('__ICONE__', f(icone || '🔧'))
      .replaceAll('__DESCRICAO__', f(descricao || '')).replaceAll('__ID__', id);
  };
  const arquivos = {};
  for (const f of ['manifest.json', 'index.js', 'README.md'])
    arquivos[f] = subs(fs.readFileSync(path.join(modelo, f), 'utf8'), f.endsWith('.json'));
  if (codigo && codigo.trim()) arquivos['index.js'] = codigo.trim() + '\n';
  if (manifest_json && manifest_json.trim()) { JSON.parse(manifest_json); arquivos['manifest.json'] = manifest_json.trim() + '\n'; }
  for (const [f, c] of Object.entries(arquivos)) ctx.escrever(path.join(destino, f), c);
  ctx.log('Pasta tools/' + id + ' ' + (ctx.simular ? '(simulada)' : 'criada'));
  return '# ' + (ctx.simular ? 'Simulação' : 'Ferramenta criada') + '\n\n**' + (nome || id) + '** em `tools/' + id + '`.\n\n' +
    (ctx.simular ? 'Nada foi gravado.' : 'Volte à lista: ela já aparece lá, ao vivo.');
}
