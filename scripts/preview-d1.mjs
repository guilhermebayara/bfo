import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { experimental_readRawConfig } from 'wrangler';

// Os comandos D1 do Wrangler leem os bindings do nível principal.
export function runPreviewD1(databaseName, args, flags) {
  const { rawConfig } = experimental_readRawConfig({
    config: 'wrangler.jsonc',
  });
  // O backup lê a homologação em produção. O banco servido pela API continua protegido.
  const productionDatabases = rawConfig.d1_databases?.filter(
    ({ binding, database_name }) =>
      binding !== 'BACKUP_DB_HOMOLOGACAO' ||
      database_name !== 'bfo-homologacao',
  );
  const database = rawConfig.previews?.d1_databases?.find(
    (entry) => entry.database_name === databaseName,
  );

  if (
    !['bfo-teste', 'bfo-homologacao'].includes(databaseName) ||
    !database?.database_id ||
    !productionDatabases?.length ||
    productionDatabases.some(
      (entry) =>
        entry.database_id === database.database_id ||
        entry.database_name === database.database_name,
    )
  ) {
    throw new Error('Banco de prévia inválido ou compartilhado com produção.');
  }

  mkdirSync('.wrangler', { recursive: true });
  const dir = mkdtempSync('.wrangler/d1-preview-');
  const config = join(dir, 'wrangler.json');
  try {
    writeFileSync(
      config,
      JSON.stringify({
        account_id: rawConfig.account_id,
        compatibility_date: rawConfig.compatibility_date,
        d1_databases: [
          {
            ...database,
            migrations_dir: relative(
              dir,
              resolve(database.migrations_dir ?? 'migrations'),
            ),
          },
        ],
      }),
    );
    const result = spawnSync(
      process.execPath,
      [
        'node_modules/wrangler/bin/wrangler.js',
        'd1',
        ...args,
        databaseName,
        '--config',
        config,
        '--remote',
        ...flags,
      ],
      { stdio: 'inherit' },
    );
    if (result.error) throw result.error;
    return result.status ?? 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
