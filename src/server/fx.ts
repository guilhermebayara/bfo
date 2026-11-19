// Venda PTAX: último fechamento disponível até a data, incluindo fins de semana.
export async function ptax(
  currency: string,
  day: string,
  fetcher: typeof fetch = fetch,
): Promise<number> {
  if (currency === 'BRL') return 1;
  const end = new Date(`${day}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 10);
  const us = (d: Date) =>
    `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCFullYear()}`;
  const url = new URL(
    'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)',
  );
  url.search = new URLSearchParams({
    '@moeda': `'${currency}'`,
    '@dataInicial': `'${us(start)}'`,
    '@dataFinalCotacao': `'${us(end)}'`,
    $format: 'json',
    $filter: "tipoBoletim eq 'Fechamento'",
    $orderby: 'dataHoraCotacao desc',
    $top: '1',
  }).toString();
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('PTAX indisponível.');
  const body = (await response.json()) as {
    value?: { cotacaoVenda: number }[];
  };
  const rate = body.value?.[0]?.cotacaoVenda;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0)
    throw new Error('PTAX indisponível.');
  return rate;
}
export function convert(amount: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Cotação inválida.');
  const result = Math.sign(amount) * Math.round(Math.abs(amount) * rate);
  if (!Number.isSafeInteger(result))
    throw new Error('Valor convertido fora do limite.');
  return result;
}
