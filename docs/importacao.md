# Importação do Lunch Money

A coleta e a carga são comandos separados. A coleta grava um arquivo em `private-data/`, pasta do `.gitignore`. A carga lê esse arquivo e escreve no D1. O token da API v2 é digitado na hora e não entra em arquivo, argumento, log ou relatório.

Nesta sessão o único modo executado foi o de teste, que lê `tests/fixtures/lunchmoney/` no lugar da API. A importação real espera o repositório privado.

O comando recusa homologação e produção. `--teste` aponta só para o D1 `bfo-teste`.

## Dados simulados, nesta máquina

```sh
npm run db:migrate
node scripts/importar-lunchmoney.mjs coletar --fixtures
node scripts/importar-lunchmoney.mjs carregar --local
```

Repetir `carregar --local` não duplica. A classificação editada depois da primeira carga permanece, porque a segunda carga usa `INSERT OR IGNORE` e o `external_id`.

Para remover só o que veio da importação e o que depende dela:

```sh
node scripts/importar-lunchmoney.mjs apagar --local
```

Lançamentos manuais ficam. Uma carga seguinte recria a importação.

## Carga simulada em bfo-teste

O Wrangler precisa estar autenticado na conta BFO. A prévia da branch `tst-importacao` aplica a migração `0010_importacao.sql` no `bfo-teste` durante o build. Se a migração ainda não tiver rodado, o comando abaixo faz o mesmo, sem tocar em homologação nem em produção:

```sh
npx wrangler login
npx wrangler whoami
WORKERS_CI_BRANCH=tst-importacao node scripts/migrate-build.mjs
node scripts/importar-lunchmoney.mjs coletar --fixtures
node scripts/importar-lunchmoney.mjs carregar --teste
```

Para apagar essa carga e refazer:

```sh
node scripts/importar-lunchmoney.mjs apagar --teste
node scripts/importar-lunchmoney.mjs carregar --teste
```

## Coleta real, quando o repositório for privado

```sh
node scripts/importar-lunchmoney.mjs coletar
node scripts/importar-lunchmoney.mjs carregar --teste
```

O primeiro comando pede o token no terminal. Se a entrada não for um terminal, ele lê o token pelo stdin e não ecoa o valor. `--token` na linha de comando encerra com erro. A coleta percorre `/me`, contas manuais, contas plaid, categorias, tags, recorrentes, histórico de saldo, orçamento e as páginas de transações. O intervalo fica abaixo de 90 requisições por minuto e um 429 espera o `Retry-After`.

O arquivo gerado continua em `private-data/lunchmoney.json`. Outro caminho sai com `--saida`, desde que permaneça fora do Git.

Antes da coleta real, confira no OpenAPI os envelopes de `matches`, `balance_history` e `budgets/summary`. O `LEIA-ME` dos dados simulados registra que esses três formatos são uma suposição.

## Relatório

`carregar` imprime quantidades por tipo, mais ignoradas, pendentes e a lista `nao_mapeados` com tipo, id e motivo. Não imprime valores, nomes nem e-mail.

## O que o mapeamento faz

Contas importadas nascem só arquivo: sem data de corte e com saldo inicial zero. A conta encerrada do simulado guarda `closed_at`. Cartão entra sem dia de fechamento. O dono define isso ao ativar a conta.

Grupos de categoria precisam de uma alocação. A carga cria a alocação `Importado`, com meta 0%, para receber os grupos que vieram do Lunch Money. Dá para reatribuir depois.

Pagamento de fatura no período de arquivo vira transferência comum, sem a tag "Pagamento de fatura" e sem fatura. A nota de pendência, quando o Lunch Money não trouxe nota, fica exatamente `pendente no Lunch Money`. Valores com quatro casas viram centavos pelo centavo mais próximo.

Apagar e refazer fica no script. A importação roda na máquina do dono, então não há tela nova para isso.
