# Importar ferramentas em ZIP

Escolha um arquivo ZIP de até 12 MB. A primeira execução deve ficar em **Simular**: ela valida o arquivo e mostra os hashes SHA-256, sem instalar ferramentas. Só confirme a gravação depois de revisar a prévia.

A importação aceita somente ferramentas completas em pastas `tools/<id>/` com `manifest.json` e `index.js`. Pastas auxiliares sem esses dois arquivos são listadas e ignoradas; pastas parcialmente completas são recusadas. Só grava `manifest.json`, `index.js` e `README.md`; outros arquivos não são importados. O campo `permissoes` é metadado e não cria isolamento: o importador não executa o código nem instala dependências. Cada arquivo persistido pode ter até 250.000 bytes.

ZIP criptografado, ZIP64, caminhos fora da pasta `tools/`, links simbólicos, CRC inválido e padrões comuns de segredos são recusados. IDs devem usar letras minúsculas, números e hífens. Ferramentas existentes são puladas por padrão. Para substituir, marque **Substituir** e **Confirmar** após revisar; será guardada uma cópia de segurança em `tools/.importador-backups/`. IDs nativos podem não persistir após um reinício.

O upload é enviado em partes e o staging temporário é removido ao terminar. O seletor de arquivo aparece no painel após instalar a interface por esta ferramenta, com confirmação.
