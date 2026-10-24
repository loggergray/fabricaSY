export async function run(entradas={}, ctx={}) {
  const modo=String(entradas.modo||'provar');
  if(modo==='ajuda') return [
    '# Prova de persistência MongoDB','',
    'Compara a sequência do documento de estado principal com o diário: contagem, sequências distintas, menor/maior seq e presença do registro mais recente.',
    'Não retorna conteúdo do estado ou diário, não altera o banco e não mostra credenciais.',
    'Passou = consistência observada agora até a sequência atual; não prova todos os arquivos do projeto, todos os valores históricos ou estabilidade futura.'
  ].join('\n');
  if(modo!=='provar') return 'Modo inválido. Use provar ou ajuda.';
  if(ctx.simular) return 'Simulação: nenhuma consulta foi feita e nenhuma variável/conexão de rede foi usada.';
  const uri=process.env.MONGODB_URI;
  if(typeof uri!=='string'||!uri.trim()) return 'Inconclusivo: MONGODB_URI não está disponível para o runner. Nenhum segredo foi exibido.';
  let client;
  try {
    const {MongoClient}=await import('mongodb');
    client=new MongoClient(uri,{serverSelectionTimeoutMS:6000,connectTimeoutMS:5000,socketTimeoutMS:6000});
    await client.connect();
    const db=client.db(process.env.MONGODB_DB||'synapse');
    await db.command({ping:1});
    const estados=db.collection('estado'), diario=db.collection('diario'), gerados=db.collection('gerados');
    const doc=await estados.findOne({_id:'principal'},{projection:{dados:1}});
    if(!doc?.dados) return 'INCONCLUSIVO: documento de estado principal ausente ou sem dados. Nenhum conteúdo foi exibido.';
    let state;
    try { state=JSON.parse(doc.dados); } catch { return 'INCONCLUSIVO: documento de estado não pôde ser validado. Nenhum conteúdo foi exibido.'; }
    const seq=Number(state.seq);
    if(!Number.isSafeInteger(seq)||seq<0) return 'INCONCLUSIVO: sequência do estado inválida. Nenhum conteúdo foi exibido.';
    const [total,geradosTotal,ultimo]=await Promise.all([
      diario.countDocuments({}),
      gerados.countDocuments({}),
      diario.findOne({}, {projection:{_id:0,seq:1,tipo:1,agente:1,hora:1},sort:{seq:-1}})
    ]);
    const registroAtual=seq>0?await diario.findOne({seq},{projection:{_id:0,seq:1,tipo:1,agente:1,hora:1}}):null;
    let stats=null;
    if(seq<=50000) {
      const rows=await diario.aggregate([
        {$match:{seq:{$type:'number'}}},
        {$group:{_id:'$seq'}},
        {$group:{_id:null,distintos:{$sum:1},min:{$min:'$_id'},max:{$max:'$_id'}}}
      ]).toArray();
      stats=rows[0]||{distintos:0,min:null,max:null};
    }
    const contiguo=seq===0?total===0:(!!stats&&stats.distintos===seq&&stats.min===1&&stats.max===seq&&total===seq&&!!registroAtual);
    const alinhado=Number(ultimo?.seq||0)===seq;
    if(contiguo&&alinhado) return [`# PROVA PASSOU`,``,`- Ping MongoDB: bem-sucedido.`,`- Documento principal: presente; seq=${seq}.`,`- Diário: ${total} entradas; ${stats.distintos} sequências distintas; intervalo ${stats.min}–${stats.max}.`,`- Entrada de seq ${seq}: presente.`,`- Artefatos gerados registrados: ${geradosTotal}.`,``,`O estado e o diário estão consistentes até seq ${seq} nesta leitura. Nenhum texto/URI foi retornado e nada foi gravado.`].join('\n');
    const details=[`# PROVA INCONCLUSIVA`,``,`- Ping MongoDB: bem-sucedido.`,`- Seq do estado: ${seq}.`,`- Total do diário: ${total}.`,`- Última seq do diário: ${ultimo?.seq??'ausente'}.`,`- Entrada da seq atual: ${registroAtual?'presente':'ausente'}.`,stats?`- Sequências distintas/intervalo: ${stats.distintos}/${stats.min??'n/d'}–${stats.max??'n/d'}.`:'- Sequências: acima do limite de varredura integral (50.000).',`- Artefatos gerados registrados: ${geradosTotal}.`,``,`Pode haver gravação em trânsito ou lacuna; aguarde e repita. Nenhum conteúdo/segredo foi exibido.`];
    return details.join('\n');
  } catch {
    return 'INCONCLUSIVO: falha ao verificar consistência do MongoDB. Nenhum detalhe de conexão ou segredo foi exibido.';
  } finally {
    if(client) await client.close().catch(()=>{});
  }
}
