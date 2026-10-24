import path from 'node:path';
import { parse } from 'acorn';
export async function run(_inputs,ctx){const root=ctx.raiz,arquivos=['public/app.js','server.js'],erros=[];for(const relativo of arquivos){const codigo=ctx.ler(path.join(root,relativo));try{parse(codigo,{ecmaVersion:'latest',sourceType:'module'});}catch(e){erros.push(relativo+': '+e.message);}}if(erros.length)throw new Error('Falha de sintaxe: '+erros.join(' | '));return '# Sintaxe correta\n\nAcorn analisou `public/app.js` e `server.js` como módulos ES sem erros. Nenhum arquivo foi alterado.';}
