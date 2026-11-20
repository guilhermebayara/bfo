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

Os comandos escolhem os bindings de prévia e bloqueiam o uso do banco de produção no seed. Repetir o seed preserva edições dos IDs existentes. A migração 0004 é aditiva e pode ser aplicada na homologação antes do merge. Nesta sessão, o seed foi validado localmente. A aplicação remota ficou pendente: a integração Cloudflare tornou-se indisponível após a reconexão e a alternativa autorizada pelo navegador falhou antes de abrir o painel. O Wrangler local não está autenticado. A prévia remota não foi validada.

## Sessão F

Em 19/11/2026, a migração `0005_session_f.sql` e o seed fictício foram aplicados nos D1 `bfo-teste` e `bfo-homologacao` pela integração Cloudflare, na conta BFO. O registro em `d1_migrations` foi atualizado junto com a migração. A verificação remota confirmou os dois planos, a antecipação com desconto, as duas partes da transação e as revisões de conferência, com `PRAGMA foreign_key_check` sem erros. Produção permaneceu fora dessas operações.

Para repetir pela CLI autenticada, os comandos continuam os mesmos:

```sh
WORKERS_CI_BRANCH=tst-parcelas node scripts/migrate-build.mjs
npm run db:seed:teste
WORKERS_CI_BRANCH=homologacao node scripts/migrate-build.mjs
npm run db:seed:homologacao
```

O seed inclui o Cartão de parcelas fictício, com a compra Cadeira retroativa fictícia (3 de 10 em novembro/2026) e Equipamento antecipado fictício (desconto de R$ 30,00). A Compra mista fictícia fica na Conta de divisão fictícia, em novembro/2026. Os exemplos da sessão F são inicializados uma vez, com marcador em `seed_fixtures`, preservando inclusive divisões editadas ou desfeitas ao repetir o seed.

Validação local: build, 83 testes de API/regras e 18 testes de navegador aprovados. Os testes incluem fatura paga com histórico preservado, entradas importadas, divisão em moeda estrangeira sem perder centavos em reais e prazo de aviso editável. O fluxo autenticado da prévia remota depende do acesso do dono pelo Cloudflare Access.

## Sessão I

Em 19/11/2026, a migração `0008_session_i.sql` e o seed fictício foram aplicados pela integração Cloudflare nos D1 `bfo-teste` e `bfo-homologacao`. A migração 0007 pendente também foi aplicada na homologação. Os registros em `d1_migrations` foram atualizados junto com cada migração. A conferência confirmou a transferência de R$ 150,00 e o pagamento parcial de R$ 40,00 na fatura fictícia de R$ 100,00, ainda fechada e com R$ 60,00 a pagar. `PRAGMA foreign_key_check` não encontrou erros nos dois bancos.

O seed mantém os comandos existentes e usa marcador `session-i` para preservar alterações posteriores nos exemplos. Os testes de navegador cobrem a criação desses tipos pela nova linha de Transações. O saldo anterior na fatura seguinte permanece para a Sessão J.
