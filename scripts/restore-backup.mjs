import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const wrangler = fileURLToPath(
  new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url),
);

function run(args, failure, logPath) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    env: {
      ...process.env,
      WRANGLER_LOG_PATH: logPath,
      WRANGLER_LOG_SANITIZE: 'true',
    },
    encoding: 'utf8',
    stdio: ['ignore', args.includes('--json') ? 'pipe' : 'ignore', 'ignore'],
  });
  // A saída do Wrangler pode conter o SQL com dados reais.
  if (result.status !== 0) throw new Error(failure);
  return result.stdout;
}

async function restore() {
  const {
    values,
    positionals: [source, day, target, ...extra],
  } = parseArgs({
    allowPositionals: true,
    options: {
      local: { type: 'boolean' },
      cloud: { type: 'boolean' },
      'persist-to': { type: 'string' },
      config: { type: 'string' },
    },
  });
  if (
    extra.length ||
    !['bfo-producao', 'bfo-homologacao'].includes(source) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day ?? '') ||
    !Number.isFinite(Date.parse(day)) ||
    new Date(day).toISOString().slice(0, 10) !== day ||
    !/^[\w-]+$/.test(target ?? '') ||
    Boolean(values.local) === Boolean(values.cloud) ||
    (values['persist-to'] && !values.local)
  ) {
    throw new Error(
      'Use node scripts/restore-backup.mjs ORIGEM AAAA-MM-DD DESTINO --local [--persist-to PASTA] ou --cloud.',
    );
  }

  const options = [values.local ? '--local' : '--remote'];
  if (values['persist-to']) options.push('--persist-to', values['persist-to']);
  if (values.config) options.push('--config', values.config);
  const key = `d1/${source}/${day}.sql`;
  const directory = mkdtempSync(join(tmpdir(), 'bfo-restauracao-'));
  const file = join(directory, 'backup.sql');
  try {
    run(
      ['r2', 'object', 'get', `bfo-backups/${key}`, ...options, '--file', file],
      `Não foi possível baixar ${key} do bucket bfo-backups.`,
      directory,
    );
    const backup = readFileSync(file, 'utf8');
    if (
      !backup.startsWith(`-- Backup SQL BFO v1 ${source} ${day}\n`) ||
      !backup.endsWith('-- Fim do backup SQL BFO v1\n')
    )
      throw new Error(
        'O arquivo baixado não corresponde ao backup solicitado ou está incompleto.',
      );

    const d1 = ['d1', 'execute', target, ...options];
    const [{ results: objects }] = JSON.parse(
      run(
        [
          ...d1,
          '--json',
          '--command',
          `
      SELECT type,name FROM sqlite_schema
      WHERE sql IS NOT NULL AND type IN ('table','view','trigger')
        AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*'
      ORDER BY CASE type WHEN 'trigger' THEN 0 WHEN 'view' THEN 1 ELSE 2 END, rowid DESC
    `,
        ],
        `Não foi possível consultar o esquema do D1 ${target}.`,
        directory,
      ),
    );

    const dialog = createInterface({ input: stdin, output: stdout });
    const location = values.local
      ? `local (${values['persist-to'] ?? '.wrangler/state'})`
      : 'Cloudflare';
    let answer;
    try {
      stdout.write(
        `Restaurar ${key} em ${target}, ${location}. O esquema e os dados atuais do destino serão substituídos. Digite ${target} para confirmar: `,
      );
      ({ value: answer } = await dialog[Symbol.asyncIterator]().next());
    } finally {
      dialog.close();
    }
    if (answer !== target) throw new Error('Restauração cancelada.');

    const drop = objects
      .map(
        ({ type, name }) =>
          `DROP ${type.toUpperCase()} "${name.replaceAll('"', '""')}";\n`,
      )
      .join('');
    if (drop)
      writeFileSync(file, `PRAGMA defer_foreign_keys=ON;\n${drop}${backup}`);
    run(
      [...d1, '--yes', '--file', file],
      `Falha ao aplicar o backup no D1 ${target}.`,
      directory,
    );
    console.log(`Backup restaurado em ${target}.`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

try {
  await restore();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
