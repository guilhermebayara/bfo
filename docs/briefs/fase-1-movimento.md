# Brief: fase 1, Movimento

Leia antes `docs/decisoes.md`. Este brief detalha o que construir; as regras de negócio estão lá.

## Objetivo

Ao fim da fase 1, o dono consegue cadastrar as contas de movimento, ver o histórico importado do Lunch Money, lançar transações à mão, controlar o cartão pela fatura e acompanhar recorrentes e assinaturas. Tudo testável na homologação com o histórico real dele.

## Modelo de dados (ponto de partida)

Nomes em inglês no código e no banco, interface em português.

- `accounts`: id, name, kind (`checking`, `credit_card`, `cash`), currency, cutoff_date (nula até a conta ser ativada), opening_balance_cents, archived, created_at. Cartão guarda também closing_day e due_day.
- `allocation_groups`: id, name, target_percent, sort. Seed: Essencial, Estilo de vida, Investimento.
- `category_groups`: id, name, allocation_group_id, sort.
- `categories`: id, name, category_group_id, is_income, sort. Inclui a categoria de sistema "Diferença de fatura".
- `transactions`: id, account_id, date, amount_cents (positivo é saída, negativo é entrada, igual à API v2 do Lunch Money), payee, category_id, note, origin (`imported`, `manual`, `adjustment`), kind (`regular`, `transfer`, `card_payment`, `installment`), transfer_pair_id, statement_id, installment_plan_id, external_id (id do Lunch Money), created_at.
- `statements` (faturas): id, account_id, period_start, closing_date, due_date, status (`open`, `closed`, `paid`), bank_amount_cents (valor digitado pelo dono), closed_at.
- `installment_plans`: id, account_id, description, total_cents, count, first_date, category_id.
- `recurring`: id, account_id, payee, amount_cents, category_id, cadence (`monthly`, `yearly`, `weekly`, `custom`), next_date, is_subscription, subscription_type_id, renewal_date, active.
- `subscription_types`: id, name, sort.

Regras que o modelo precisa garantir:

- Transação com origin `imported` só aceita mudança de category_id e note. A API recusa o resto.
- Saldo da conta = saldo de abertura + lançamentos depois do corte. Antes de ativar, a conta mostra o saldo do arquivo.
- Ao ativar a conta, o app calcula a diferença entre o saldo do arquivo na data de corte e o saldo de abertura informado, e cria uma transação origin `adjustment` visível.
- Pagamento de fatura (`card_payment`) nunca conta como gasto em nenhuma soma de orçamento ou categoria.
- Parcela entra no mês da fatura dela. Compra comum no cartão entra no mês da compra.

## Telas

Desktop primeiro, modo escuro. Estrutura de produto financeiro sério, com densidade de informação, no estilo de ferramentas como o próprio Lunch Money.

1. **Transações**: tabela com data, conta, beneficiário, categoria, valor, origem (selo discreto para importado e ajuste). Filtros por conta, categoria, período e origem. Edição inline de categoria e nota. Lançamento rápido no topo da tabela.
2. **Contas**: lista agrupada por tipo, com saldo. Cada conta mostra o estado (só arquivo ou ativa desde a data X). Ação "Ativar conta": escolher data de corte, digitar saldo de abertura, ver a diferença antes de confirmar.
3. **Cartão**: fatura atual e anteriores. Fatura aberta com as compras do ciclo e parcelas. Ao fechar: campo para o valor do banco, diferença calculada, opções "procurar compra" e "fechar com ajuste". Ação "Pagar fatura" a partir da conta corrente. Histórico de divergência por fatura.
4. **Recorrentes**: lista com próxima data e valor. Marca de assinatura e tipo.
5. **Assinaturas**: agrupada por tipo, com alternância para agrupar por grupo de alocação. Valor cobrado, equivalente mensal para anuais, próxima cobrança, onde cai, total por tipo. Faixa de aviso no topo do app quando uma renovação estiver próxima.
6. **Categorias**: grupos de categoria e grupos de alocação, editáveis.

## Seed fictício

Dados inventados e plausíveis para um usuário brasileiro, cobrindo pelo menos 14 meses: uma conta corrente, dois cartões, uma conta de dinheiro, categorias agrupadas, uma compra parcelada em andamento, uma fatura com divergência, recorrentes com assinaturas mensais e uma anual. Metade do período marcada como importada, para testar os dois momentos. Nenhum nome de banco real.

## Importação (sessão E)

- Script em `scripts/import-lunchmoney/`, rodado localmente. Lê o token de variável de ambiente digitada pelo dono na hora.
- Busca contas, categorias, grupos de categoria, tags, recorrentes e transações pela API v2.
- Grava num arquivo dentro de uma pasta ignorada pelo git e depois carrega no D1 da homologação.
- Comando para apagar tudo que tem origin `imported` e refazer.
- Testes com um fixture fictício no formato da API v2.

## Critérios de pronto da fase

- Todas as telas acima funcionando com o seed e com a importação real na homologação.
- Regras do modelo cobertas por testes.
- Homologação no endereço do Workers, atrás do Access.
