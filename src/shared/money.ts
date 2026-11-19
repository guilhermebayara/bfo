export function parseMoney(value: string): number {
  const clean = value.trim();
  if (!/^-?\d+(?:,\d{1,2})?$/.test(clean))
    throw new Error(
      'Informe reais com vírgula, sem separador de milhar. Ex.: 1234,56.',
    );
  const negative = clean.startsWith('-');
  const [units, fraction = ''] = clean.replace('-', '').split(',');
  const cents = Number(units) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents))
    throw new Error('Valor fora do limite permitido.');
  return negative ? -cents : cents;
}
export function formatMoney(cents: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
