# Editar ferramenta

Troca um trecho exato (âncora única) em `index.js`, `manifest.json` ou `README.md` de uma ferramenta em `tools/<id>/`, com backup em `.historico` antes de gravar. Use `acao=simular` primeiro e `acao=executar` com `confirmar=true` para aplicar.

**Prefira a `editar-ferramenta-v2`**: ela valida o manifest (id, campos, tipos, permissões), checa a sintaxe do `index.js`, guarda o backup por id da ferramenta, ajusta CRLF e dá dicas quando a âncora não casa. Esta versão continua disponível e só valida JSON do manifest e a existência da função `run`.
