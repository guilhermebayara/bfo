import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import app from '../../src/server/index';
import { seedSql } from '../../scripts/seed-data.mjs';

export const db = env.DB as D1Database;

export const req = (path: string, method = 'GET', body?: object) =>
  app.request(
    `https://bfo.test/api${path}`,
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    },
    env,
  );

export async function migrateOnly() {
  await applyD1Migrations(db, env.MIGRATIONS);
}

export async function migrateAndSeed() {
  await applyD1Migrations(db, env.MIGRATIONS);
  await db.exec(seedSql());
}

export async function json<T = any>(
  path: string,
  method = 'GET',
  body?: object,
): Promise<{ status: number; body: T }> {
  const response = await req(path, method, body);
  const text = await response.text();
  let parsed: T;
  try {
    parsed = text ? JSON.parse(text) : (null as T);
  } catch {
    parsed = text as T;
  }
  return { status: response.status, body: parsed };
}

export async function createChecking(name: string, opening = 0) {
  const { status, body } = await json<{ id: string }>('/accounts', 'POST', {
    name,
    kind: 'checking',
    currency: 'BRL',
    institution_id: 'horizonte',
    opening_balance_cents: opening,
  });
  if (status !== 201) throw new Error(`conta corrente: ${status}`);
  return body.id;
}

export async function createCard(
  name: string,
  options: {
    limit?: number | null;
    closing?: number;
    due?: number;
    currency?: string;
  } = {},
) {
  const { status, body } = await json<{ id: string }>('/accounts', 'POST', {
    name,
    kind: 'credit_card',
    currency: options.currency ?? 'BRL',
    institution_id: 'brisa',
    opening_balance_cents: 0,
    closing_day: options.closing ?? 20,
    due_day: options.due ?? 27,
    credit_limit_cents: options.limit === undefined ? 500000 : options.limit,
  });
  if (status !== 201) throw new Error(`cartão: ${status}`);
  return body.id;
}
