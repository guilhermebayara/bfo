export interface Account {
  id: string;
  name: string;
  kind: 'checking' | 'credit_card' | 'cash';
  currency: 'BRL';
  cutoff_date: string | null;
  opening_balance_cents: number;
  balance_cents: number;
  archived: number;
}
export interface Category {
  id: string;
  name: string;
  group_name: string;
}
export interface Transaction {
  id: string;
  account_id: string;
  account_name: string;
  date: string;
  amount_cents: number;
  payee: string;
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
