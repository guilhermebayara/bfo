import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { seedSql } from './seed-data.mjs';
const args = process.argv.slice(2);
if (args.length !== 1 || !['--local', '--remote'].includes(args[0])) {
  console.error('Use --local ou --remote. O seed é exclusivo de homologação.');
  process.exit(1);
}
mkdirSync('.wrangler/seed', { recursive: true });
writeFileSync('.wrangler/seed/ficticio.sql', seedSql());
const result = spawnSync(
  'node',
  [
    'node_modules/wrangler/bin/wrangler.js',
    'd1',
    'execute',
    'DB',
    '--env',
    'homologacao',
    args[0],
    '--file',
    '.wrangler/seed/ficticio.sql',
  ],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
