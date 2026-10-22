// Persistência no MongoDB: estado dos agentes (1 documento) e diário (1 documento por entrada).
import { MongoClient } from 'mongodb';

export async function abrirMongo(uri, dbNome = 'synapse') {
  const cli = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await cli.connect();
  const db = cli.db(dbNome);
  const est = db.collection('estado');
  const dia = db.collection('diario');
  const gerados = db.collection('gerados');
  await dia.createIndex({ sessao: 1, seq: 1 });

  let carregado = null;
  const doc = await est.findOne({ _id: 'principal' });
  if (doc && doc.dados) { try { carregado = JSON.parse(doc.dados); } catch { carregado = null; } }

  let gravando = false, pendente = null;
  async function gravar() {
    if (gravando) return;
    gravando = true;
    while (pendente) {
      const dados = pendente; pendente = null;
      try { await est.replaceOne({ _id: 'principal' }, { _id: 'principal', dados, em: new Date() }, { upsert: true }); }
      catch (e) { console.error('Mongo (estado):', e.message); }
    }
    gravando = false;
  }

  return {
    carregado,
    salvarEstado(E) { pendente = JSON.stringify(E); gravar(); },
    salvarDiario(r) { dia.insertOne({ ...r, em: new Date() }).catch(e => console.error('Mongo (diário):', e.message)); },
    async carregarGerados() { return gerados.find({}, { projection: { _id: 0 } }).limit(2000).toArray(); },
    async salvarGerado({ caminho, conteudo }) {
      await gerados.replaceOne({ _id: caminho }, { _id: caminho, caminho, conteudo, atualizado_em: new Date() }, { upsert: true });
    }
  };
}
