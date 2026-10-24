export async function run(entradas, ctx) {
  const titulo = '# Verificar render.yaml\n\n';
  const real = (process.env.RENDER_SERVICE_NAME || '').trim();
  let texto = '';
  try {
    texto = String(ctx.ler(ctx.raiz + '/render.yaml'));
  } catch (e) {
    return titulo + 'Falhou: não consegui ler o render.yaml. Onde: ctx.ler na raiz do projeto. Como corrigir: confirme que o arquivo existe na raiz.';
  }
  const m = texto.match(/^[ \t]*name:[ \t]*(\S+)[ \t]*$/m);
  if (!m) {
    return titulo + 'Não achei a linha name: no render.yaml. Confira o arquivo.';
  }
  const noArquivo = m[1];
  if (!real) {
    return titulo + 'render.yaml tem name: ' + noArquivo + '. RENDER_SERVICE_NAME não está definida aqui (provável modo local), então não dá para comparar.';
  }
  if (noArquivo === real) {
    return titulo + 'OK: o name do render.yaml (' + noArquivo + ') é igual ao serviço real.';
  }
  const unica = texto.split(m[0]).length - 1 === 1;
  const novaLinha = m[0].replace(noArquivo, real);
  const a = '@' + '@';
  const golpe = [
    a + 'ARQ render.yaml',
    a + 'P corrigir name do serviço para o atual',
    a + 'TROCA',
    a + 'ACHE',
    m[0],
    a + 'POR',
    novaLinha,
    a + 'FIM'
  ].join('\n');
  return titulo
    + 'Diferença: render.yaml tem name: ' + noArquivo + ', mas o serviço real é ' + real + '.\n'
    + (unica ? 'A linha é única no arquivo (âncora válida).' : 'Atenção: a linha não é única; ajuste a âncora.') + '\n\n'
    + 'Golpe pronto (nada foi gravado):\n\n' + golpe + '\n';
}
