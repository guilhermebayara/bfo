#!/usr/bin/env node
/**
 * I01–I04 via CLI no D1 local (docs/importacao.md).
 * Roda: node tests/aceitacao/i-importacao-cli.mjs
 * Não usa --remote. Só dados fictícios dos fixtures.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const run = (cmd) =>
  execSync(cmd, {
    cwd: new URL('../..', import.meta.url).pathname,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const d1 = (sql) => {
  const out = run(
    `npx wrangler d1 execute DB --local --command ${JSON.stringify(sql)} --json`,
  );
  const parsed = JSON.parse(out);
  const result = Array.isArray(parsed) ? parsed[0] : parsed;
  return result?.results ?? result?.result?.[0]?.results ?? [];
};

const failures = [];
const note = (id, msg) => failures.push(`${id}: ${msg}`);

mkdirSync('private-data', { recursive: true });

console.log('=== coletar --fixtures ===');
console.log(run('node scripts/importar-lunchmoney.mjs coletar --fixtures'));

console.log('=== apagar --local (estado limpo da importação) ===');
try {
  console.log(run('node scripts/importar-lunchmoney.mjs apagar --local'));
} catch (e) {
  console.log(String(e.stdout || e.message));
}

console.log('=== carregar --local ===');
const loadOut = run('node scripts/importar-lunchmoney.mjs carregar --local');
console.log(loadOut);

// I01: LEIA-ME
const cents = d1(
  "SELECT amount_cents FROM transactions WHERE id='lm:tx:90021' OR external_id LIKE '%90021%' LIMIT 1",
);
if (!cents.length || Number(cents[0].amount_cents) !== 123457) {
  note('I01', `90021 deveria arredondar para 123457, veio ${JSON.stringify(cents)}`);
}

const pending = d1(
  "SELECT COUNT(*) AS c FROM transactions WHERE note LIKE '%pendente no Lunch Money%'",
);
if (Number(pending[0]?.c) < 1) note('I01', 'faltou nota de pendente');

const deleted = d1(
  "SELECT COUNT(*) AS c FROM transactions WHERE id LIKE '%90016%' OR external_id LIKE '%90016%'",
);
if (Number(deleted[0]?.c) !== 0) note('I01', 'delete_pending 90016 não deveria entrar');

const onlyFile = d1(
  "SELECT COUNT(*) AS c FROM accounts WHERE id LIKE 'lm:account:%' AND cutoff_date IS NULL AND closed_at IS NULL",
);
if (Number(onlyFile[0]?.c) < 1) note('I01', 'contas ativas importadas deveriam nascer sem corte');

const closed = d1(
  "SELECT COUNT(*) AS c FROM accounts WHERE id LIKE 'lm:account:%' AND closed_at IS NOT NULL",
);
if (Number(closed[0]?.c) < 1) note('I01', 'conta encerrada do fixture não apareceu');

// I03
const alloc = d1(
  "SELECT id,target_percent FROM allocation_groups WHERE name='Importado'",
);
if (!alloc.length || Number(alloc[0].target_percent) !== 0) {
  note('I03', 'alocação Importado com 0% ausente');
}

// I04 relatório na saída do carregar
if (!/pendente/i.test(loadOut) && !/"pendentes":\s*1/.test(loadOut)) {
  // o script imprime quantidades; aceita qualquer menção a pendentes
  if (!/pendentes/i.test(loadOut)) note('I04', 'relatório do carregar não citou pendentes');
}

const importedBefore = Number(
  d1("SELECT COUNT(*) AS c FROM transactions WHERE id LIKE 'lm:%' OR external_id LIKE 'lm:%'")[0]?.c,
);

// manual para I02
run(
  `npx wrangler d1 execute DB --local --command ${JSON.stringify(
    `INSERT OR REPLACE INTO transactions(id,account_id,date,amount_cents,payee,origin,kind,currency,fx_rate,amount_brl_cents,fx_source) VALUES('qa-cli-manual','checking','2026-11-01',321,'Manual CLI QA','manual','regular','BRL',1,321,'manual')`,
  )} --json`,
);

console.log('=== apagar --local ===');
console.log(run('node scripts/importar-lunchmoney.mjs apagar --local'));

const importedAfterWipe = Number(
  d1("SELECT COUNT(*) AS c FROM transactions WHERE id LIKE 'lm:%' OR external_id LIKE 'lm:%'")[0]?.c,
);
if (importedAfterWipe !== 0) note('I02', 'apagar não removeu importados');

const manualKept = d1(
  "SELECT amount_cents FROM transactions WHERE id='qa-cli-manual'",
);
if (!manualKept.length || Number(manualKept[0].amount_cents) !== 321) {
  note('I02', 'apagar removeu lançamento manual');
}

console.log('=== carregar --local de novo ===');
console.log(run('node scripts/importar-lunchmoney.mjs carregar --local'));
const importedAgain = Number(
  d1("SELECT COUNT(*) AS c FROM transactions WHERE id LIKE 'lm:%' OR external_id LIKE 'lm:%'")[0]?.c,
);
if (importedAgain !== importedBefore) {
  note(
    'I02',
    `recarga divergiu: antes=${importedBefore} depois=${importedAgain}`,
  );
}

console.log('=== carregar --local idempotente ===');
console.log(run('node scripts/importar-lunchmoney.mjs carregar --local'));
const importedIdem = Number(
  d1("SELECT COUNT(*) AS c FROM transactions WHERE id LIKE 'lm:%' OR external_id LIKE 'lm:%'")[0]?.c,
);
if (importedIdem !== importedAgain) {
  note('I02', `segunda carga duplicou: ${importedAgain} -> ${importedIdem}`);
}

const report = {
  ok: failures.length === 0,
  failures,
  importedBefore,
  importedAgain,
  importedIdem,
};
writeFileSync(
  'docs/qa/i-importacao-cli-resultado.json',
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
