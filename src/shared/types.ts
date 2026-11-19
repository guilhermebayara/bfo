export interface Account {
  id: string;
  name: string;
  kind: 'checking' | 'credit_card' | 'cash';
  currency: string;
  institution_id: string | null;
  institution_name: string | null;
  last_reconciled_at: string | null;
  closed_at: string | null;
  cutoff_date: string | null;
  opening_balance_cents: number;
  balance_cents: number;
  archived: number;
}
export interface Category {
  id: string;
  name: string;
  group_name: string;
  category_group_id: string;
  allocation_name: string;
  is_income: number;
}
export interface Transaction {
  id: string;
  account_id: string;
  account_name: string;
  date: string;
  amount_cents: number;
  payee: string;
  payee_id: string | null;
  currency: string;
  fx_rate: number;
  amount_brl_cents: number;
  fx_source: string;
  tags: Tag[];
  allocation_name: string | null;
  category_id: string | null;
  note: string;
  origin: 'imported' | 'manual' | 'adjustment';
  kind: string;
}
export interface ActivationPreview {
  archive_balance_cents: number;
  opening_balance_cents: number;
  adjustment_cents: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}
export interface Payee {
  id: string;
  name: string;
  count: number;
  first_date: string | null;
  last_date: string | null;
}
export interface Named {
  id: string;
  name: string;
  allocation_group_id?: string;
  target_percent?: number;
}
