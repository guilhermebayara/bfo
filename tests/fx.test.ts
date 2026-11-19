import { describe, expect, it, vi } from 'vitest';
import { convert, ptax } from '../src/server/fx';
describe('PTAX', () => {
  it('busca fechamento de venda até o dia, incluindo dias sem boletim', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ value: [{ cotacaoVenda: 5.1234 }] }),
    );
    expect(await ptax('USD', '2026-11-15', fetcher as typeof fetch)).toBe(
      5.1234,
    );
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.hostname).toBe('olinda.bcb.gov.br');
    expect(url.searchParams.get('@dataFinalCotacao')).toBe("'11-15-2026'");
    expect(url.searchParams.get('$filter')).toBe("tipoBoletim eq 'Fechamento'");
    expect(url.searchParams.get('$orderby')).toBe('dataHoraCotacao desc');
  });
  it('sinaliza falhas HTTP, boletim ausente e cotação inválida para fallback manual', async () => {
    for (const response of [
      new Response('', { status: 503 }),
      Response.json({ value: [] }),
      Response.json({ value: [{ cotacaoVenda: -1 }] }),
    ])
      await expect(
        ptax('USD', '2026-11-15', async () => response),
      ).rejects.toThrow('PTAX indisponível');
  });
  it('arredonda centavos simetricamente e protege limites', () => {
    expect(convert(101, 5.1234)).toBe(517);
    expect(convert(-101, 5.1234)).toBe(-517);
    expect(convert(1, 0.5)).toBe(1);
    expect(convert(-1, 0.5)).toBe(-1);
    expect(() => convert(Number.MAX_SAFE_INTEGER, 2)).toThrow();
    expect(() => convert(100, 0)).toThrow();
  });
});
