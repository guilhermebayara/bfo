import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { runPreviewD1 } from './preview-d1.mjs';
import {
  buildImport,
  collectFromApi,
  normalizeFixtures,
  wipeImportSql,
} from '../src/server/lunchmoney.ts';

const command = process.argv[2];
const outputFile = process.argv.includes('--saida')
  ? process.argv[process.argv.indexOf('--saida') + 1]
  : 'private-data/lunchmoney.json';

if (
  process.argv.some((arg) => arg === '--token' || arg.startsWith('--token='))
) {
  console.error(
    'O token não entra na linha de comando. Digite quando o comando pedir.',
  );
  process.exit(1);
}

function fixtureDir() {
  const next = process.argv[process.argv.indexOf('--fixtures') + 1];
  if (next && !next.startsWith('--')) return next;
  return 'tests/fixtures/lunchmoney';
}

function readFixtures(dir) {
  const files = {};
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    files[name] = JSON.parse(readFileSync(join(dir, name), 'utf8'));
  }
  return normalizeFixtures(files);
}

async function readToken() {
  if (!input.isTTY) {
    const data = readFileSync(0, 'utf8').trim();
    if (!data) throw new Error('Token vazio.');
    return data;
  }
  const prompt = createInterface({ input, output });
  const token = (await prompt.question('Token do Lunch Money: ')).trim();
  prompt.close();
  if (!token) throw new Error('Token vazio.');
  return token;
}

function databaseTarget() {
  const local = process.argv.includes('--local');
  const teste = process.argv.includes('--teste');
  const blocked = process.argv.some((arg) =>
    /homolog|producao|produção|bfo-producao/i.test(arg),
  );
  if (blocked || local === teste) {
    console.error(
      'Informe só --local ou só --teste. Homologação e produção ficam de fora.',
    );
    process.exit(1);
  }
  return local ? 'local' : 'teste';
}

function runSql(statements) {
  const where = databaseTarget();
  const path = '.wrangler/importacao.sql';
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${statements.join(';\n')};\n`);
  if (where === 'local') {
    const result = spawnSync(
      process.execPath,
      [
        'node_modules/wrangler/bin/wrangler.js',
        'd1',
        'execute',
        'DB',
        '--local',
        '--file',
        path,
      ],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      process.exit(result.status ?? 1);
    }
    return;
  }
  const status = runPreviewD1('bfo-teste', ['execute'], ['--file', path]);
  if (status !== 0) process.exit(status);
}

function printReport(report) {
  console.log(JSON.stringify(report, null, 2));
}

if (command === 'coletar') {
  let snapshot;
  if (process.argv.includes('--fixtures'))
    snapshot = readFixtures(fixtureDir());
  else {
    const token = await readToken();
    try {
      snapshot = await collectFromApi({ token });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha na coleta.';
      console.error(message.includes(token) ? 'Falha na coleta.' : message);
      process.exit(1);
    }
  }
  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Coleta gravada em ${outputFile}.`);
} else if (command === 'carregar') {
  const explicit = process.argv.find(
    (arg, index) => index > 2 && arg.endsWith('.json'),
  );
  const snapshot = JSON.parse(readFileSync(explicit || outputFile, 'utf8'));
  const { statements, report } = buildImport(snapshot);
  runSql(statements);
  printReport(report);
} else if (command === 'apagar') {
  runSql(wipeImportSql());
  console.log('Importação removida. Lançamentos manuais foram preservados.');
} else {
  console.error('Use coletar, carregar ou apagar.');
  process.exit(1);
}
