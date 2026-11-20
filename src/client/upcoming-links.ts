import type { DueComponent, DueItem } from '../shared/home';
import { transactionsUrl } from './transaction-filters';

export function statementUrl(account: string, statement: string) {
  return `/cartao?${new URLSearchParams({ account, statement })}`;
}

export function recurringUrl(recurring: string, date: string) {
  return `/recorrentes?${new URLSearchParams({ month: date.slice(0, 7), recurring, date })}`;
}

export function dueItemUrl(item: DueItem, forecast = false) {
  if (item.type === 'statement')
    return (
      statementUrl(item.account_id, item.id) + (forecast ? '&previsao=1' : '')
    );
  if (item.type === 'recurring')
    return recurringUrl(item.recurring_id, item.date);
  return transactionsUrl(item.date.slice(0, 7), {
    account: item.account_id,
    transaction: item.id,
  });
}

export function dueComponentUrl(account: string, component: DueComponent) {
  if (!component.date) return null;
  if (component.recurring_id)
    return recurringUrl(component.recurring_id, component.date);
  return transactionsUrl(component.date.slice(0, 7), {
    account,
    transaction: component.id,
  });
}
