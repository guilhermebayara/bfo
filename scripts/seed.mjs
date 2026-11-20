import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runPreviewD1 } from './preview-d1.mjs';
import { seedSql } from './seed-data.mjs';

const [target, ...extra] = process.argv.slice(2);
if (target?.toLowerCase() === 'bfo-producao') {
  console.error(
    'Seed bloqueado: bfo-producao não pode receber dados fictícios.',
  );
  process.exit(1);
}
if (
  extra.length ||
  !['--local', 'bfo-teste', 'bfo-homologacao'].includes(target)
) {
  console.error(
    'Use --local, bfo-teste ou bfo-homologacao. Produção é bloqueada.',
  );
  process.exit(1);
}

const file = '.wrangler/seed/ficticio.sql';
mkdirSync('.wrangler/seed', { recursive: true });
writeFileSync(file, seedSql());

if (target === '--local') {
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      '--local',
      '--file',
      file,
    ],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} else {
  process.exitCode = runPreviewD1(target, ['execute'], ['--file', file]);
}
