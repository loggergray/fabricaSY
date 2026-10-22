Decompõe um HTML em **página → seção → componente → átomo**, tudo de uma vez.

- **CSS:** cada regra vai para a peça dona do seletor. Reset, variáveis e regras compartilhadas ficam em `base`.
- **JS:** declarações ficam em `base`. Listeners ligados a uma única peça vão para o arquivo dela.
- **Repetidos:** 10 cards iguais viram 1 componente com props (o que muda vira parâmetro).
- **Saída JS:** cada peça é um módulo ES com seu CSS junto. **Saída HTML:** cada peça é um `.html` com `<!--@include ...-->` e um `build.cjs` concatena tudo em `dist/`.
- **Segurança:** antes de gravar, remonta tudo e compara com o original. Se algo diferir, não grava nada.
