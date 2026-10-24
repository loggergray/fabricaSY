const NL = String.fromCharCode(10);
const URL_KYODEVOR = 'https://kyodevor.onrender.com/';

export async function run(entradas, ctx) {
  if (ctx.simular) return ['# Simulação', '', 'Mostraria o link do KyDevor. Nenhuma rede seria usada.'].join(NL);
  return [
    '# KyDevor · abrir',
    '',
    '[Abrir o KyDevor em uma aba](' + URL_KYODEVOR + ')',
    '',
    'Entre com o seu usuário (kyo ou lodcry), abra a Biblioteca e escolha o livro Pokémon Fight Club.',
    'O chat do livro é o mesmo que mcp1, mcp2, mcp3 e o Claude usam pela Ponte KyDevor.',
    '',
    'Por que aba e não iframe: o login do KyDevor usa cookie SameSite=Lax, que não é enviado dentro de iframe de outro site. Numa aba própria o login funciona normal.'
  ].join(NL);
}
