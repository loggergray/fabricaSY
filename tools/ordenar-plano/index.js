const DONE = new Set(['concluido','concluida','feito','feita','done','complete','completed','ok','finalizado','finalizada']);
function norm(s) { return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }
function parseLine(line) {
  const p=line.split('|').map(s=>s.trim());
  if (p.length<2 || !p[0] || !p[1]) return null;
  let deps=[]; let state='pendente';
  for (const x of p.slice(2)) {
    const d=x.match(/^depende\s*:\s*(.*)$/i);
    const st=x.match(/^estado\s*:\s*(.*)$/i);
    if (d) deps=d[1].split(/[\s,;]+/).filter(v=>v && v!=='-' && v!=='—');
    else if (st) state=st[1]||'pendente';
    else if (!deps.length && p.length===3) state=x||'pendente';
    else if (p.length>=4 && x===p[p.length-1]) state=x||'pendente';
  }
  return {id:p[0],title:p[1],deps,state,done:DONE.has(norm(state))};
}
export async function run(entradas={}) {
  const raw=String(entradas.plano||'');
  const lines=raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const nodes=[], invalid=[]; const first=new Map(), duplicate=new Set();
  for (let i=0;i<lines.length;i++) {
    const node=parseLine(lines[i]);
    if (!node) { invalid.push(`linha ${i+1}: formato esperado id | título | depende: ids | estado`); continue; }
    if (first.has(node.id)) { duplicate.add(node.id); invalid.push(`linha ${i+1}: ID duplicado ${node.id}`); continue; }
    first.set(node.id,node); nodes.push(node);
  }
  const completed=new Set(nodes.filter(n=>n.done).map(n=>n.id));
  const pending=nodes.filter(n=>!n.done && !duplicate.has(n.id));
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const missing=new Map();
  for (const n of pending) { const m=n.deps.filter(d=>!byId.has(d)); if(m.length) missing.set(n.id,m); }
  const scheduled=new Set(); const order=[];
  let progress=true;
  while(progress) {
    progress=false;
    for (const n of pending) {
      if (scheduled.has(n.id) || missing.has(n.id)) continue;
      const ready=n.deps.every(d=>completed.has(d)||scheduled.has(d));
      if(ready){scheduled.add(n.id);order.push(n);progress=true;}
    }
  }
  const remaining=new Set(pending.filter(n=>!scheduled.has(n.id)).map(n=>n.id));
  const cycles=[], color=new Map(), stack=[];
  function visit(id) {
    if(color.get(id)===2) return;
    if(color.get(id)===1){const at=stack.indexOf(id);const c=stack.slice(at).concat(id).join(' → ');if(!cycles.includes(c))cycles.push(c);return;}
    color.set(id,1);stack.push(id);
    const node=byId.get(id);
    for(const d of node?.deps||[]) if(remaining.has(d)) visit(d);
    stack.pop();color.set(id,2);
  }
  for(const id of remaining) visit(id);
  const cycleNodes=new Set(cycles.flatMap(c=>c.split(' → ')));
  const blockers=[];
  for(const n of pending.filter(x=>!scheduled.has(x.id))) {
    if(missing.has(n.id)) blockers.push(`- ${n.id} — ${n.title}: dependência inexistente (${missing.get(n.id).join(', ')}).`);
    else if(cycleNodes.has(n.id)) blockers.push(`- ${n.id} — ${n.title}: participa de ciclo.`);
    else blockers.push(`- ${n.id} — ${n.title}: depende de item ainda não concluído (${n.deps.filter(d=>!completed.has(d)).join(', ')||'estado/duplicidade'}).`);
  }
  const total=nodes.length, done=completed.size, pct=total?Math.round(done*100/total):0;
  const next=order[0];
  const out=[`# Sequenciamento do plano`,``,`## Ordem sugerida`,...(order.length?order.map((n,i)=>`${i+1}. ${n.id} — ${n.title} (${n.state})`):['- Nenhum item liberado para execução.']),``,`## Próximo passo`,next?`${next.id} — ${next.title}`:'Nenhum: resolva os bloqueios ou adicione itens.',``,`## Bloqueios`,...(blockers.length?blockers:['- Nenhum bloqueio detectado.']),``,`## Ciclos`,...(cycles.length?cycles.map(c=>`- Ciclo: ${c}`):['- Nenhum ciclo detectado.']),``,`## Progresso`,`${done}/${total} concluídos (${pct}%).`,...(invalid.length?[``,`## Linhas inválidas`,...invalid.map(x=>`- ${x}`)]:[])];
  let report=out.join('\n');
  const enc=new TextEncoder();
  while(enc.encode(report).length>6000) report=report.slice(0,Math.max(0,report.length-100))+'\n\n[relatório truncado: reduza o plano]';
  return report;
}
