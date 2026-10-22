# FORGE: como todo trabalho passa pela Fábrica

Princípio: faz, age, conclui. Não aceita erro nem falha de lógica. O que não passa nos portões não entra em uso.

## 1. Portões

- G0 Entendimento: o agente grava a intenção e escreve um plano curto com o critério de "pronto".
- G1 Sintaxe: o código passa pelo parser (acorn para js) e por node --check. Falhou, volta ao agente.
- G2 Contrato: manifest válido (campos, tipos de entrada, permissões, dependências, testes presentes).
- G3 Testes embutidos: rodam em simulação. Nada é gravado.
- G4 Invariantes: quando existir (remontar e comparar, contar, somar, checksum), é verificado.
- G5 Relatório: resumo mastigado para o agente e para o usuário.
- G6 Confirmação: obrigatória para escrita real, ação destrutiva, instalação de pacote e criação de servidor.
- G7 Execução real: com snap antes.
- G8 Verificação posterior: reler o que foi gravado, conferir checksum e fazer teste de fumaça.
- G9 Registro: diário, feed da ferramenta, RAG, dataset e marcas do roadmap.

Se qualquer portão falha, a ferramenta vai para quarentena. O relatório diz o portão, a causa, o local e como corrigir. O agente corrige e reentra em G1. Depois do limite de tentativas (inicial: 3), escala ao usuário.

## 2. Manifest estendido (proposta, entra na F5.3)

Campos novos, além dos atuais:

- tipo: braco, servo, interface, satelite ou externo
- permissoes: ler e escrever (listas de pastas), rede (sim ou não), processos (sim ou não), instalar (sim ou não)
- dependencias: lista de nome e versão
- variaveis: nomes das variáveis do cofre que a ferramenta usa (nunca os valores)
- testes: lista com nome, entradas e o que se espera (contém, não contém, arquivos esperados)
- saida: limite de bytes para o agente
- contrato: arquivo .md da ferramenta
- criada_por: agente e sessão

Ferramentas antigas sem esses campos continuam funcionando e ficam marcadas "sem testes".

## 3. Simulador

- ctx.escrever só registra a intenção.
- ctx.backup não copia.
- Rede é bloqueada.
- Instalações e processos são apenas listados.
- O relatório da simulação lista exatamente o que aconteceria: arquivos, instalações, processos, portas.

## 4. Relatório padrão

Seções fixas, curtas:

- Resumo (1 a 3 linhas)
- O que foi feito ou o que seria feito
- Arquivos tocados (lista curta)
- Verificações (✔ ou ✘ por portão)
- Riscos
- Próximo passo

## 5. Quarentena

- Pasta tools/_quarentena/<id> com motivo.json (portão, causa, local, hora, agente).
- Não aparece como utilizável para os agentes. Aparece no painel com o motivo.
- Sai da quarentena só passando de novo pelos portões.

## 6. Saída mastigada

Toda saída ao agente respeita o limite (inicial: 8 KB). O excedente é gravado em arquivo e o agente recebe: resumo, caminho e como fatiar.

## 7. Servos

Ferramentas que criam ferramentas, robôs ou servidores satélites:

- Passam pelo mesmo Forge.
- Profundidade máxima de 2 níveis.
- Criar servidor satélite exige confirmação.
- Registram quem criou quem, no diário e no contrato.

## 8. Mensagens de erro

Sempre com três partes: o que falhou, onde, e como corrigir.

## 9. Nunca

- gravar com fs direto
- usar tmp ou mktemp
- imprimir segredo
- aceitar ferramenta sem teste (exceto a marcação "sem testes" das antigas)
- seguir adiante depois de um portão falho