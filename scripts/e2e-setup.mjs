import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { seedSql } from './seed-data.mjs';
// Diretório exclusivo dos testes. Nunca apaga o D1 do desenvolvimento.
rmSync('.wrangler/e2e', { recursive: true, force: true });
mkdirSync('.wrangler/e2e', { recursive: true });
writeFileSync('.wrangler/e2e/seed.sql', seedSql());
for (const args of [
  [
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--env',
    'homologacao',
    '--persist-to',
    '.wrangler/e2e/state',
  ],
  [
    'd1',
    'execute',
    'DB',
    '--local',
    '--env',
    'homologacao',
    '--persist-to',
    '.wrangler/e2e/state',
    '--file',
    '.wrangler/e2e/seed.sql',
  ],
]) {
  const result = spawnSync(
    'node',
    ['node_modules/wrangler/bin/wrangler.js', ...args],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr);
    process.exit(result.status ?? 1);
  }
}
console.log('D1 isolado dos testes preparado com dados fictícios.');
