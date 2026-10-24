export async function run(entradas={}, ctx={}) {
  const modo=String(entradas.modo||'resumo');
  if(modo==='ajuda') return [
    '# Consultar MongoDB','',
    'Operações fixas e somente leitura: resumo/contagens, metadados recentes do diário ou caminhos de artefatos.',
    'Não retorna conteúdo do diário, não aceita filtros Mongo arbitrários e nunca mostra URI, host ou erro bruto.',
    'Um ping bem-sucedido indica conectividade atual deste runner; não prova que cada gravação histórica foi persistida nem o estado interno da conexão principal.'
  ].join('\n');
  if(!['resumo','diario_recente','artefatos'].includes(modo)) return 'Modo inválido. Use resumo, diario_recente, artefatos ou ajuda.';
  if(ctx.simular) return 'Simulação: nenhuma consulta foi feita e nenhuma variável/conexão de rede foi usada.';
  const uri=process.env.MONGODB_URI;
  if(typeof uri!=='string'||!uri.trim()) return 'Consulta indisponível: MONGODB_URI não está disponível para o runner. Nenhum segredo foi exibido.';
  const quantidade=Math.min(20,Math.max(1,Number(entradas.quantidade)||10));
  let client;
  try {
    const {MongoClient}=await import('mongodb');
    client=new MongoClient(uri,{serverSelectionTimeoutMS:6000,connectTimeoutMS:5000,socketTimeoutMS:6000});
    await client.connect();
    const db=client.db(process.env.MONGODB_DB||'synapse');
    await db.command({ping:1});
    const estado=db.collection('estado'), diario=db.collection('diario'), gerados=db.collection('gerados');
    if(modo==='resumo') {
      const [estadoCount,diarioCount,geradosCount,doc]=await Promise.all([
        estado.countDocuments({}),diario.countDocuments({}),gerados.countDocuments({}),estado.findOne({_id:'principal'},{projection:{dados:1}})
      ]);
      let seq=null,agentes=0,tarefas=0;
      if(doc?.dados) { try { const s=JSON.parse(doc.dados); seq=Number.isFinite(s.seq)?s.seq:null; agentes=Object.keys(s.agentes||{}).length; tarefas=Array.isArray(s.tarefas)?s.tarefas.length:0; } catch {} }
      return [`# Resumo MongoDB`,``,`- Ping: bem-sucedido.`,`- Documento de estado principal: ${doc?'presente':'ausente'}.`,`- Sequência do estado: ${seq===null?'indisponível':seq}.`,`- Agentes no estado: ${agentes}.`,`- Tarefas no estado: ${tarefas}.`,`- Documentos em estado: ${estadoCount}.`,`- Entradas no diário: ${diarioCount}.`,`- Artefatos gerados: ${geradosCount}.`,``,`Consulta somente leitura; nenhum conteúdo de diário ou URI foi retornado.`].join('\n');
    }
    if(modo==='diario_recente') {
      const rows=await diario.find({},{projection:{_id:0,seq:1,tipo:1,agente:1,hora:1,em:1}}).sort({seq:-1}).limit(quantidade).toArray();
      if(!rows.length) return '# Diário MongoDB\n\nNenhum evento encontrado.';
      return ['# Metadados recentes do diário','',...rows.map(r=>`- seq ${r.seq??'?'} | ${r.tipo??'tipo n/d'} | ${r.agente??'agente n/d'} | ${r.hora??(r.em?new Date(r.em).toISOString():'hora n/d')}`),'',`Exibidos ${rows.length}; nenhum campo texto/resumo foi consultado ou retornado.`].join('\n');
    }
    const rows=await gerados.find({},{projection:{_id:0,caminho:1,atualizado_em:1}}).sort({caminho:1}).limit(quantidade).toArray();
    if(!rows.length) return '# Artefatos MongoDB\n\nNenhum artefato encontrado.';
    return ['# Caminhos de artefatos MongoDB','',...rows.map(r=>`- ${String(r.caminho||'caminho n/d')} | ${r.atualizado_em?new Date(r.atualizado_em).toISOString():'data n/d'}`),'',`Exibidos ${rows.length}; o conteúdo dos artefatos não foi consultado.`].join('\n');
  } catch {
    return 'Consulta MongoDB falhou. Nenhum detalhe de conexão, documento ou segredo foi exibido.';
  } finally {
    if(client) await client.close().catch(()=>{});
  }
}
