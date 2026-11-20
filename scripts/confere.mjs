import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { parse } from 'jsonc-parser';

const producao = 'bfo-producao';
const homologacao = 'bfo-homologacao';
const idProducao = '32c0ee02-7cdf-4fc7-b83f-e8808ba3f4de';
const idHomologacao = '9db4bc67-bacb-4176-8701-34d24f7c7bce';
const cronBackup = '0 6 * * *';
const manifesto = 'scripts/confere-manifesto.json';
const falhas = new Set();
const git = (...args) =>
  execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 });
const lista = (buffer) => buffer.toString().split('\0').filter(Boolean);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const email = /(?<![\w@])[\w.+%-]+@([a-z\d-]+(?:\.[a-z\d-]+)*)(?![\w-])/gi;
const dominioFicticio = /^(?:example\.(?:com|org)|teste)$/i;
const tokens = [
  /\b(?:gh[pousr]_[a-z\d]{36,}|github_pat_[a-z\d_]{22,}|xox[baprs]-[a-z\d-]{12,}|(?:AKIA|ASIA)[A-Z\d]{16}|AIza[a-z\d_-]{35}|(?:sk|rk)_(?:live|test)_[a-z\d]{16,}|(?:sk|pk)-[a-z\d_-]{20,})\b/i,
  /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/,
  /\beyJ[a-z\d_-]{8,}\.eyJ[a-z\d_-]{8,}\.[a-z\d_-]{12,}\b/i,
  /\bBearer [a-z\d._~+/-]{20,}/i,
  /\b(?:[\w-]*(?:api[_-]?key|api[_-]?token|access[_-]?token|client[_-]?secret)|token)["']?\s*[:=]\s*["']?[a-z\d_-]{20,}(?=["'\s,;}]|$)/i,
];

function confereWrangler(texto) {
  const erros = [];
  const rawConfig = parse(texto, erros, { allowTrailingComma: true });
  if (
    erros.length ||
    !rawConfig ||
    typeof rawConfig !== 'object' ||
    Array.isArray(rawConfig)
  ) {
    falhas.add('wrangler.jsonc: configuração JSONC inválida.');
    return;
  }
  const bindings = (entries, name) =>
    (entries ?? []).filter((entry) => entry.binding === name);
  const [db, outroDB] = bindings(rawConfig.d1_databases, 'DB');
  if (
    outroDB ||
    db?.database_name !== producao ||
    db?.database_id !== idProducao
  ) {
    falhas.add(
      'wrangler.jsonc: DB de produção deve apontar para bfo-producao (nome e ID).',
    );
  }
  const [backup, outroBackup] = bindings(rawConfig.r2_buckets, 'BACKUPS');
  if (outroBackup || backup?.bucket_name !== 'bfo-backups') {
    falhas.add(
      'wrangler.jsonc: BACKUPS de produção deve apontar para bfo-backups.',
    );
  }
  const temCronBackup = (config) =>
    config.triggers?.crons?.includes(cronBackup);
  if (!temCronBackup(rawConfig)) {
    falhas.add('wrangler.jsonc: falta o cron de backup 0 6 * * * em produção.');
  }

  const conferePrevia = (config, caminho) => {
    const [teste, outroTeste] = bindings(config?.d1_databases, 'DB');
    if (
      outroTeste ||
      !teste?.database_name ||
      !teste?.database_id ||
      [producao, homologacao].includes(teste.database_name.toLowerCase()) ||
      [teste.database_id, teste.preview_database_id].some((id) =>
        [idProducao, idHomologacao].includes(id?.toLowerCase()),
      )
    ) {
      falhas.add(
        `${caminho}: DB deve apontar para um D1 separado de produção e homologação.`,
      );
    }
    const [dbHomolog, outroHomolog] = bindings(
      config?.d1_databases,
      'DB_HOMOLOGACAO',
    );
    if (
      outroHomolog ||
      dbHomolog?.database_name !== homologacao ||
      dbHomolog?.database_id !== idHomologacao ||
      (dbHomolog.preview_database_id &&
        dbHomolog.preview_database_id !== idHomologacao)
    ) {
      falhas.add(
        `${caminho}: DB_HOMOLOGACAO deve apontar para bfo-homologacao (nome e ID).`,
      );
    }
    if (config && temCronBackup(config)) {
      falhas.add(`${caminho}: o cron de backup pertence somente à produção.`);
    }
  };
  conferePrevia(rawConfig.previews, 'wrangler.jsonc: previews');
  for (const [nome, ambiente] of Object.entries(rawConfig.env ?? {})) {
    if (ambiente.previews)
      conferePrevia(ambiente.previews, `wrangler.jsonc: env.${nome}.previews`);
    if (temCronBackup(ambiente)) {
      falhas.add(`wrangler.jsonc: env.${nome} não pode ter o cron de backup.`);
    }
  }
}

function confereMigracoes(baseLocal, indice, alterados) {
  const remota = 'refs/remotes/origin/homologacao';
  const existe = (ref) =>
    spawnSync('git', ['show-ref', '--verify', '--quiet', ref]).status === 0;
  if (!existe(remota) && ['1', 'true'].includes(process.env.WORKERS_CI)) {
    spawnSync(
      'git',
      [
        'fetch',
        '--no-tags',
        '--depth=1',
        'origin',
        `+refs/heads/homologacao:${remota}`,
      ],
      { env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, timeout: 30000 },
    );
    if (!existe(remota)) {
      falhas.add(
        'Workers Builds: não foi possível buscar origin/homologacao para conferir as migrações.',
      );
    }
  }
  const bases = [baseLocal];
  for (const ref of [
    existe(remota) ? remota : 'refs/heads/homologacao',
    'refs/bfo/homologacao-anterior',
  ]) {
    if (!existe(ref)) continue;
    bases.push(
      Object.fromEntries(
        lista(git('ls-tree', '-r', '-z', ref, '--', 'migrations/')).map(
          (linha) => {
            const tab = linha.indexOf('\t');
            return [linha.slice(tab + 1), linha.slice(0, tab).split(' ')[2]];
          },
        ),
      ),
    );
  }
  for (const base of bases) {
    for (const [arquivo, esperado] of Object.entries(base)) {
      const blob = indice.get(arquivo)?.blob;
      if (!blob || !lstatSync(arquivo, { throwIfNoEntry: false })?.isFile()) {
        falhas.add(`${arquivo}: migração da homologação apagada.`);
      } else if (
        blob !== esperado ||
        (alterados.has(arquivo) &&
          git('hash-object', '--no-filters', '--', arquivo)
            .toString()
            .trim() !== esperado)
      ) {
        falhas.add(`${arquivo}: migração da homologação alterada.`);
      }
    }
  }
}

function confereArquivo(arquivo, bytes, scripts) {
  const texto = bytes.toString('utf8');
  if (arquivo === 'wrangler.jsonc') {
    try {
      confereWrangler(texto);
    } catch {
      falhas.add('wrangler.jsonc: não foi possível ler os bindings ou o cron.');
    }
  }
  if (
    arquivo.startsWith('scripts/') &&
    arquivo !== 'scripts/confere.mjs' &&
    arquivo !== manifesto &&
    scripts[arquivo] !== hash(bytes)
  ) {
    falhas.add(
      `${arquivo}: script novo ou alterado. Revise os destinos de escrita antes de registrar seu hash na guarda.`,
    );
  }
  if (arquivo === 'package.json') {
    const comandos = JSON.parse(texto).scripts ?? {};
    for (const [nome, comando] of Object.entries(comandos)) {
      if (
        /\bd1\s+(?:execute|migrations\s+apply)\b/i.test(comando) &&
        !(
          nome === 'db:migrate' &&
          comando === 'wrangler d1 migrations apply DB --local'
        )
      ) {
        falhas.add(
          `package.json: ${nome} executa escrita D1 diretamente. Use um script protegido.`,
        );
      }
    }
  }

  const nome = arquivo.split('/').at(-1).toLowerCase();
  if (
    /(?:^|\/)private-data(?:\/|$)/i.test(arquivo) ||
    /^(?:\.dev\.vars|\.env)(?:\.|$)/.test(nome)
  ) {
    falhas.add(`${arquivo}: arquivo privado versionado.`);
  }
  const exportacao =
    /lunch[ ._-]*money/i.test(nome) &&
    /\.(?:json|csv|zip|xlsx)(?:\.gz)?$/.test(nome);
  // A coleta do BFO sempre grava as chaves abaixo, mesmo com outro nome de arquivo.
  const captura =
    /^\s*\{/.test(texto) &&
    [
      'manual_accounts',
      'plaid_accounts',
      'transactions',
      'balance_history',
      'recurring_items',
    ].every((chave) => new RegExp(`"${chave}"\\s*:`).test(texto));
  const cabecalho = texto
    .split(/\r?\n/, 1)[0]
    .toLowerCase()
    .split(/[,;]/)
    .map((coluna) => coluna.trim().replace(/^"|"$/g, '').replaceAll('_', ' '));
  const csvLunchMoney = [
    'date',
    'payee',
    'original name',
    'amount',
    'account',
  ].every((coluna) => cabecalho.includes(coluna));
  if (exportacao || captura || csvLunchMoney) {
    falhas.add(`${arquivo}: exportação do Lunch Money versionada.`);
  }
  for (const [i, linha] of texto.split('\n').entries()) {
    // Em `uses`, o @ separa o nome da ação da referência Git.
    const textoEmail = /^\.github\/workflows\/[^/]+\.ya?ml$/.test(arquivo)
      ? linha.replace(
          /^\s*(?:-\s+)?uses:\s+[\w.-]+\/[\w./-]+@[\w./-]+(?=\s|$)/,
          '',
        )
      : linha;
    if (
      [...textoEmail.matchAll(email)].some(
        (match) => !dominioFicticio.test(match[1]),
      )
    ) {
      falhas.add(`${arquivo}:${i + 1}: e-mail fora dos domínios fictícios.`);
    }
    if (tokens.some((padrao) => padrao.test(linha))) {
      falhas.add(
        `${arquivo}:${i + 1}: possível token, chave de API ou chave privada.`,
      );
    }
  }
}

try {
  const { migracoes, scripts } = JSON.parse(readFileSync(manifesto, 'utf8'));
  const indice = new Map(
    lista(git('ls-files', '--stage', '-z')).map((linha) => {
      const tab = linha.indexOf('\t');
      const [modo, blob] = linha.slice(0, tab).split(' ');
      return [linha.slice(tab + 1), { modo, blob }];
    }),
  );
  const alterados = new Set(lista(git('diff', '--name-only', '-z')));
  if (
    !indice.has('wrangler.jsonc') ||
    !lstatSync('wrangler.jsonc', { throwIfNoEntry: false })?.isFile()
  ) {
    falhas.add('wrangler.jsonc: configuração versionada ausente.');
  }
  confereMigracoes(migracoes, indice, alterados);
  for (const [arquivo, { modo, blob }] of indice) {
    const atual = lstatSync(arquivo, { throwIfNoEntry: false });
    if (atual?.isFile())
      confereArquivo(arquivo, readFileSync(arquivo), scripts);
    if (atual?.isSymbolicLink())
      confereArquivo(
        arquivo,
        readlinkSync(arquivo, { encoding: 'buffer' }),
        scripts,
      );
    if ((!atual || alterados.has(arquivo)) && modo !== '160000') {
      confereArquivo(arquivo, git('cat-file', 'blob', blob), scripts);
    }
  }
} catch {
  falhas.add(
    'Não foi possível concluir a guarda. Confira o checkout Git, o manifesto e os arquivos de configuração.',
  );
}

if (falhas.size > 0) {
  console.error(
    'Guarda da produção reprovada:\n' +
      [...falhas].map((falha) => `- ${falha}`).join('\n'),
  );
  process.exitCode = 1;
} else {
  console.log('Guarda da produção aprovada.');
}
