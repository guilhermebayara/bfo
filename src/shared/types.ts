export interface Account {
  id: string;
  name: string;
  kind:
    'checking' | 'credit_card' | 'cash' | 'investment' | 'property' | 'loan';
  currency: string;
  institution_id: string | null;
  institution_name: string | null;
  last_reconciled_at: string | null;
  closed_at: string | null;
  cutoff_date: string | null;
  opening_balance_cents: number;
  balance_cents: number;
  archived: number;
  credit_limit_cents?: number | null;
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
  exclude_budget: number;
  exclude_totals: number;
  effective_income: number;
  effective_exclude_budget: number;
  effective_exclude_totals: number;
  inherited_income: number;
  inherited_exclude_budget: number;
  inherited_exclude_totals: number;
}
export interface Transaction {
  id: string;
  account_id: string;
  account_name: string;
  destination_name?: string | null;
  destination_account_id?: string | null;
  destination_amount_cents?: number | null;
  destination_currency?: string | null;
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
  statement_status?: string | null;
  installment_plan_id: string | null;
  retroactive: number;
  added_to_closed: number;
  advance_id: string | null;
  split_count: number;
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
  has_default: number;
  default_category_id: string | null;
  default_tag_ids: string[];
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
  paid_cents?: number;
  bank_amount_cents: number | null;
  difference_cents: number | null;
  is_current: number;
  scheduled_closing_date?: string;
  previous_balance_cents?: number;
  carried_out_cents?: number;
  remaining_cents?: number;
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
  notice_days: number;
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

export interface TransactionSplit {
  id: string;
  amount_cents: number;
  amount_brl_cents: number;
  category_id: string | null;
  note: string;
  tags: Tag[];
}
export interface InstallmentAdvance {
  id: string;
  count: number;
  face_cents: number;
  paid_cents: number;
  created_at: string;
}
