function parseIds(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
  return [...new Set(list.map(x => String(x).trim()).filter(Boolean))];
}
function textOf(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') for (const k of ['conteudo','content','texto','text','trecho']) if (typeof value[k] === 'string') return value[k];
  return value == null ? '' : JSON.stringify(value);
}
function bytes(s) { return new TextEncoder().encode(s).length; }
function clipped(s, max) { let out=''; for (const ch of s) { if (bytes(out+ch)>max) break; out+=ch; } return out; }
function slug(s) { return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function readPath(ctx, rel) { const base=String(ctx.raiz||'').replace(/\/$/,''); return ctx.ler(base+'/'+rel.replace(/^\/+/,'')); }
export async function run(entradas={},ctx) {
  const ids=parseIds(entradas.ids), quarantine=new Set(parseIds(entradas.quarentena_ids));
  const safe=ids.filter(id=>/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)&&id!=='_modelo');
  const rows=[], details=new Map();
  for (const id of safe) {
    if (quarantine.has(id)) { rows.push(`- ${id} | — | em quarentena | indicado por quarentena_ids`); continue; }
    let raw;
    try { raw=textOf(await readPath(ctx,`tools/${id}/manifest.json`)); }
    catch { rows.push(`- ${id} | — | sem manifest | não foi possível ler manifest.json; confira a pasta`); continue; }
    let m;
    try { m=JSON.parse(raw); } catch { rows.push(`- ${id} | — | manifest inválido | JSON não parseável`); continue; }
    if (!m||typeof m!=='object'||Array.isArray(m)) { rows.push(`- ${id} | — | manifest inválido | raiz não é objeto`); continue; }
    const name=String(m.nome||m.name||id), tests=Array.isArray(m.testes)?m.testes:Array.isArray(m.tests)?m.tests:[];
    let state=tests.length?'ok':'sem testes no manifest'; const issues=tests.length?[]:['testes ausentes'];
    try { const r=textOf(await readPath(ctx,`tools/${id}/README.md`)); if (!r.trim()||/placeholder|TODO|__NOME__|descreva aqui/i.test(r)) { state='README ainda placeholder'; issues.push('README vazio ou placeholder'); } }
    catch { state='README ainda placeholder'; issues.push('README não encontrado'); }
    details.set(id,{desc:slug(`${name} ${m.descricao||m.description||''}`)});
    rows.push(`- ${id} | ${name} | ${state} | ${issues.join('; ')||'nenhum problema detectado'}`);
  }
  let catalog=''; try { catalog=textOf(await readPath(ctx,'CATALOGO-FERRAMENTAS.md')); } catch {}
  const entries=[];
  for (const m of catalog.matchAll(/^###\s+T(\d+)\s+([^\n]+)/gm)) {
    const name=m[2].replace(/[?✓~]+\s*$/,'').trim();
    entries.push([`T${String(Number(m[1])).padStart(2,'0')}`,name,slug(name)]);
  }
  if (!entries.length) for (let n=1;n<=37;n++) entries.push([`T${String(n).padStart(2,'0')}`,'nome no catálogo indisponível','']);
  const known=new Set(safe), missing=entries.filter(([,name,id])=>!known.has(id)).map(([tid,name])=>`- ${tid} ${name}`);
  const dupes=[];
  for (const id of safe) if (/-v\d+$/i.test(id)) dupes.push(`- ${id}: sufixo de versão sugere redundância; revisar contra a versão-base.`);
  const groups=new Map();
  for (const [id,v] of details) { const key=v.desc.replace(/-(v\d+|ferramenta|tool)-/g,'-'); if(key.length>8){if(!groups.has(key))groups.set(key,[]);groups.get(key).push(id);} }
  for (const g of groups.values()) if(g.length>1) dupes.push(`- ${g.join(', ')}: nomes/descrições iguais após normalização; revisar possível redundância.`);
  const limit=ids.length?'':'\n\n> Limite: ctx.* não enumera diretórios. Passe os IDs retornados por acao=listar em `ids`; use `quarentena_ids` para a pasta de quarentena.';
  const report=`# Auditoria de tools/\n\n## Ferramentas (${safe.length})\n${rows.join('\n')||'- Nenhum ID informado.'}\n\n## Duplicadas ou redundantes\n${dupes.join('\n')||'- Nenhuma detectada pelos critérios automáticos.'}\n\n## Faltam do catálogo\n${missing.join('\n')||'- Nenhum T01–T37 ausente entre os IDs informados.'}${limit}`;
  return clipped(report,6000);
}
