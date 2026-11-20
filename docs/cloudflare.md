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

## Sessão K

A importação do Lunch Money tem comandos próprios em [docs/importacao.md](importacao.md). A carga simulada e a carga real usam só o D1 `bfo-teste`. Homologação e produção ficam de fora desses comandos. O token é digitado na coleta e não fica gravado.

## Backup diário dos D1

O cron `0 6 * * *` do Worker `bfo` roda às 03h em America/Sao_Paulo (06h UTC). Ele grava `d1/bfo-producao/AAAA-MM-DD.sql` e `d1/bfo-homologacao/AAAA-MM-DD.sql` no bucket privado `bfo-backups`, usando a data local do disparo. Cada arquivo contém o esquema e os dados das tabelas, incluindo `d1_migrations`, além dos índices, views e gatilhos. Uma segunda execução no mesmo dia preserva o arquivo existente de cada banco.

O cron e os bindings de backup ficam na configuração de produção. As prévias usam seus bindings próprios. O backup usa os bindings D1 e R2, sem credencial adicional no Worker. A exportação tem os limites de resposta do D1 e de memória e CPU do Worker. Em caso de falha, o evento indica a data e o banco afetado no painel. [Limites do D1](https://developers.cloudflare.com/d1/platform/limits/)

### Passos no painel da conta BFO

1. Em **R2 Object Storage**, crie o bucket `bfo-backups` com acesso privado. Caso já exista, confirme que o endereço público `r2.dev` e os domínios públicos estão desativados.
2. Em **bfo-backups > Settings > Object Lifecycle Rules**, crie uma regra de expiração para o prefixo `d1/`, com exclusão dos objetos após 30 dias. [Regras de ciclo de vida do R2](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)
3. Depois da publicação aprovada de `main`, abra **Workers & Pages > bfo > Settings > Triggers** e confira o cron `0 6 * * *`. Após o primeiro disparo, confira o resultado do evento e a presença dos dois arquivos SQL do dia no bucket. [Gatilhos agendados](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

### Restaurar um backup escolhido

Na raiz do projeto, com as dependências instaladas, escolha a origem e a data pelo nome do arquivo no bucket. Para a conta BFO, use uma sessão do Wrangler já autenticada e autorizada a ler o bucket e a escrever no D1 de destino. Prefira restaurar primeiro em um D1 vazio para conferir o conteúdo. Se o destino estiver em uso, pause as gravações durante a restauração e confirme que o backup corresponde à versão do Worker que vai usar o banco.

```sh
node scripts/restore-backup.mjs bfo-homologacao AAAA-MM-DD NOME_DO_D1 --cloud
```

O script baixa o SQL do bucket privado, confere a origem e a data no arquivo e pede que você digite o nome do D1 de destino. Com a confirmação, aplica em uma operação o descarte do esquema anterior e a importação do backup. Os arquivos temporários são removidos ao terminar. O D1 pode ficar indisponível enquanto o arquivo é aplicado.

Para usar D1 e R2 locais, troque `--cloud` por `--local` e informe `--persist-to PASTA` se o estado local estiver em uma pasta própria. O destino local deve constar na configuração do Wrangler, selecionável com `--config ARQUIVO`. `npm run test:backup` usa estado isolado, popula os bancos com o seed fictício, aciona o cron local, restaura um arquivo em um D1 vazio e compara o esquema, a contagem de cada tabela, as somas de `amount_cents` e as chaves estrangeiras. Também verifica o cancelamento e a substituição com confirmação.
