const filterNames = {
  account: 'conta',
  category: 'categoria',
  tag: 'tag',
  origin: 'origem',
  from: 'de',
  to: 'ate',
  search: 'busca',
  summary: 'resumo',
  group: 'grupo',
  statement: 'fatura',
  statementTotal: 'totalFatura',
  transaction: 'transacao',
  balance: 'saldo',
} as const;

type Filter = keyof typeof filterNames;
export type TransactionFilters = Partial<Record<Filter, string>>;

export function readTransactionFilters(search: string) {
  const params = new URLSearchParams(search);
  return Object.fromEntries(
    Object.entries(filterNames).map(([key, urlKey]) => [
      key,
      params.get(urlKey) ?? params.get(key) ?? '',
    ]),
  ) as Record<Filter, string>;
}

export function transactionsUrl(month: string, filters: TransactionFilters) {
  const params = new URLSearchParams();
  for (const key of Object.keys(filterNames) as Filter[]) {
    const value = filters[key];
    if (value) params.set(filterNames[key], value);
  }
  return `/transacoes/${month}${params.size ? `?${params}` : ''}`;
}
