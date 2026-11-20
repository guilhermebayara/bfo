# QA fase 1 — Sessão M

Branch `tst-qa-fase1`, 20/11/2026 (America/Sao_Paulo). Sem correção de produto: só testes e docs. Oráculo: `docs/decisoes.md`, não a suíte antiga.

## Linha de base (Etapa 1)

Ver [linha-de-base.md](linha-de-base.md).

| Comando | Resultado |
|---|---|
| `npm test` | 158 aprovados |
| `npm run test:e2e` | 47 aprovados, 1 falhou (`session-i` no dia 20) |

## Aceitação desta sessão (Etapa 2)

| Suíte | Resultado |
|---|---|
| `npx vitest run tests/aceitacao` | 56 aprovados, 1 falha esperada (`it.fails` R04 boolean) |
| `npx playwright test tests/browser/aceitacao` | 21 aprovados |

Testes com asserts numéricos e fluxos ponta a ponta (criar → conferir saldo/fatura/resumo), não só abrir tela.

## Mês simulado dezembro (Etapa 3)

Gabarito: [gabarito-dezembro.md](gabarito-dezembro.md). Teste: `tests/aceitacao/dezembro-simulado.test.ts` (9/9).

Resumo: fatura nov 18_000 + ajuste 500, pagamento parcial 10_000, saldo anterior 8_500, fatura 20/12 total **46_650** (bate o gabarito). Corrente fim de dez **1_348_655**. Bloqueio estrutural: API rejeita `date > today()` (20/11), então dezembro entrou via SQL; saldos de fim de mês via SQL.

## Status por ID

| ID | Resultado | Evidência | Nota |
|---|---|---|---|
| T01 | Ok | `tests/browser/aceitacao/t-planilha.spec.ts` | mês no endereço, setas |
| T02 | Não testado | Manual | célula em repouso/hover/edição |
| T03 | Ok | `tests/browser/aceitacao/t-planilha.spec.ts` | Enter/Tab/Esc/setas |
| T04 | Ok | `tests/aceitacao/t-transacoes.test.ts`, browser | saldo e resumo atualizam |
| T05 | Ok | `tests/aceitacao/t-transacoes.test.ts`, browser | importada travada |
| T06 | Ok | `tests/aceitacao/t-transacoes.test.ts`, browser | sinal pela categoria |
| T07 | Ok | `tests/aceitacao/t-transacoes.test.ts`, browser | conta padrão |
| T08 | Ok | `tests/aceitacao/t-transacoes.test.ts` | sugestão por beneficiário (API); UI Ambos anotada |
| T09 | Ok | `tests/aceitacao/t-transacoes.test.ts`, browser | transferência |
| T10 | Ok | `tests/aceitacao/t-transacoes.test.ts`, browser | filtro origem/destino |
| T11 | Ok | `tests/aceitacao/t-transacoes.test.ts` | destino investimento |
| T12 | Ok | `tests/aceitacao/t-transacoes.test.ts`, browser | lote |
| T13 | Ok | `tests/aceitacao/t-transacoes.test.ts` | divisão fecha e desfaz |
| T14 | Não testado | Manual | resumo lateral com barra |
| T15 | Ok | `tests/aceitacao/t-transacoes.test.ts`, dezembro | cotação manual 5,4321 → 10_864; PTAX automática depende de rede (se 503 = Bloqueado só na automática) |
| C01 | Ok | `tests/aceitacao/c-contas.test.ts`, browser | instituição e tipo |
| C02 | Ok | `tests/aceitacao/c-contas.test.ts`, browser | ativa vs só arquivo |
| C03 | Ok | `tests/aceitacao/c-contas.test.ts`, browser | conferir saldo |
| C04 | Ok | `tests/aceitacao/c-contas.test.ts` | ativação com corte |
| C05 | Ok | `tests/aceitacao/c-contas.test.ts`, browser | encerrada |
| C06 | Ok | `tests/aceitacao/c-contas.test.ts` | moedas em uso |
| K01 | Ok | `tests/aceitacao/k-cartao.test.ts`, browser | ciclo e estado |
| K02 | Ok | `tests/aceitacao/k-cartao.test.ts`, browser | pagamento uma linha |
| K03 | Ok | `tests/aceitacao/k-cartao.test.ts`, dezembro | parcial → saldo anterior 8_500 |
| K04 | Ok | `tests/aceitacao/k-cartao.test.ts` | tarifas |
| K05 | Ok | `tests/aceitacao/k-cartao.test.ts`, dezembro | Diferença de fatura +500 |
| K06 | Ok | `tests/aceitacao/k-cartao.test.ts` | reabrir |
| K07 | Ok | `tests/aceitacao/k-cartao.test.ts` | fechamento antecipado |
| K08 | Ok | `tests/aceitacao/k-cartao.test.ts`, browser, dezembro | limite e comprometido |
| K09 | Bloqueado | Manual / correção L | fatura selecionada antes da lista |
| P01 | Ok | `tests/aceitacao/p-parcelas.test.ts`, browser | célula e prévia |
| P02 | Ok | `tests/aceitacao/p-parcelas.test.ts`, dezembro | retroativa 3/10 |
| P03 | Ok | `tests/aceitacao/p-parcelas.test.ts` | editar escopos |
| P04 | Ok | `tests/aceitacao/p-parcelas.test.ts` | cancelar futuras |
| P05 | Ok | `tests/aceitacao/p-parcelas.test.ts`, browser | mover fatura |
| P06 | Ok | `tests/aceitacao/p-parcelas.test.ts`, browser | antecipação isolada; no cenário dez a API devolveu 409 e o efeito foi simulado em SQL |
| P07 | Não testado | Manual | página da compra original |
| R01 | Ok | `tests/aceitacao/r-recorrentes.test.ts`, browser | esperado/realizado |
| R02 | Ok | `tests/aceitacao/r-recorrentes.test.ts`, browser | janela 7 dias |
| R03 | Ok | `tests/aceitacao/r-recorrentes.test.ts`, browser | criar pelo menu |
| R04 | Ok | `tests/aceitacao/r-recorrentes.test.ts`, browser | assinaturas; ver Defeitos (boolean) |
| R05 | Ok | `tests/aceitacao/r-recorrentes.test.ts`, browser | aviso 30 dias |
| R06 | Ok | `tests/aceitacao/r-recorrentes.test.ts` | tipos |
| X01 | Ok | `tests/aceitacao/x-proximos.test.ts` | horizonte; observação 15/12 do gabarito Bloqueada pelo calendário da sessão |
| G01 | Ok | `tests/aceitacao/g-config.test.ts` | herança de marcas |
| G02 | Ok | `tests/aceitacao/g-config.test.ts` | grupos |
| G03 | Ok | `tests/aceitacao/g-config.test.ts` | preferências |
| G04 | Ok | `tests/aceitacao/g-config.test.ts` | tags |
| G05 | Ok | `tests/aceitacao/g-config.test.ts` | unificar |
| I01 | Ok | `tests/aceitacao/i-importacao.test.ts`, CLI | fixtures LEIA-ME |
| I02 | Ok | `tests/aceitacao/i-importacao.test.ts`, CLI | apagar/refazer; `docs/qa/i-importacao-cli-resultado.json` |
| I03 | Ok | `tests/aceitacao/i-importacao.test.ts` | alocação Importado 0% |
| I04 | Ok | `tests/aceitacao/i-importacao.test.ts` | pendentes e arredondamento |
| F01 | Não testado | Manual | navegação e cabeçalho |
| F02 | Não testado | Manual | catálogo de fundações |
| F03 | Não testado | Manual | tipografia tabular |
| F04 | Bloqueado | Manual / correção L | resumo recolhível |
| F05 | Bloqueado | Manual / correção L | títulos de grupo na nav |
| Z01 | Não testado | Manual | Access |
| Z02 | Não testado | Manual | celular / PWA |

## Defeitos

| ID | Gravidade | Esperado | Obtido | Passos |
|---|---|---|---|---|
| R04 (contrato) | média | `is_subscription: true` (boolean JSON) aceito ou rejeitado com mensagem clara alinhada ao contrato da API | 400 `Estado inválido` | `POST /api/recurring` com boolean; teste `it.fails` em `r-recorrentes.test.ts`. A API só aceita `0`/`1`. |
| session-i (suíte antiga) | média → mitigado no teste | e2e estável em qualquer dia | no dia 20, conta nova com corte = 19 rejeitava compra em 19/11 | Mitigado em `tests/browser/session-i.spec.ts` com data = today (America/Sao_Paulo) e fechamento dia 28. Produto intacto; item de data fixa no harness permanece em `a-construir.md`. |
| P06 no cenário dez | baixa | antecipar parcelas 5 e 6 da retroativa no ciclo dez | `POST .../advance` → 409 “As parcelas ou a fatura atual mudaram…” após fechar nov e lançar a 6× no mesmo cartão | Isolado (P06) Ok. No composto, efeito recriado em SQL e a fatura 20/12 fechou em 46_650. |

## Perguntas

1. No gabarito, Exterior USD “10_000 + 2_000 = 12_000”. A convenção do app (despesa positiva, saldo = abertura − soma) dá **8_000**. O gabarito errou a conta, ou a intenção era crédito/entrada de 2_000?
2. O “saldo do cartão” no gabarito (46_650) é o total da fatura. O `balance_cents` da conta de cartão soma também parcelas futuras ativas (−136_650 no cenário). Qual dos dois a interface de Contas deve mostrar como saldo do cartão?
3. A API bloqueia qualquer `date > today()`. Lançamento e conferência no passado recente ok; simular o mês seguinte só com SQL ou relógio. Isso é regra definitiva de produto?

## Bloqueios de calendário (não são Falhou)

- Datas de dezembro e 25–26/11 na API com `today` = 20/11.
- Próximos “como em 15/12” (gabarito).
- K09, F04, F05 aguardam correção da revisão L.
- PTAX automática se a rede do ambiente bloquear `/api/fx`.
