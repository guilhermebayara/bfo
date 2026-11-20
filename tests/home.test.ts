import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import app from '../src/server/index';
import type { Projection } from '../src/shared/home';

const db = env.DB as D1Database;
const day = '2026-11-28';
const request = (path: string, init?: RequestInit) =>
  app.request(`https://bfo.test/api${path}`, init, env);

beforeAll(async () => {
  await applyD1Migrations(db, env.MIGRATIONS);
  const sql = `
    INSERT INTO accounts(id,name,kind,currency,cutoff_date,opening_balance_cents,closing_day,due_day) VALUES
      ('x-checking','Corrente X','checking','BRL','2026-11-01',100000,NULL,NULL),
      ('x-cash','Dinheiro X','cash','BRL','2026-11-01',20000,NULL,NULL),
      ('x-usd','Corrente em dólar X','checking','USD','2026-11-01',10000,NULL,NULL),
      ('x-investment','Investimento X','investment','BRL','2026-11-01',900000,NULL,NULL),
      ('x-card','Cartão X','credit_card','BRL','2026-11-01',0,22,30);
    INSERT INTO fx_rates(currency,date,rate) VALUES ('USD','2026-11-27',5),('USD','2026-11-29',6);
    INSERT INTO category_groups(id,name,allocation_group_id,is_income) VALUES ('x-income','Rendas X','essential',1);
    INSERT INTO categories(id,name,category_group_id) VALUES ('x-salary','Salário X','x-income');
    INSERT INTO recurring(id,account_id,payee,amount_cents,category_id,cadence,next_date) VALUES
      ('x-salary','x-checking','Salário X',-300000,'x-salary','monthly','2026-12-05'),
      ('x-pending','x-checking','Renda pendente X',-8000,'x-salary','yearly','2026-11-24'),
      ('x-overdue','x-checking','Renda atrasada X',-9000,'x-salary','yearly','2026-11-20'),
      ('x-booked','x-checking','Renda agendada X',-40000,'x-salary','monthly','2026-12-13'),
      ('x-uncategorized','x-checking','Crédito sem renda X',-5000,NULL,'yearly','2026-12-14'),
      ('x-bill','x-checking','Conta antes do salário X',175000,NULL,'monthly','2026-11-30');
    INSERT INTO statements(id,account_id,period_start,closing_date,due_date,status,bank_amount_cents) VALUES
      ('x-scheduled-invoice','x-card','2026-11-01','2026-11-22','2026-11-30','closed',30000),
      ('x-open-invoice','x-card','2026-11-23','2026-12-05','2026-12-10','open',NULL);
    INSERT INTO transactions(id,account_id,date,amount_cents,amount_brl_cents,payee,origin,kind,statement_id) VALUES
      ('x-current','x-checking','2026-11-28',10000,10000,'Compra de hoje X','manual','regular',NULL),
      ('x-open-purchase','x-card','2026-12-01',25000,25000,'Compra futura X','manual','regular','x-open-invoice'),
      ('x-booked-income','x-checking','2026-12-13',-40000,-40000,'Renda agendada X','manual','regular',NULL);
    INSERT INTO transactions(id,account_id,date,amount_cents,amount_brl_cents,payee,origin,kind,transfer_pair_id) VALUES
      ('x-internal','x-checking','2026-11-29',90000,90000,'Transferência interna X','manual','transfer','x-internal-credit'),
      ('x-internal-credit','x-cash','2026-11-29',-90000,-90000,'Transferência interna X','manual','transfer','x-internal'),
      ('x-invest','x-checking','2026-12-12',12000,12000,'Aporte X','manual','transfer','x-invest-credit'),
      ('x-invest-credit','x-investment','2026-12-12',-12000,-12000,'Aporte X','manual','transfer','x-invest');`;
  await db.batch(
    sql
      .split(';')
      .filter((statement) => statement.trim())
      .map((statement) => db.prepare(statement)),
  );
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${day}T12:00:00-03:00`));
});
afterEach(() => vi.useRealTimers());

it('projeta a virada do mês, com vale antes do salário e cada pagamento contado uma vez', async () => {
  const paid = await request('/statements/x-scheduled-invoice/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_id: 'x-checking', date: '2026-12-02' }),
  });
  expect(paid.status).toBe(201);
  const response = await request('/home');
  expect(response.status).toBe(200);
  const data = await response.json<{ day: string; projection: Projection }>();
  expect(data.day).toBe(day);
  expect(data.projection).toMatchObject({
    to: '2026-12-28',
    opening_cents: 160000,
    income_cents: 308000,
    scheduled_income_cents: 40000,
    expense_cents: 242000,
    ending_cents: 266000,
    low_cents: -37000,
    low_date: '2026-12-02',
    has_income_recurring: true,
    missing_rates: [],
  });
  expect(
    data.projection.entries.map(({ date, item, brl_cents }) => [
      date,
      item.type,
      brl_cents,
    ]),
  ).toEqual([
    ['2026-11-28', 'recurring', 8000],
    ['2026-11-30', 'recurring', 175000],
    ['2026-12-02', 'payment', 30000],
    ['2026-12-05', 'recurring', 300000],
    ['2026-12-10', 'statement', 25000],
    ['2026-12-12', 'transfer', 12000],
    ['2026-12-13', 'scheduled', 40000],
  ]);
});
