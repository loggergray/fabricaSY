# Padrão de ferramentas

Uma ferramenta é uma **pasta em `tools/`**. Ao soltar a pasta lá, a Fábrica detecta em até 2 segundos, desenha o formulário e deixa pronta para usar. Sem reiniciar e sem editar nada.

## Anatomia

~~~
tools/minha-ferramenta/
├── manifest.json   (obrigatório) identidade e entradas
├── index.js        (obrigatório) exporta run(entradas, ctx)
└── README.md       (opcional) aparece como documento na tela
~~~

Pastas que começam com `_` ou `.` são ignoradas (o `_modelo` é o molde para copiar).

## manifest.json

~~~json
{
  "nome": "Nome legível",
  "icone": "🧩",
  "descricao": "Uma linha dizendo o que faz.",
  "versao": "1.0.0",
  "tags": ["arquivos"],
  "entradas": [
    { "nome": "origem", "rotulo": "Arquivo", "tipo": "caminho", "obrigatorio": true, "ajuda": "Ex.: ~/arquivo.txt" }
  ]
}
~~~

## Tipos de entrada

- `texto`: linha simples
- `areatexto`: bloco grande (colar código, HTML etc.)
- `caminho`: arquivo ou pasta (aceita `~/`)
- `opcoes`: lista, com `"opcoes": [{"valor":"a","rotulo":"A"}]`
- `booleano`: liga e desliga
- `numero`: número

Campos extras de cada entrada: `rotulo`, `padrao`, `obrigatorio`, `ajuda`.

## index.js

~~~js
export async function run(entradas, ctx) {
  ctx.log('trabalhando…');
  const txt = ctx.ler(entradas.origem);
  ctx.escrever('~/saida.txt', txt.toUpperCase());
  return '# Pronto\n\nArquivo gerado.';
}
~~~

## O que existe em `ctx`

- `ctx.ler(caminho)`: lê texto
- `ctx.escrever(caminho, conteudo)`: grava e cria pastas. **Respeita o modo Simular sozinho.**
- `ctx.backup(caminho)`: copia para `.historico/` antes de mexer
- `ctx.resolver(caminho)`: expande `~` e caminhos relativos
- `ctx.log(...)`: linha de log em tempo real
- `ctx.simular`: `true` quando é simulação
- `ctx.raiz` e `ctx.pasta`: pasta da Fábrica e da ferramenta

## Retorno

Texto em markdown, ou `{ markdown: "..." }`. A lista de arquivos gravados é montada automaticamente.

## Regras de ouro

- Grave sempre com `ctx.escrever` (nunca `fs.writeFileSync`), para o Simular funcionar.
- Use `ctx.backup` antes de alterar arquivos existentes.
- Dependências: `npm i pacote` na raiz da Fábrica. Prefira JS puro, sem compilação nativa, por causa do Termux.
- Cada execução roda em um processo isolado, então um erro não derruba a Fábrica e o código editado vale na hora.

## Uma ferramenta por dia

1. Mande o prompt abaixo para a IA que preferir.
2. Cole o `manifest.json` e o `index.js` que ela devolver na ferramenta **Criar ferramenta**.
3. Ela já aparece na lista.

~~~
Crie uma ferramenta para a "Fábrica de Ferramentas" (Node, ESM, sem dependências nativas).
Entregue dois blocos: manifest.json e index.js.
Regras: export async function run(entradas, ctx); use ctx.ler, ctx.escrever, ctx.backup,
ctx.resolver e ctx.log; nunca grave com fs direto; retorne markdown.
A ferramenta deve: <descreva aqui>
~~~
