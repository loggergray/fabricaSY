export async function run(entradas={}, ctx={}) {
  const modo = String(entradas.modo || 'verificar');
  if (modo === 'ajuda') {
    return [
      '# Diagnóstico MongoDB',
      '',
      'Faz apenas um ping de leitura ao MongoDB, usando MONGODB_URI internamente. Nunca retorna URI, host ou erro bruto, e não consulta nem altera coleções.',
      '',
      'Um ping bem-sucedido comprova que este runner consegue conectar agora. Não confirma o estado do objeto de persistência principal nem que gravações históricas foram todas salvas; para isso, é preciso um indicador de saúde da aplicação ou logs de inicialização.'
    ].join('\n');
  }
  if (modo !== 'verificar') return 'Modo inválido. Use verificar ou ajuda.';
  if (ctx.simular) return 'Simulação: nenhum ping foi realizado; nenhuma variável foi lida e nenhuma conexão de rede foi aberta.';
  const uri = process.env.MONGODB_URI;
  if (typeof uri !== 'string' || !uri.trim()) return 'MongoDB indisponível para este runner: MONGODB_URI não está disponível. Nenhum segredo foi exibido.';
  let client;
  try {
    const { MongoClient } = await import('mongodb');
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 6000, connectTimeoutMS: 5000, socketTimeoutMS: 6000 });
    await client.connect();
    await client.db(process.env.MONGODB_DB || 'synapse').command({ ping: 1 });
    return 'Ping MongoDB bem-sucedido agora. Isto comprova conectividade do runner com as credenciais configuradas; não confirma todas as gravações históricas nem o estado interno da conexão principal.';
  } catch {
    return 'Ping MongoDB falhou. Não foram exibidos detalhes de conexão ou segredos. Isso não prova se a causa é URI ausente, rede, autenticação ou indisponibilidade do banco.';
  } finally {
    if (client) await client.close().catch(() => {});
  }
}
