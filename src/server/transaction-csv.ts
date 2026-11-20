import type { Transaction } from '../shared/types';

type CsvRow = Transaction & {
  category_name: string | null;
  group_name: string | null;
};

const headers = [
  'Data',
  'Conta',
  'Beneficiário',
  'Categoria',
  'Grupo',
  'Valor original',
  'Moeda',
  'Valor em reais',
  'Notas',
  'Tags',
  'Origem',
  'Dividida',
  'Destino',
];
const origins = {
  imported: 'Importado',
  manual: 'Manual',
  adjustment: 'Ajuste',
};

function cell(value: string) {
  // Campos de texto podem começar com uma fórmula interpretada pela planilha.
  if (/^\s*[=+\-@]|^[\t\r\n]/.test(value)) value = "'" + value;
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function decimal(cents: number) {
  const absolute = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')}`;
}

export function transactionCsv(rows: CsvRow[]) {
  const lines = rows.map((row) => {
    const transfer = row.kind === 'transfer' || row.kind === 'card_payment';
    const signed = (cents: number) => (transfer ? Math.abs(cents) : -cents);
    const tags = [...row.tags]
      .map((tag) => tag.name)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return [
      row.date.split('-').reverse().join('/'),
      cell(row.account_name),
      cell(row.kind === 'transfer' ? 'Transferência' : row.payee),
      cell(row.category_name ?? ''),
      cell(row.group_name ?? ''),
      decimal(signed(row.amount_cents)),
      row.currency,
      decimal(signed(row.amount_brl_cents)),
      cell(row.note),
      cell(tags.join(', ')),
      origins[row.origin],
      row.split_count ? 'Dividida' : '',
      cell(row.destination_name ?? ''),
    ].join(';');
  });
  return '\uFEFF' + [headers.join(';'), ...lines].join('\r\n') + '\r\n';
}
