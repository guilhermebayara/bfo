import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { seedSql } from '../scripts/seed-data.mjs';

const wrangler = 'node_modules/wrangler/bin/wrangler.js';
const sqlString = (value) => `'${value.replaceAll("'", "''")}'`;
const identifier = (name) => `"${name.replaceAll('"', '""')}"`;

test(
  'exporta os dois D1 pelo cron e restaura o SQL baixado do R2 local',
  { timeout: 120_000 },
  async (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'bfo-teste-backup-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const state = ['--local', '--persist-to', join(directory, 'state')];
    const env = {
      ...process.env,
      WRANGLER_SEND_METRICS: 'false',
      XDG_CONFIG_HOME: directory,
    };
    const run = (script, args, input) =>
      execFileSync(process.execPath, [script, ...args], {
        env,
        input,
        stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
        encoding: 'utf8',
        timeout: 35_000,
      });
    const db = (target, command, config = []) =>
      JSON.parse(
        run(wrangler, [
          'd1',
          'execute',
          target,
          ...state,
          ...config,
          '--json',
          '--command',
          command,
        ]),
      );
    const seed = join(directory, 'seed.sql');
    writeFileSync(seed, seedSql());
    for (const source of ['DB', 'BACKUP_DB_HOMOLOGACAO']) {
      run(wrangler, ['d1', 'migrations', 'apply', source, ...state, '--force']);
      run(wrangler, ['d1', 'execute', source, ...state, '--file', seed]);
    }
    db(
      'DB',
      `CREATE TABLE "amostra backup" (amount_cents INTEGER, note TEXT, bytes BLOB);
    INSERT INTO "amostra backup" (rowid,amount_cents,note,bytes)
    VALUES(7,42,'d''água;'||char(10)||'linha'||char(0)||'fim',X'00FF');`,
    );

    const worker = spawn(
      process.execPath,
      [
        wrangler,
        'dev',
        ...state,
        '--ip',
        '127.0.0.1',
        '--port',
        '0',
        '--test-scheduled',
      ],
      { env },
    );
    const closed = once(worker, 'close');
    let log = '';
    worker.stderr.on('data', (chunk) => {
      log += chunk;
    });
    try {
      const url = await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(`Worker local indisponível.\n${log}`)),
          20_000,
        );
        worker.once('close', () => {
          clearTimeout(timeout);
          reject(new Error(`Worker local encerrou.\n${log}`));
        });
        worker.stdout.on('data', (chunk) => {
          log += chunk;
          const address = log.match(
            /Ready on (http:\/\/(?:127\.0\.0\.1|localhost):\d+)/,
          )?.[1];
          if (address) {
            clearTimeout(timeout);
            resolve(address);
          }
        });
      });
      const scheduled = new URL('/cdn-cgi/local/scheduled', url);
      scheduled.search = new URLSearchParams({
        cron: '0 6 * * *',
        time: String(Date.parse('2026-11-21T01:00:00Z')),
      });
      const response = await fetch(scheduled, {
        signal: AbortSignal.timeout(15_000),
      });
      assert.equal(response.status, 200, `${await response.text()}\n${log}`);
    } finally {
      worker.kill();
      await closed;
    }

    const day = '2026-11-20'; // 01h UTC ainda é o dia anterior em São Paulo.
    for (const source of ['bfo-producao', 'bfo-homologacao']) {
      const file = join(directory, `${source}.sql`);
      run(wrangler, [
        'r2',
        'object',
        'get',
        `bfo-backups/d1/${source}/${day}.sql`,
        ...state,
        '--file',
        file,
      ]);
      const sql = readFileSync(file, 'utf8');
      assert.ok(sql.includes('INSERT INTO "d1_migrations"'));
      assert.equal(
        sql.includes('CREATE TABLE "amostra backup"'),
        source === 'bfo-producao',
      );
    }

    const config = ['--config', join(directory, 'destino.json')];
    const target = 'restauro-local';
    writeFileSync(
      config[1],
      JSON.stringify({
        d1_databases: [
          {
            binding: 'DESTINO',
            database_name: target,
            database_id: '5c823188-a876-42cd-8d87-643b3b7be20c',
          },
        ],
      }),
    );
    const restore = ['bfo-producao', day, target, ...state, ...config];
    const inventory = `SELECT type,name,sql FROM sqlite_schema WHERE sql IS NOT NULL
    AND name NOT GLOB '_cf_*' AND name NOT GLOB 'sqlite_*' ORDER BY type,name`;
    const sourceSchema = db('DB', inventory)[0].results;
    const tables = sourceSchema.filter((row) => row.type === 'table');
    const columns = db(
      'DB',
      tables
        .map(({ name }) => `PRAGMA table_info(${identifier(name)})`)
        .join(';\n'),
    );
    const stats = tables
      .map(
        ({ name }, index) => `
    SELECT ${sqlString(name)} AS tabela, COUNT(*) AS linhas,
      ${
        columns[index].results.some((col) => col.name === 'amount_cents')
          ? 'SUM(amount_cents)'
          : 'NULL'
      } AS soma_cents FROM ${identifier(name)}`,
      )
      .join(';\n');
    const results = (target, config) =>
      db(target, stats, config).flatMap((row) => row.results);
    const sourceStats = results('DB');
    assert.ok(
      sourceStats.some(
        (row) => row.tabela === 'd1_migrations' && row.linhas > 0,
      ),
    );
    assert.deepEqual(db(target, inventory, config)[0].results, []);
    run('scripts/restore-backup.mjs', restore, `${target}\n`);
    assert.deepEqual(db(target, inventory, config)[0].results, sourceSchema);
    assert.deepEqual(results(target, config), sourceStats);
    assert.deepEqual(
      db(target, 'PRAGMA foreign_key_check', config)[0].results,
      [],
    );
    assert.deepEqual(
      db(
        target,
        'SELECT rowid, hex(note) AS note, hex(bytes) AS bytes FROM "amostra backup"',
        config,
      )[0].results,
      db(
        'DB',
        'SELECT rowid, hex(note) AS note, hex(bytes) AS bytes FROM "amostra backup"',
      )[0].results,
    );

    db(target, 'UPDATE "amostra backup" SET amount_cents=99', config);
    assert.throws(
      () => run('scripts/restore-backup.mjs', restore, 'cancelar\n'),
      /Restauração cancelada/,
    );
    assert.equal(
      db(target, 'SELECT amount_cents FROM "amostra backup"', config)[0]
        .results[0].amount_cents,
      99,
    );
    run('scripts/restore-backup.mjs', restore, `${target}\n`);
    assert.deepEqual(results(target, config), sourceStats);
  },
);
