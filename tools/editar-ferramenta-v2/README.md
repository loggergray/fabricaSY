# Editar ferramenta v2

Troca **um trecho exato** (âncora única) em `index.js`, `manifest.json` ou `README.md` de uma ferramenta em `tools/<id>/`. Sucessora da `editar-ferramenta`, com mais validações.

## Como usar

1. Leia o arquivo com `acao=projeto op=ler` e copie o trecho exato (mesma indentação).
2. Rode em **simulação** (`acao=simular`): mostra o que mudaria e não grava nada.
3. Aplique com `acao=executar` e `confirmar=true`.

Entradas: `id`, `arquivo` (padrão `index.js`), `ache` (âncora), `por` (trecho novo; vazio apaga a âncora) e `validar_sintaxe` (`sim` por padrão).

## O que ela garante

- **Âncora única:** recusa 0 ou várias ocorrências. No caso 0 dá dica (só espaços diferem, ou onde a primeira linha aparece); no caso de várias lista as linhas.
- **Quebras de linha:** ajusta a âncora e o trecho novo para CRLF ou LF, conforme o arquivo.
- **manifest.json:** JSON válido, `id` igual ao nome da pasta, `nome` e `descricao` não podem sumir, tipos de `permissoes`, `entradas`, `testes` e `dependencias`. Avisa quando uma permissão é ampliada.
- **index.js:** exige a função `run` exportada (fora de comentários) e valida a sintaxe sem executar o código nem usar processos.
- **Backup:** `ctx.backup` mais uma cópia em `.historico/<data>/<id>/<arquivo>`, antes de gravar.
- **Verificação:** depois de gravar, relê o arquivo e confere o conteúdo.
- **Segurança:** o `id` só aceita minúsculas, números e hífen, então não sai de `tools/`.

## Limites

- A sintaxe é checada com `node:vm` sobre uma versão adaptada do código (imports e exports removidos). É uma checagem de compilação: não pega erros de execução, e pode dar falso alarme em casos raros; nesse caso use `validar_sintaxe=nao`. Se `node:vm` não existir, avisa que a sintaxe não foi verificada.
- A escrita não é atômica; o backup é a rede de segurança.
- Editar o próprio editor é permitido, com aviso: confira o backup antes de usá-lo de novo.
