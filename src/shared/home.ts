export type DueComponent = {
  id: string;
  type: string;
  label: string;
  amount_cents: number;
  date?: string;
};

export type DueItem = {
  id: string;
  type: 'statement' | 'recurring' | 'transfer' | 'payment' | 'scheduled';
  label: string;
  date: string;
  amount_cents: number;
  currency: string;
  account_id: string;
  account_name: string;
  components: DueComponent[];
  recurring_id?: string;
  destination_account_id?: string | null;
};

export type ProjectionBalance = {
  id: string;
  name: string;
  currency: string;
  balance_cents: number;
  brl_cents: number | null;
};

export type ProjectionEntry = {
  item: DueItem;
  date: string;
  brl_cents: number | null;
  kind: 'income' | 'scheduled_income' | 'expense';
};

export type Projection = {
  to: string;
  balances: ProjectionBalance[];
  entries: ProjectionEntry[];
  missing_rates: string[];
  has_income_recurring: boolean;
  opening_cents: number;
  income_cents: number;
  scheduled_income_cents: number;
  expense_cents: number;
  ending_cents: number;
  low_cents: number;
  low_date: string;
};

export type AttentionItem = {
  id: string;
  account_id: string;
  label: string;
} & (
  | { type: 'statement' | 'recurring' | 'renewal'; date: string }
  | { type: 'balance'; date: string | null }
);

export type MonthSummaryItem = {
  category_id: string | null;
  category_name: string;
  group_id: string | null;
  group_name: string;
  is_income: number;
  exclude_budget: number;
  amount_cents: number;
};

export type MonthPeriod = { month: string; from: string; to: string };
export type MonthComparison = {
  current: MonthPeriod;
  previous: MonthPeriod;
  groups: {
    id: string | null;
    label: string;
    is_income: number;
    current_cents: number;
    previous_cents: number;
  }[];
};
