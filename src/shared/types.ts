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
  closing_day: number | null;
  due_day: number | null;
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
  statement_id: string | null;
  installment_plan_id: string | null;
  installment_number: number | null;
  installment_count: number | null;
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

export interface Statement {
  id: string;
  account_id: string;
  period_start: string;
  closing_date: string;
  due_date: string;
  status: 'open' | 'closed' | 'paid';
  total_cents: number;
  bank_amount_cents: number | null;
  difference_cents: number | null;
  is_current: number;
}

export interface StatementCheck {
  id: string;
  app_amount_cents: number;
  bank_amount_cents: number;
  action: 'search' | 'close';
  created_at: string;
  adjustment_transaction_id: string | null;
}

export interface InstallmentPlan {
  id: string;
  account_id: string;
  description: string;
  total_cents: number;
  count: number;
  first_date: string;
  currency: string;
}

export interface Recurring {
  id: string;
  account_id: string;
  account_name: string;
  currency: string;
  payee: string;
  amount_cents: number;
  category_id: string | null;
  category_name: string | null;
  allocation_name: string | null;
  cadence: string;
  next_date: string;
  interval_days: number | null;
  description: string;
  is_subscription: number;
  subscription_type_id: string | null;
  type_name: string | null;
  renewal_date: string | null;
  active: number;
  due_date: string;
  arrived: boolean;
  actual_cents: number;
  transaction_id: string | null;
  next_charge: string;
  monthly_cents: number;
  renewal_soon: boolean;
}
