export type TransactionNotice = {
  id: string;
  message: string;
  accounts: {
    id: string;
    name: string;
    currency: string;
    balance_cents: number;
  }[];
};

export const transactionFieldLabels: Record<string, string> = {
  date: 'Data',
  account_id: 'Conta',
  payee: 'Beneficiário',
  effective_payee: 'Beneficiário unificado',
  amount_cents: 'Valor',
  category_id: 'Categoria',
  note: 'Nota',
  currency: 'Moeda',
  fx_rate: 'Cotação',
  fx_source: 'Origem da cotação',
  amount_brl_cents: 'Valor em reais',
  tag_ids: 'Tags',
  splits: 'Divisão',
  recurring_id: 'Recorrente',
  statement_id: 'Fatura',
  advance_id: 'Antecipação',
  cancellation: 'Cancelamento',
};
