# BFO (Bayara Family Office)

App web pessoal de finanças: um family office de uma pessoa só. Substitui o uso do Lunch Money, importando o histórico de lá e seguindo com lançamento manual, conta a conta.

Este arquivo vale para qualquer agente (Codex, Claude Code). O CLAUDE.md aponta para cá.

## Antes de qualquer trabalho

1. Leia `docs/decisoes.md`. O que está lá foi decidido pelo dono do projeto. Não reabra decisão: se algo parecer errado, registre no relatório como pergunta.
2. Leia `docs/a-construir.md` e o brief da fase em `docs/briefs/`.
3. Faça só o escopo pedido no prompt da sessão.

## Idioma e escrita

- Interface, documentos, commits e relatórios em português do Brasil.
- Sem travessão (o traço longo). Sem a construção "não é x, é y". Sem listas de três itens usadas só para dar ritmo.
- Texto que o dono escreveu fica como ele escreveu.

## Segurança e dados

- Este repositório é público por enquanto. Só dados fictícios entram aqui.
- Nunca colocar no repositório, commit, log ou relatório: tokens, segredos, e-mails reais, nomes reais de bancos do dono, valores reais, arquivos de importação.
- O arquivo gerado pela importação do Lunch Money fica fora do repo (pasta listada no `.gitignore`).
- Segredos vão para `wrangler secret` ou variáveis do painel da Cloudflare, digitados pelo dono.

## Stack

- Cloudflare Workers, numa conta própria do projeto (conta BFO).
- Banco D1, com migrações SQL versionadas em `migrations/`.
- API no próprio Worker (Hono).
- Front em React com Vite, servido como assets estáticos pelo mesmo Worker.
- TypeScript em tudo.
- Valores monetários em centavos, inteiros. Moeda guardada por conta (BRL na primeira versão).
- Acesso fechado por Cloudflare Access, configurado pelo dono no painel.

## Interface

- Desktop primeiro. O uso sério acontece no computador. O celular é uma versão secundária, responsiva, instalável na tela inicial.
- Modo escuro sempre, sem alternância de tema por enquanto.
- Até o conceito visual ser escolhido, a interface é funcional e neutra. Cores, tipografia e espaçamentos ficam centralizados em tokens (variáveis CSS num arquivo só), para o visual ser trocado depois sem mexer nas telas. Nenhuma sessão inventa identidade visual por conta própria.

## Branches e deploy

- `main` é produção. `homologacao` é homologação.
- Cada sessão trabalha numa branch `tst-<assunto>` criada a partir de `homologacao` e envia a branch ao terminar.
- O chat de gestão abre o PR, confere build e testes e faz o merge com squash na `homologacao`. A homologação é o ambiente de revisão do dono.
- Produção recebe `homologacao` por fast-forward, em rodadas, só quando o dono aprova.
- Nunca force push.
- O deploy da homologação aplica as migrações do D1 sozinho. Seed e importação são manuais, só quando pedidos.
- Sem prévias por branch. Homologação roda no endereço gratuito do Workers, protegido pelo Access. Domínio próprio só na produção.

## Fim de toda sessão

Termine com um relatório curto e uma tabela:

| O quê | Onde ver |
|---|---|
| descrição do item | endereço completo e clicável |

O dono responde linha por linha. Separe no relatório o que é defeito conhecido do que é escolha que precisa dele. Passos que só o dono pode fazer (painel da Cloudflare, login, segredos) vão numa lista própria, em ordem.
