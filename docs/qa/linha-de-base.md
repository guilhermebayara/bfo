# Linha de base da Sessão M (QA fase 1)

Registrada em 20/11/2026 (America/Sao_Paulo), após `npm ci`, Playwright Chromium, `db:migrate`, `db:seed` e `build`. Tudo em D1 local, sem `--remote`.

## Comandos

| Passo | Resultado |
|---|---|
| `npm ci` | ok (aviso de engine: ambiente tinha Node 22 no PATH padrão; testes rodaram com Node 24 via nvm) |
| `npx playwright install --with-deps chromium` | ok |
| `npm run db:migrate` | aplicou `0010_importacao.sql` no D1 local |
| `npm run db:seed` | ok (393 comandos) |
| `npm run build` | ok |

## Suíte existente

| Comando | Resultado |
|---|---|
| `npm test` | 13 arquivos, 158 testes aprovados |
| `npm run test:e2e` | 47 aprovados, 1 falhou |

## Falha da suíte existente (sem correção)

- `tests/browser/session-i.spec.ts`: "transferência para cartão sugere a fatura mais antiga e registra pagamento parcial pela tabela"
- Erro: `TypeError: Cannot read properties of undefined (reading 'id')` ao buscar fatura com `total_cents === 10000`
- Observação: o prompt da sessão antecipa quebra neste arquivo no dia 20; não foi corrigido.

Logs em `/opt/cursor/artifacts/baseline-npm-test.log` e `/opt/cursor/artifacts/baseline-e2e.log` na máquina da sessão.
