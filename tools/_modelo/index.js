// Ferramenta: __NOME__
// Contrato: exporte `run(entradas, ctx)`. Retorne markdown ou { markdown }.
// ctx: ler · escrever (respeita Simular) · backup · resolver · log · simular
export async function run({ entrada }, ctx) {
  ctx.log('Iniciando…');
  return '# Pronto\n\nRecebi: ' + entrada;
}
