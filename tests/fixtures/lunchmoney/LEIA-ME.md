# Dados simulados da API v2 do Lunch Money

Conjunto fictício de respostas, um arquivo por endpoint, para construir e testar a importação (Sessão K) sem token e sem dados reais. Nomes, valores e ids foram inventados. O formato segue `docs/referencia-api-lunchmoney.md`. Onde essa referência não detalha o envelope da resposta (nome da chave que embrulha a lista, estrutura de `matches`, `balance_history` e `budgets/summary`), o formato aqui é uma suposição razoável e deve ser conferido com o OpenAPI antes da importação real.

Convenções: valores em texto com 4 casas, positivo é saída e negativo é entrada, moeda em minúsculas, `to_base` na moeda principal (`brl`). Contas manuais têm ids 1 a 5, categorias 101 a 209, tags 301 a 303, recorrentes 701 a 703, transações 90001 a 90025.

## Arquivos e resultado esperado

| Arquivo | Caso coberto | Resultado esperado no BFO |
|---|---|---|
| `me.json` | Usuário com `primary_currency` em minúsculas | Moeda principal BRL nas configurações |
| `manual_accounts.json` | Contas 1, 2 e 5 ativas (corrente, cartão, investimento) | Contas importadas nascem "só arquivo", agrupadas por instituição, sem data de corte até serem ativadas |
| `manual_accounts.json` | Conta 3 em dólar (`usd`) | Conta com moeda própria USD, e moeda entra na lista de moedas em uso |
| `manual_accounts.json` | Conta 4 com `status: closed` e `closed_on` | Conta encerrada, na seção recolhida "Encerradas"; histórico mantido |
| `categories.json` | Formato flattened com grupos (`is_group`, `group_id`) | Grupos de categoria e categorias dentro deles |
| `categories.json` | Grupo Renda com `is_income`; grupo Movimentações com `exclude_from_budget` e `exclude_from_totals` | As três marcas vão para o grupo e as categorias filhas as herdam, com a herança visível |
| `categories.json` | Categoria 206 `archived`; categoria 208 sem grupo | Categoria arquivada continua ligada às transações antigas; categoria solta entra sem grupo |
| `tags.json` | Tag "Pagamento de fatura" (301) | Não vira tag: vira o tipo próprio de lançamento (pagamento de fatura) |
| `tags.json` | Tag 303 com `archived_at` | Tag importada e marcada como arquivada |
| `transactions.pagina-1.json` | `has_more: true`, 12 transações | A importação busca a página seguinte (`offset`) |
| `transactions.pagina-2.json` | `has_more: false`, 13 transações | Fim da paginação; total de 25 sem repetição de ids |
| `transactions.pagina-1.json` | 90001 e 90021: 4 casas decimais (`152.3400`, `1234.5678`) | Centavos inteiros sem ponto flutuante, arredondando para o centavo mais próximo (decisão do dono em 19/11/2026): 90021 vira 123457 centavos |
| `transactions.pagina-1.json` | 90002 renda (`-5200.0000`) e 90022 (`0.0100`) | Entrada com sinal positivo no BFO; 1 centavo preservado |
| `transactions.pagina-1.json` | 90003 e 90004 na conta 3, `usd` com `to_base` | Valor original, moeda `USD` e valor em reais guardados; 90004 é crédito |
| `transactions.pagina-1.json` | 90005 pai de divisão (`is_split_parent`), filhos 90023 e 90024 na página 2 | Uma transação dividida em duas partes que somam 300,00; o pai não entra duplicado. Os filhos chegam em página diferente do pai |
| `transactions.pagina-1.json` | Grupo 90006 com filhos 90007 (+1000) e 90008 (-1000), categoria Transferência | Uma transferência só, da conta 1 para a conta 5, sem entrar em receita nem despesa |
| `transactions.pagina-1.json` | Grupo 90009 de soma zero com a tag "Pagamento de fatura" (filhos 90010 e 90011) | Pagamento de fatura, da conta 1 para o cartão 2, uma linha. O período do arquivo fica sem faturas, então entra como transferência comum até a data de corte do cartão |
| `transactions.pagina-1.json` | Grupo 90012 (95,00) que não é transferência: filhos 90013 e 90014 somam 95,00 | Cada filho entra como transação separada, com nota indicando o grupo de origem |
| `transactions.pagina-1.json` | 90015 com `recurring_id: 702` | Transação passada ligada ao recorrente Aluguel |
| `transactions.pagina-1.json` | 90016 com `status: delete_pending` | Ignorada pela importação |
| `transactions.pagina-1.json` | 90017 com `is_pending: true` e `status: unreviewed` | Entra como transação normal com a nota "pendente no Lunch Money". O relatório da importação informa quantas vieram assim (decisão do dono em 19/11/2026) |
| `transactions.pagina-1.json` | 90018 na conta encerrada 4 | Entra na conta encerrada, fora da lista principal |
| `transactions.pagina-1.json` | 90019 na categoria arquivada 206 | Mantém a categoria arquivada |
| `transactions.pagina-1.json` | 90020 reembolso na categoria 208 | Entrada fora dos totais |
| `transactions.pagina-2.json` | Filhos de divisão 90023 e 90024 (`split_parent_id: 90005`) | Partes da divisão do 90005; só a classificação é editável depois |
| `transactions.pagina-2.json` | 90025 com tag arquivada, `source: csv` e `external_id` | Tag arquivada preservada; `external_id` guardado como origem |
| `recurring_items.json` | 701 e 702 (`reviewed`), com transações ligadas | Entram como recorrentes, ligados às transações passadas. Assinatura e tipo ficam para o dono |
| `recurring_items.json` | 703 com `end_date` e `status: ignored` | Não entra como recorrente ativo |
| `balance_history.json` | Três meses por conta, incluindo conta em USD e conta encerrada | Guardado para a fase 2 (patrimônio); nada aparece na interface da fase 1 |
| `budgets-summary.json` | Orçado e realizado de dois meses por categoria | Guardado para a fase 3 (orçamento); nada aparece na interface da fase 1 |

## Observações

- A soma dos filhos de cada grupo confere: 90006 e 90009 fecham em zero (transferência e pagamento de fatura), 90012 fecha em 95,00 (grupo comum).
- O arquivo de transações vem em duas páginas porque o limite de teste é menor que o real (a API aceita até 2000 por página).
- Nenhum arquivo contém dado real. O e-mail de `me.json` usa o domínio reservado `.invalid`.
