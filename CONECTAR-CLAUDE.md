# Como conectar cada Claude ao Synapse

## 1. A chave

É o `SYNAPSE_TOKEN`, definido em **Environment** no painel do Render. Ele não fica em arquivo do repositório. O mesmo valor entra na URL de cada conector.

## 2. Cadastrar o conector

Em cada chat: **Configurações → Conectores → Adicionar conector personalizado**. Preencha só a URL (nada nas opções avançadas):

```
https://SEU-SERVICO.onrender.com/a/mcp1/t/SEU_SYNAPSE_TOKEN/mcp
https://SEU-SERVICO.onrender.com/a/mcp2/t/SEU_SYNAPSE_TOKEN/mcp
https://SEU-SERVICO.onrender.com/a/mcp3/t/SEU_SYNAPSE_TOKEN/mcp
```

O conector do Claude não aceita header fixo, por isso o token vai na URL. Na verificação, "Procurando configurações de login: Ignorado" é o esperado.

Antes de cadastrar, abra `https://SEU-SERVICO.onrender.com/saude` no navegador para acordar o serviço (plano grátis).

## 3. Como "logar" cada agente

Não há login por agente. O nome vem da URL (`/a/mcp1/`). Cole em cada chat:

> Você é o **mcp1** da Fábrica. Use só a ferramenta synapse. Chame acao=ajuda, depois acao=entrar com dispositivo e papel, e siga o protocolo.

> Você é o **mcp2** da Fábrica. Mesmo protocolo. Papel: executor.

> Você é o **mcp3** da Fábrica. Mesmo protocolo. Papel: executor.

## 4. Os três trabalham juntos?

Sim, no mesmo quadro: compartilham sala, tarefas e travas. O servidor não acorda um chat parado: para ficar disponível, o agente usa `acao=aguardar` em loop. Se o chat limitar o turno, mande "continua".

## 5. Quem executa

Os chats só mandam comandos. As ferramentas rodam no servidor do Render, dentro da pasta do projeto.

## 6. Se não conectar

Veja `DIAGNOSTICO-MCP-RENDER.md` e rode `./testar-mcp.sh https://SEU-SERVICO.onrender.com SEU_SYNAPSE_TOKEN`.
