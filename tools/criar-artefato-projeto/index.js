import fs from 'node:fs';
import path from 'node:path';

export async function run({ id, tipo, codigo, confirmar }, ctx) {
  const nome = String(id || '').trim().toLowerCase();
  const classe = String(tipo || '');
  const fonte = String(codigo || '');
  if (!/^[a-z0-9][a-z0-9-]{0,50}$/.test(nome)) throw new Error('Identificador inválido: use minúsculas, números e hífen.');
  if (!['script', 'servidor'].includes(classe)) throw new Error('Tipo inválido: use script ou servidor.');
  if (!fonte.trim()) throw new Error('Informe o código-fonte.');
  if (Buffer.byteLength(fonte, 'utf8') > 200000) throw new Error('Código excede 200 KB.');
  const pasta = path.join(ctx.raiz, 'artefatos', classe === 'script' ? 'scripts' : 'servidores', nome);
  const arquivo = path.join(pasta, classe === 'script' ? 'index.mjs' : 'server.mjs');
  const readme = path.join(pasta, 'README.md');
  if (fs.existsSync(pasta)) throw new Error('O artefato já existe; não será sobrescrito: ' + path.relative(ctx.raiz, pasta));
  if (!ctx.simular && confirmar !== true) return '# Gravação não realizada\n\nRode primeiro em simulação e revise os caminhos. Para gravar, confirme explicitamente `confirmar=true`. Nenhum arquivo foi alterado.';
  const guia = classe === 'script'
    ? `# Script ${nome}\n\nFonte: \`index.mjs\`. A ferramenta apenas cria o arquivo; ela não executa o script.`
    : `# Servidor ${nome}\n\nFonte: \`server.mjs\`. A ferramenta apenas cria a fonte; não inicia processo nem abre porta. A exposição pública exige configuração e autorização separadas.`;
  ctx.escrever(arquivo, fonte.endsWith('\n') ? fonte : fonte + '\n');
  ctx.escrever(readme, guia + '\n');
  ctx.log((ctx.simular ? 'Simulação: ' : 'Criado: ') + path.relative(ctx.raiz, arquivo));
  return ctx.simular
    ? `# Simulação\n\nSeriam criados:\n- \`${path.relative(ctx.raiz, arquivo)}\`\n- \`${path.relative(ctx.raiz, readme)}\`\n\nNenhuma gravação foi feita.`
    : `# Artefato criado\n\nCriados:\n- \`${path.relative(ctx.raiz, arquivo)}\`\n- \`${path.relative(ctx.raiz, readme)}\`\n\nNenhum processo foi iniciado. A fonte agora pode ser incluída no próximo snapshot do projeto.`;
}
