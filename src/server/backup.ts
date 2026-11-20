export type BackupBindings = {
  DB: D1Database;
  BACKUP_DB_HOMOLOGACAO?: D1Database;
  BACKUPS?: R2Bucket;
};

type SchemaEntry = {
  name: string;
  type: 'table' | 'index' | 'view' | 'trigger';
  sql: string;
};
type TableInfo = { name: string; type: string; wr: number; schema: string };
type ColumnInfo = { name: string; hidden: number };
type SqlRow = { values_sql: string };

const catalog = `SELECT type,name,sql FROM main.sqlite_schema
  WHERE sql IS NOT NULL AND name NOT GLOB '_cf_*'
    AND (name NOT GLOB 'sqlite_*' OR name='sqlite_sequence')
  ORDER BY name='sqlite_sequence',rowid`;
const identifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
const dateInSaoPaulo = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function sqlValue(column: string) {
  // SQLite preserva inteiros de 64 bits e blobs sem convertê-los em valores JS.
  return `CASE
    WHEN typeof(${column})='text' AND instr(${column},char(0))>0
      THEN 'CAST(X'''||hex(${column})||''' AS TEXT)'
    WHEN typeof(${column})='real' AND ${column}=9e999 THEN '9e999'
    WHEN typeof(${column})='real' AND ${column}=-9e999 THEN '-9e999'
    ELSE quote(${column}) END`;
}

async function sqlSnapshot(db: D1Database, database: string, day: string) {
  const schemaQuery = db.prepare(catalog);
  const [schema, tableList] = await db.batch([
    schemaQuery,
    db.prepare('PRAGMA table_list'),
  ]);
  const entries = schema.results as SchemaEntry[];
  const tables = entries.filter((entry) => entry.type === 'table');
  if (!tables.length) throw new Error('Banco sem tabelas para exportar.');
  const tableInfo = new Map(
    (tableList.results as TableInfo[])
      .filter((table) => table.schema === 'main')
      .map((table) => [table.name, table]),
  );
  const columns = await db.batch<ColumnInfo>(
    tables.map(({ name }) =>
      db.prepare(`PRAGMA table_xinfo(${identifier(name)})`),
    ),
  );
  const exports = tables.map(({ name, sql }, index) => {
    const info = tableInfo.get(name);
    if (info?.type !== 'table')
      throw new Error('Tipo de tabela incompatível com a restauração no D1.');
    const tableColumns = columns[index].results;
    const writable = tableColumns
      .filter((column) => column.hidden === 0)
      .map((column) => column.name);
    // O histórico de conferência usa a ordem do rowid.
    const rowid = info.wr
      ? undefined
      : ['rowid', '_rowid_', 'oid'].find(
          (alias) =>
            !tableColumns.some((column) => column.name.toLowerCase() === alias),
        );
    const names = (rowid ? [rowid, ...writable] : writable).map(identifier);
    const table = identifier(name);
    return {
      name,
      definition: `${sql};\n`,
      insert: `INSERT INTO ${table} (${names.join(',')}) VALUES`,
      read: db.prepare(
        `SELECT ${names.map(sqlValue).join("||','||")} AS values_sql FROM main.${table}`,
      ),
    };
  });
  // O lote lê todas as linhas na mesma transação. Se uma migração alterou o
  // catálogo desde a leitura inicial, descarte a exportação inteira.
  const [currentSchema, ...rows] = await db.batch([
    schemaQuery,
    ...exports.map(({ read }) => read),
  ]);
  if (JSON.stringify(currentSchema.results) !== JSON.stringify(entries))
    throw new Error('O esquema mudou durante a exportação.');

  const parts = [
    `-- Backup SQL BFO v1 ${database} ${day}\n`,
    'PRAGMA defer_foreign_keys=ON;\n',
    ...exports
      .filter(({ name }) => name !== 'sqlite_sequence')
      .map(({ definition }) => definition),
  ];
  for (const [index, { name, insert }] of exports.entries()) {
    if (name === 'sqlite_sequence')
      parts.push('DELETE FROM sqlite_sequence;\n');
    parts.push(
      (rows[index].results as SqlRow[])
        .map(({ values_sql }) => `${insert}(${values_sql});\n`)
        .join(''),
    );
  }
  // Índices, views e gatilhos ficam depois da carga de dados históricos.
  parts.push(
    ...entries
      .filter(({ type }) => type !== 'table')
      .map(({ sql }) => `${sql};\n`),
  );
  parts.push('-- Fim do backup SQL BFO v1\n');
  return new Blob(parts);
}

export async function scheduledBackup(
  event: ScheduledController,
  env: BackupBindings,
) {
  if (!env.BACKUPS || !env.BACKUP_DB_HOMOLOGACAO)
    throw new Error('Bindings do backup ausentes.');
  const day = dateInSaoPaulo.format(new Date(event.scheduledTime));
  const databases = [
    ['bfo-producao', env.DB],
    ['bfo-homologacao', env.BACKUP_DB_HOMOLOGACAO],
  ] as const;
  const failures = [];
  for (const [name, db] of databases) {
    const key = `d1/${name}/${day}.sql`;
    try {
      if (await env.BACKUPS.head(key)) continue;
      await env.BACKUPS.put(key, await sqlSnapshot(db, name, day), {
        onlyIf: new Headers({ 'If-None-Match': '*' }),
        httpMetadata: { contentType: 'application/sql' },
      });
    } catch {
      // Erros do D1 podem conter trechos de linhas. Registre só a origem.
      failures.push(name);
    }
  }
  if (failures.length)
    throw new Error(`Falha no backup D1 de ${day}: ${failures.join(', ')}.`);
}
