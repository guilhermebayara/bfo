import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'jsonc-parser';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const manifesto = JSON.parse(
  readFileSync(join(raiz, 'scripts/confere-manifesto.json')),
);

function checkout(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'bfo-confere-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = {
    ...process.env,
    WORKERS_CI: '',
    WORKERS_CI_BRANCH: '',
    GIT_CONFIG_NOSYSTEM: '1',
  };
  const git = (...args) =>
    execFileSync('git', args, {
      cwd,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const grava = (path, dados) => {
    const arquivo = join(cwd, path);
    mkdirSync(dirname(arquivo), { recursive: true });
    writeFileSync(arquivo, dados);
  };
  const alteraConfig = (alterar) => {
    const config = parse(
      readFileSync(join(cwd, 'wrangler.jsonc'), 'utf8'),
      [],
      { allowTrailingComma: true },
    );
    alterar(config);
    grava('wrangler.jsonc', JSON.stringify(config));
  };
  git('init', '-q');
  git('config', 'user.name', 'Teste da guarda');
  git('config', 'user.email', 'guarda@example.com');
  for (const path of [
    'wrangler.jsonc',
    'package.json',
    'scripts/confere.mjs',
    'scripts/confere-manifesto.json',
    ...Object.keys(manifesto.scripts),
    ...Object.keys(manifesto.migracoes),
  ]) {
    grava(path, readFileSync(join(raiz, path)));
  }
  git('add', '.');
  git('commit', '-qm', 'Base fictícia de homologação');
  git('update-ref', 'refs/remotes/origin/homologacao', 'HEAD');
  mkdirSync(join(cwd, 'node_modules'));
  symlinkSync(
    join(raiz, 'node_modules/jsonc-parser'),
    join(cwd, 'node_modules/jsonc-parser'),
    'dir',
  );
  const roda = (...args) =>
    spawnSync(process.execPath, args.length ? args : ['scripts/confere.mjs'], {
      cwd,
      env,
      encoding: 'utf8',
    });
  return { cwd, env, git, grava, alteraConfig, roda };
}

function aprova(resultado) {
  assert.equal(resultado.status, 0, resultado.stderr);
}

function reprova(resultado, ...mensagens) {
  assert.equal(resultado.status, 1, resultado.stdout + resultado.stderr);
  for (const mensagem of mensagens) assert.match(resultado.stderr, mensagem);
}

for (const [nome, altera, erro] of [
  [
    'DB de produção pelo nome',
    (c) => {
      c.d1_databases[0].database_name = 'bfo-teste';
    },
    /DB de produção/,
  ],
  [
    'DB de produção pelo ID',
    (c) => {
      c.d1_databases[0].database_id = c.previews.d1_databases[0].database_id;
    },
    /DB de produção/,
  ],
  [
    'DB de prévia apontando para produção',
    (c) => {
      c.previews.d1_databases[0].database_name = 'bfo-producao';
    },
    /previews: DB deve/,
  ],
  [
    'DB de prévia apontando para homologação',
    (c) => {
      c.previews.d1_databases[0].database_name = 'bfo-homologacao';
    },
    /previews: DB deve/,
  ],
  [
    'DB de prévia com ID de produção',
    (c) => {
      c.previews.d1_databases[0].database_id = c.d1_databases[0].database_id;
    },
    /previews: DB deve/,
  ],
  [
    'DB_HOMOLOGACAO apontando para outro D1',
    (c) => {
      c.previews.d1_databases[1] = {
        ...c.previews.d1_databases[0],
        binding: 'DB_HOMOLOGACAO',
      };
    },
    /previews: DB_HOMOLOGACAO/,
  ],
  [
    'cron movido para a prévia',
    (c) => {
      c.previews.triggers = c.triggers;
      delete c.triggers;
    },
    /falta o cron de backup/,
  ],
  [
    'cron repetido na prévia',
    (c) => {
      c.previews.triggers = c.triggers;
    },
    /cron de backup pertence somente/,
  ],
  [
    'BACKUPS em outro bucket',
    (c) => {
      c.r2_buckets[0].bucket_name = 'bfo-teste';
    },
    /BACKUPS de produção/,
  ],
]) {
  test(`aprova a configuração BFO e bloqueia ${nome}`, (t) => {
    const { roda, alteraConfig } = checkout(t);
    aprova(roda());
    alteraConfig(altera);
    reprova(roda(), erro);
  });
}

const migracao = 'migrations/9999_teste.sql';
test('aceita migração nova e protege seu conteúdo assim que entra na homologação', (t) => {
  const { cwd, git, grava, roda } = checkout(t);
  grava(migracao, '-- aditiva\n');
  git('add', migracao);
  aprova(roda());
  git('commit', '-qm', 'Acrescenta migração');
  git('update-ref', 'refs/remotes/origin/homologacao', 'HEAD');
  grava(migracao, '-- editada\n');
  reprova(roda(), /9999_teste.sql: migração da homologação alterada/);
  git('add', migracao);
  grava(migracao, '-- aditiva\n');
  reprova(roda(), /9999_teste.sql: migração da homologação alterada/);
  rmSync(join(cwd, migracao));
  git('add', '-u');
  reprova(roda(), /9999_teste.sql: migração da homologação apagada/);
});

test('protege migrações sem a referência remota e usa a homologação anterior quando disponível', (t) => {
  const { git, grava, roda } = checkout(t);
  git('update-ref', '-d', 'refs/remotes/origin/homologacao');
  aprova(roda());
  const original = Object.keys(manifesto.migracoes)[0];
  grava(original, '-- editada\n');
  reprova(roda(), /0001_initial.sql: migração da homologação alterada/);
  git('restore', original);
  grava(migracao, '-- aditiva\n');
  git('add', migracao);
  git('commit', '-qm', 'Migração na homologação anterior');
  git('update-ref', 'refs/bfo/homologacao-anterior', 'HEAD');
  grava(migracao, '-- editada\n');
  git('add', migracao);
  git('commit', '-qm', 'Alteração no push');
  git('update-ref', 'refs/remotes/origin/homologacao', 'HEAD');
  reprova(roda(), /9999_teste.sql: migração da homologação alterada/);
});

test('Workers Builds busca a homologação ou bloqueia o build antes da compilação', (t) => {
  const { cwd, env, git } = checkout(t);
  const ref = 'refs/remotes/origin/homologacao';
  git('update-ref', '-d', ref);
  const build = () =>
    spawnSync('npm', ['run', 'build'], {
      cwd,
      env: { ...env, WORKERS_CI: '1' },
      encoding: 'utf8',
    });
  const semBase = build();
  reprova(
    semBase,
    /Workers Builds: não foi possível buscar origin\/homologacao/,
  );
  assert.doesNotMatch(semBase.stdout, /tsc --noEmit/);

  git('branch', 'homologacao');
  git('remote', 'add', 'origin', '.');
  const comBase = spawnSync(process.execPath, ['scripts/confere.mjs'], {
    cwd,
    env: { ...env, WORKERS_CI: '1' },
    encoding: 'utf8',
  });
  aprova(comBase);
  assert.equal(git('rev-parse', ref), git('rev-parse', 'HEAD'));
});

test('bloqueia scripts de escrita sem revisão e comandos D1 remotos no npm', (t) => {
  const { cwd, git, grava, roda } = checkout(t);
  aprova(roda());
  grava(
    'scripts/seed.mjs',
    "console.log('Script agora aceita bfo-producao');\n",
  );
  grava(
    'scripts/escrita.sh',
    'wrangler d1 execute bfo-producao --remote --file dump.sql\n',
  );
  git('add', 'scripts/escrita.sh');
  const pkg = JSON.parse(readFileSync(join(cwd, 'package.json')));
  pkg.scripts.escrita =
    'wrangler d1 execute bfo-producao --remote --file dump.sql';
  grava('package.json', JSON.stringify(pkg));
  reprova(
    roda(),
    /scripts\/seed.mjs: script novo ou alterado/,
    /scripts\/escrita.sh: script novo ou alterado/,
    /package.json: escrita executa escrita D1/,
  );
});

test('seed aceita D1 local e recusa produção antes de chamar o Wrangler', (t) => {
  const { grava, roda } = checkout(t);
  grava(
    'node_modules/wrangler/index.js',
    'export function experimental_readRawConfig() {}\n',
  );
  grava(
    'node_modules/wrangler/bin/wrangler.js',
    "console.log(process.argv.slice(2).join(' '));\n",
  );
  const local = roda('scripts/seed.mjs', '--local');
  aprova(local);
  assert.match(local.stdout, /d1 execute DB --local/);
  const bloqueado = roda('scripts/seed.mjs', 'bfo-producao');
  reprova(bloqueado, /Seed bloqueado: bfo-producao/);
  assert.equal(bloqueado.stdout, '');
});

test('restauração recusa produção pelo nome, binding ou alias com o ID de produção', (t) => {
  const { cwd, grava, roda } = checkout(t);
  symlinkSync(
    join(raiz, 'node_modules/wrangler'),
    join(cwd, 'node_modules/wrangler'),
    'dir',
  );
  const args = ['scripts/restore-backup.mjs', 'bfo-homologacao', '2026-11-20'];
  for (const target of ['bfo-producao', 'DB']) {
    reprova(
      roda(...args, target, '--local'),
      /Restauração bloqueada: bfo-producao/,
    );
  }
  const config = parse(readFileSync(join(cwd, 'wrangler.jsonc'), 'utf8'), [], {
    allowTrailingComma: true,
  });
  const [production] = config.d1_databases;
  grava(
    'alias.json',
    JSON.stringify({
      d1_databases: [
        { ...production, binding: 'ALIAS', database_name: 'outro-nome' },
      ],
    }),
  );
  reprova(
    roda(...args, 'ALIAS', '--local', '--config', 'alias.json'),
    /Restauração bloqueada: bfo-producao/,
  );
});

test('lista arquivos privados, exportações, e-mail e token sem imprimir os valores', (t) => {
  const { git, grava, roda } = checkout(t);
  grava('publico.txt', 'a@example.com b@example.org c@teste\n');
  git('add', 'publico.txt');
  grava('private-data/fora-do-git.csv', 'fixture\n');
  aprova(roda());
  const arquivos = [
    ['private-data/importado.txt', 'fixture\n'],
    ['config/.dev.vars', 'fixture\n'],
    ['config/.env', 'fixture\n'],
    ['lunch-money-export.csv', 'fixture\n'],
    [
      'dados-sem-nome.json',
      JSON.stringify({
        manual_accounts: [],
        plaid_accounts: [],
        transactions: [],
        balance_history: [],
        recurring_items: [],
      }),
    ],
    ['renomeado.csv', 'date,payee,original name,amount,account\n'],
  ];
  for (const [path, conteudo] of arquivos) grava(path, conteudo);
  const email = ['pessoa', '@example.net'].join('');
  const token = ['ghp_', 'a'.repeat(36)].join('');
  grava('publico.txt', `${email}\n${token}\n`);
  git('add', '--force', 'publico.txt', ...arquivos.map(([path]) => path));
  grava('publico.txt', 'a@example.com\n');
  const resultado = roda();
  reprova(
    resultado,
    /private-data\/importado.txt: arquivo privado/,
    /\.dev.vars: arquivo privado/,
    /\.env: arquivo privado/,
    /lunch-money-export.csv: exportação/,
    /dados-sem-nome.json: exportação/,
    /renomeado.csv: exportação/,
    /publico.txt:1: e-mail/,
    /publico.txt:2: possível token/,
  );
  assert.ok(
    !resultado.stderr.includes(email) && !resultado.stderr.includes(token),
  );
});
