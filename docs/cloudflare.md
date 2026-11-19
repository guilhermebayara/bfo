# Cloudflare: um Worker para produção e prévias

Na conta BFO, o Worker `bfo` usa a zona ativa `bayara.design` e os três D1 existentes. A rota de domínio próprio habilita as prévias por branch. As rotas `workers.dev` ficam desligadas.

| Ambiente | Endereço | Banco | Acesso |
|---|---|---|---|
| Produção (`main`) | https://bfo.bayara.design | `bfo-producao` | Cloudflare Access |
| Homologação (`homologacao`) | https://homologacao.bfo.bayara.design | `bfo-homologacao` | Cloudflare Access |
| Prévias (ex.: `tst-infra`) | https://tst-infra.bfo.bayara.design | `bfo-teste` | Cloudflare Access |

1. Em **Zero Trust > Access > Applications**, cubra todos os caminhos de `bfo.bayara.design` e `*.bfo.bayara.design` com uma aplicação **Self-hosted**. Restrinja a política **Allow** ao seu e-mail. Depois da publicação, confirme em janela anônima que a página e `/api/health` exigem autenticação.
2. Em **Workers & Pages > bfo > Settings > Build**, use Node.js 24 e a raiz do checkout. Configure **Production branch** como `main` e habilite os builds de prévia. Na aba **Previews Base**, aplique alterações com **Apply to existing Previews** e confira se a configuração efetiva das prévias tem os dois bindings D1 de `wrangler.jsonc`.

   | Campo | Valor |
   |---|---|
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
   | Previews Base / Build command | Vazio |
   | Preview command | `npm run build && npx wrangler preview` |

   No Workers Builds, o `postbuild` usa `WORKERS_CI_BRANCH` para aplicar as migrações pendentes antes do comando de publicação. Se a migração falhar, o build falha. O token de build precisa de **Account > D1 > Edit** na conta BFO. O build local pode rodar sem credenciais Cloudflare.
3. Depois das migrações, rode o seed manualmente se precisar de dados fictícios. Na raiz do checkout, rode `npm ci`, autentique-se com `npx wrangler login` e confirme a conta BFO com `npx wrangler whoami`. Use `npm run db:seed:teste` ou `npm run db:seed:homologacao`. O seed usa IDs estáveis e preserva edições existentes. O script bloqueia produção.
4. Confira o domínio próprio e as prévias no painel após a publicação. Até o fast-forward aprovado para `main`, uma falha no build de produção por falta do código é esperada. Após o primeiro deploy de produção e a confirmação de que `homologacao.bfo.bayara.design` responde com Access e o D1 de homologação, apague o Worker antigo `bfo-homologacao`. Preserve o D1 de mesmo nome.

## Seed da Sessão E

Na branch `tst-recorrentes`, após autenticar o Wrangler na conta BFO, aplique as migrações e o seed nos dois bancos autorizados, nesta ordem:

```sh
WORKERS_CI_BRANCH=tst-recorrentes node scripts/migrate-build.mjs
npm run db:seed:teste
WORKERS_CI_BRANCH=homologacao node scripts/migrate-build.mjs
npm run db:seed:homologacao
```

Os comandos escolhem os bindings de prévia e bloqueiam o uso do banco de produção no seed. Repetir o seed preserva edições dos IDs existentes. A migração 0004 é aditiva e pode ser aplicada na homologação antes do merge. Nesta sessão, os comandos remotos dependem da conexão com a conta BFO; o seed foi validado localmente.
