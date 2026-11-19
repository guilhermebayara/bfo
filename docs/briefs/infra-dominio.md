# Brief: infraestrutura no mesmo modelo do acervo da família

Decidido pelo dono em 19/11/2026. Substitui o modelo de dois Workers (bfo-homologacao e bfo-producao) e o fluxo sem prévias registrado antes. Segue o modelo que já funciona no acervo da família.

## Depende de

- Domínio bayara.design ativo como zona na conta BFO da Cloudflare (transferência em andamento).
- Terceiro banco D1, `bfo-teste`, criado pelo dono, para as prévias das branches tst-.

## Modelo

- Um Worker só, chamado `bfo`.
- Branch `main` é a produção: domínio próprio `bfo.bayara.design`, banco `bfo-producao`, `workers_dev: false`.
- Qualquer outra branch vira uma prévia em `<branch>.bfo.bayara.design`, com `previews_enabled: true` na rota de domínio próprio.
- A branch `homologacao` é a prévia em `homologacao.bfo.bayara.design`. O app reconhece esse endereço e usa o banco `bfo-homologacao` (binding `DB_HOMOLOGACAO` no bloco `previews`). É ali que o dono revisa e, no fim das fases, testa a importação real.
- As demais prévias (`tst-*`) usam o banco `bfo-teste`, só com o seed fictício.
- Access pelo Zero Trust cobrindo `bfo.bayara.design` e `*.bfo.bayara.design`, política Allow só com o e-mail do dono. Todas as prévias ficam fechadas também.

## Builds (painel, Settings > Build)

- Production branch: `main`. Build command: `npm run build`. Deploy command: `npx wrangler deploy`.
- Aba Previews Base: Build command vazio, porque esse campo não é executado nas prévias. Preview command: `npm run build && npx wrangler preview`. Ao mudar algo nessa aba, salvar com "Apply to existing Previews".
- Migrações: o deploy de produção e o comando de prévia aplicam as migrações no banco certo antes de publicar. Se o token do Workers Builds não tiver permissão no D1, documentar o passo para o dono liberar.

## Para a sessão que construir

- Reescrever `wrangler.jsonc` nesse modelo, com comentários em português explicando cada bloco.
- Escolha do banco pelo endereço num lugar só do servidor.
- Reescrever `docs/cloudflare.md` como guia curto do painel nesse modelo, com uma tabela ambiente, endereço, banco, acesso.
- Lista de passos do dono no relatório: criar `bfo-teste`, configurar builds, Access com curinga, ligar domínio. Depois do primeiro deploy de produção, apagar o Worker `bfo-homologacao`.
- `main` recebe o código por fast-forward da `homologacao` quando o dono aprovar. Até lá, o build da produção falha por falta de código, e isso é esperado.
