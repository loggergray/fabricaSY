export async function run(entradas, ctx) {
  const env = process.env;
  let base = (env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, '');
  let origem = 'RENDER_EXTERNAL_URL';
  if (!base && env.RENDER_EXTERNAL_HOSTNAME) {
    base = 'https://' + env.RENDER_EXTERNAL_HOSTNAME.trim();
    origem = 'RENDER_EXTERNAL_HOSTNAME';
  }
  const mcp = (env.MCP_PATH || '/mcp').replace(/\/+$/, '');
  const linhas = ['# URL do serviço', ''];
  if (!base) {
    linhas.push('URL: não encontrada. As variáveis do Render (RENDER_EXTERNAL_URL e RENDER_EXTERNAL_HOSTNAME) não estão definidas neste ambiente (provável modo local).');
    linhas.push('', 'Serviço: ' + (env.RENDER_SERVICE_NAME || 'desconhecido'));
    return linhas.join('\n');
  }
  linhas.push('- URL base: ' + base);
  linhas.push('- Saúde: ' + base + '/saude');
  linhas.push('- Endpoint MCP (sem token): ' + base + '/a/mcp1' + mcp);
  linhas.push('', 'Serviço: ' + (env.RENDER_SERVICE_NAME || 'desconhecido') + ' (fonte: ' + origem + ')');
  linhas.push('O token do conector (/t/<token>) nunca é exibido.');
  return linhas.join('\n');
}
