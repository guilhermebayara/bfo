import { spawnSync } from 'node:child_process';
import { runPreviewD1 } from './preview-d1.mjs';

const branch = process.env.WORKERS_CI_BRANCH;
if (!branch) {
  if (process.env.WORKERS_CI === '1' || process.env.WORKERS_CI === 'true') {
    throw new Error('Workers Builds não informou a branch para escolher o D1.');
  }
} else if (branch === 'main') {
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'migrations',
      'apply',
      'bfo-producao',
      '--remote',
      '--force',
    ],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} else {
  const alias = branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (alias === 'homologacao' && branch !== 'homologacao') {
    throw new Error(
      'O endereço de homologação é reservado à branch homologacao.',
    );
  }
  const database = branch === 'homologacao' ? 'bfo-homologacao' : 'bfo-teste';
  process.exitCode = runPreviewD1(
    database,
    ['migrations', 'apply'],
    ['--force'],
  );
}
