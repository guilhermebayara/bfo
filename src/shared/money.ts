export function parseMoney(value: string): number {
  const clean = value.trim();
  if (!/^-?\d+(?:,\d{1,2})?$/.test(clean))
    throw new Error(
      'Informe reais com vírgula, sem separador de milhar. Ex.: 1234,56.',
    );
  const negative = clean.startsWith('-');
  const [units, fraction = ''] = clean.replace('-', '').split(',');
  const exact = BigInt(units) * 100n + BigInt(fraction.padEnd(2, '0'));
  const cents = Number(exact);
  if (exact > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('Valor fora do limite permitido.');
  return negative ? -cents : cents;
}
export function formatMoney(cents: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

// Arredondamento decimal exato, com meio centavo afastado de zero.
export function roundRatio(numerator: bigint, denominator: bigint): number {
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator * sign;
  const rounded = sign * ((absolute * 2n + denominator) / (denominator * 2n));
  const value = Number(rounded);
  if (!Number.isSafeInteger(value))
    throw new Error('Valor convertido fora do limite.');
  return value;
}
function decimalRatio(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Cotação inválida.');
  const [decimal, exponent = '0'] = String(rate).toLowerCase().split('e');
  const [units, fraction = ''] = decimal.split('.');
  const scale = fraction.length - Number(exponent);
  return {
    numerator:
      BigInt(units + fraction) * (scale < 0 ? 10n ** BigInt(-scale) : 1n),
    denominator: scale > 0 ? 10n ** BigInt(scale) : 1n,
  };
}
export function convertBetween(
  amount: number,
  fromRate: number,
  toRate: number,
): number {
  if (!Number.isSafeInteger(amount))
    throw new Error('Valor deve ser inteiro em centavos.');
  const from = decimalRatio(fromRate),
    to = decimalRatio(toRate);
  return roundRatio(
    BigInt(amount) * from.numerator * to.denominator,
    from.denominator * to.numerator,
  );
}
export function convert(amount: number, rate: number): number {
  return convertBetween(amount, rate, 1);
}
