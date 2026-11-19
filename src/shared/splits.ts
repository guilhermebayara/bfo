// Percentuais em centésimos de ponto percentual. O resto fica na última parte.
export function splitAmounts(total: number, mode: string, values: number[]) {
  if (
    !['amount', 'percent'].includes(mode) ||
    values.length < 2 ||
    values.length > 50 ||
    values.some((v) => !Number.isSafeInteger(v) || v <= 0)
  )
    throw new Error('Informe de 2 a 50 partes positivas.');
  const target = mode === 'percent' ? 10000 : Math.abs(total);
  if (values.reduce((a, b) => a + b, 0) !== target)
    throw new Error('A soma das partes precisa fechar o total.');
  let allocated = 0;
  return values.map((v, i) => {
    const value =
      mode === 'amount'
        ? v
        : i === values.length - 1
          ? Math.abs(total) - allocated
          : Number((BigInt(Math.abs(total)) * BigInt(v)) / 10000n);
    allocated += value;
    if (!value)
      throw new Error('Cada parte precisa ter pelo menos um centavo.');
    return value * Math.sign(total);
  });
}
