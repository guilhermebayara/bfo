# Referência: API v2 do Lunch Money para a importação

Resumo da documentação pública (developers.lunchmoney.app, versão 2.11), coletado em 19/11/2026. Base para a sessão de importação. Conferir na documentação original antes de construir: https://developers.lunchmoney.app/v2/docs e o OpenAPI em https://developers.lunchmoney.app/v2/openapi

## Geral

- Endereço base: `https://api.lunchmoney.dev/v2`. Autenticação: `Authorization: Bearer <token>`. O token é digitado pelo dono na hora e nunca gravado.
- Limite: 100 requisições por minuto por IP. Acima disso volta 429; respeitar o cabeçalho `Retry-After`.
- Valores (`amount`, `balance`) vêm como texto com até 4 casas decimais, na moeda da transação. Converter para centavos inteiros com cuidado (sem passar por número de ponto flutuante).
- Sinal: positivo é saída (débito), negativo é entrada (crédito), sempre, independente da configuração do usuário.
- `currency` vem em minúsculas (ISO 4217). `to_base` é o valor convertido para a moeda principal do usuário.
- Datas no formato `AAAA-MM-DD`. Carimbos de tempo em ISO 8601.

## Paginação

- Só `GET /transactions` pagina: `limit` (padrão 1000, máximo 2000) e `offset`. Continuar enquanto `has_more` for verdadeiro.
- As outras listas vêm inteiras.

## Objetos e endpoints

- **Usuário:** `GET /me`. Traz `primary_currency`. Configurações em `/me/account/settings` e `/me/user/settings`, incluindo `default_manual_account_id` (a conta padrão do dono).
- **Contas manuais:** `GET /manual_accounts`. Campos úteis: `id`, `name`, `display_name`, `institution_name`, `type` (cash, credit, investment, loan, real estate, other asset, other liability, vehicle, cryptocurrency, employee compensation), `subtype`, `balance`, `currency`, `balance_as_of`, `status` (active ou closed), `closed_on`, `exclude_from_transactions`.
- **Contas Plaid:** `GET /plaid_accounts`. Mesma ideia, com `status` active, closed, revoked ou deactivated.
- **Categorias:** `GET /categories?format=flattened` traz todas numa lista. Campos: `id`, `name`, `description`, `is_income`, `exclude_from_budget`, `exclude_from_totals`, `is_group`, `group_id`, `archived`, `order`. As marcas do grupo são herdadas pelas categorias dele.
- **Tags:** `GET /tags`. Campos: `id`, `name`, `background_color`, `text_color`, `archived_at`.
- **Transações:** `GET /transactions` com `start_date` e `end_date`. Campos: `id`, `date`, `amount`, `currency`, `to_base`, `payee`, `original_name`, `category_id`, `manual_account_id`, `plaid_account_id`, `tag_ids`, `notes`, `status` (reviewed, unreviewed, delete_pending), `is_pending`, `recurring_id`, `external_id`, `source`.
  - Por padrão a lista omite os pais de divisão e os filhos de grupo. Para o histórico completo, usar `include_split_parents=true`, `include_group_children=true` e `include_children=true`.
  - Ignorar `delete_pending`. Decidir na sessão o que fazer com `is_pending`.
- **Divisões:** filhos ligados por `split_parent_id`. O pai tem `is_split_parent`. No BFO, viram uma transação dividida em partes.
- **Grupos de transações:** sem lista própria. O pai tem `is_group_parent` e `children`; os filhos têm `group_parent_id`.
- **Transferências:** a API v2 não tem objeto de transferência. No Lunch Money elas aparecem como duas transações agrupadas (grupo com soma zero), normalmente com a categoria de pagamento ou transferência. A importação precisa reconhecer esses grupos e transformá-los numa transferência do BFO (uma linha, origem e destino). Grupos com a tag "Pagamento de fatura" viram pagamento de fatura.
- **Recorrentes:** `GET /recurring_items`. Campos: `id`, `description`, `status`, `transaction_criteria` (critérios de reconhecimento), `overrides` (valores aplicados), `matches`. As transações apontam para eles por `recurring_id`.
- **Histórico de saldo:** `GET /balance_history` e `GET /balance_history/{tipo}/{id}`. Lista de `date`, `balance`, `currency`. Útil para a fase 2 (patrimônio ao longo do tempo).
- **Orçamento:** `GET /budgets/settings` e `GET /summary` para o histórico de orçado e realizado. Útil para a fase 3.

## Mudanças em relação à v1 que importam

- `manual_accounts` substitui `assets`.
- A lista de transações não traz filhos, metadados e anexos a menos que sejam pedidos.
- `pending` virou o campo `is_pending`.
- A configuração "débitos como negativo" não muda mais o sinal na API.

Fontes: https://developers.lunchmoney.app/v2/overview, https://developers.lunchmoney.app/amounts-and-balances, https://developers.lunchmoney.app/pagination, https://developers.lunchmoney.app/rate-limits, https://developers.lunchmoney.app/v2/migration-guide
