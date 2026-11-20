# Gabarito: mês simulado dezembro/2026

Calculado à mão em centavos, antes de rodar o app. Conta fictícia. Data de observação do painel Próximos: **15/12/2026**.

## Contas e estado de partida

Criadas ativas em 01/11/2026 (corte nessa data). Saldos de abertura em 01/11:

| Conta | Tipo | Moeda | Abertura (centavos) | Limite |
|---|---|---|---|---|
| Corrente QA Dez | checking | BRL | 1_000_000 | — |
| Cartão Limite QA Dez | credit_card | BRL | 0 | 500_000 (fech. 20, venc. 27) |
| Cartão Sem Limite QA Dez | credit_card | BRL | 0 | null (fech. 15, venc. 22) |
| Investimento QA Dez | investment | BRL | 200_000 | — |
| Exterior QA Dez | checking | USD | 10_000 | — |

Instituição fictícia: Instituição QA Dez.

## Categorias usadas

- Salário (renda)
- Aluguel (Moradia / Essencial)
- Mercado (Alimentação / Essencial)
- Tarifas e encargos (`card-fees`)
- Diferença de fatura (`statement-difference`)
- Transferência (fora dos totais)
- Reembolso QA: criada com `exclude_totals=1` e `exclude_budget=1`

## Novembro (preparação)

### Cartão Limite: ciclo que fecha 20/11

1. Compra 05/11 Mercado: **8_000**
2. Fechamento com conferência: banco informa **8_200** (diferença **+200**)
3. Ajuste Diferença de fatura: **+200**
4. Total da fatura: 8_000 + 200 = **8_200**
5. Pagamento parcial 25/11 pela Corrente: **5_000**
6. Restante transportado: 8_200 − 5_000 = **3_200** (saldo anterior na fatura que fecha 20/12)
7. Juros 26/11 na categoria Tarifas: **150** (entra no ciclo seguinte, data após fechamento 20/11 → ciclo que fecha 20/12)

Conta da Corrente em novembro só com o pagamento: −5_000.

### Cartão Sem Limite: ciclo que fecha 15/11

- Sem compras em novembro (só existe para dezembro).

### Parcelada retroativa (no Cartão Limite)

Lançada em 10/11: valor da parcela **10_000**, total 10 parcelas, parcela atual **3**.

- Parcelas 1 e 2 caem em ciclos de set/out (antes ou no passado do corte 01/11): marcadas retroativas conforme regra.
- Parcela 3: ciclo que fecha 20/11 (já no total? **Não**: lançamos a retroativa depois do fechamento do exemplo acima para isolar. Ordem no cenário: primeiro a retroativa, depois as compras/fechamento do ciclo 20/11.)

**Ordem real do cenário (para o gabarito bater):**

1. Criar contas.
2. Lançar retroativa 3/10 de 10_000 em 10/11 no Cartão Limite.
3. Lançar compra à vista 8_000 em 05/11.
4. Fechar fatura 20/11 com banco  (soma das compras do ciclo) e ajuste se houver divergência.
5. Pagar parcial 5_000.
6. Juros 150 em 26/11.
7. Seguir com dezembro.

Parcelas geradas (valor 10_000 cada, 10×):

| Nº | Mês da fatura (fecha dia 20) | Valor | Observação |
|---|---|---|---|
| 1 | 20/09 | 10_000 | retroativa / antes do corte |
| 2 | 20/10 | 10_000 | retroativa / antes do corte |
| 3 | 20/11 | 10_000 | ciclo nov |
| 4 | 20/12 | 10_000 | dez |
| 5–10 | 20/01…20/06 | 10_000 cada | futuras |

Compra à vista 05/11: **8_000** no ciclo 20/11.

Total ciclo 20/11 antes da conferência: 10_000 + 8_000 = **18_000**.

Conferência: banco **18_500** → ajuste Diferença de fatura **+500**.

Total fatura 20/11: **18_500**.

Pagamento parcial 25/11: **10_000**.

Saldo anterior para 20/12: 18_500 − 10_000 = **8_500**.

Juros 26/11 **150** → ciclo 20/12.

Corrente após nov: 1_000_000 − 10_000 = **990_000**.

## Dezembro: lançamentos

### Corrente

| Data | Descrição | Centavos | Categoria | Notas |
|---|---|---|---|---|
| 01/12 | Salário | −800_000 | Salário | renda |
| 05/12 | Aluguel (recorrente) | 250_000 | Aluguel | reconhecimento no dia |
| 08/12 | Mercado | 12_345 | Mercado | |
| 09/12 | Divisão total 10_000 | 4_000 + 6_000 | Mercado + Aluguel | uma tx dividida |
| 12/12 | Reembolso | −3_000 | Reembolso QA | fora dos totais |
| 14/12 | Luz (recorrente previsto 10/12) | 22_000 | Aluguel* | valor diferente; +4 dias |
| 15/12 | Transferência para “poupança” interna | 50_000 | Transferência | destino: criar Conta Destino QA (cash) só para a transferência; ou usar aporte |
| 15/12 | Aporte investimento | 100_000 | Transferência | Corrente → Investimento |
| 18/12 | Compra USD | ver abaixo | Mercado | |

\*Luz usa categoria Aluguel no cenário para simplificar o grupo Moradia, ou categoria própria Luz se criada. Gabarito do resumo usa grupo Moradia.

### Recorrentes cadastrados

| Payee | Conta | Previsto | Valor previsto | Cadência |
|---|---|---|---|---|
| Aluguel QA Dez | Corrente | todo dia 5 | 250_000 | monthly |
| Luz QA Dez | Corrente | 10/12 | 18_000 | monthly |
| Anual QA Dez | Corrente | 01/12 | 120_000 | yearly + assinatura |

Reconhecimento:

- Aluguel: tx 05/12 250_000 → realizado = esperado.
- Luz: tx 14/12 22_000 (janela 03/12–17/12) → realizado 22_000, esperado 18_000, conta no mês previsto (dezembro).
- Anual: sem tx em dezembro no cenário (só prevista) → esperado 120_000, realizado 0. Equivalente mensal na tela de assinaturas: 10_000.

### Cartão Limite em dezembro

| Data | Descrição | Centavos |
|---|---|---|
| — | Saldo anterior | 8_500 |
| — | Juros nov | 150 |
| 06/12 | Compra nova 6× (total 60_000 → 10_000/parcela) | parcela 1 = 10_000 no ciclo 20/12 |
| 07/12 | Antecipação de 2 parcelas (5 e 6 da retroativa 10×): face 20_000, cobrado 18_000 | +18_000 na fatura atual; desconto 2_000 no histórico |

Parcelas da retroativa após antecipar 5 e 6:

- 4 permanece em 20/12: 10_000
- 5 e 6 saem (antecipadas)
- 7–10 seguem

Ciclo que fecha 20/12 (Cartão Limite):

- saldo anterior 8_500
- juros 150
- parcela 4 da retroativa 10_000
- parcela 1 da nova 6× 10_000
- antecipação 18_000

Subtotal compras/lançamentos do ciclo (sem saldo anterior): 150+10_000+10_000+18_000 = **38_150**

Total fatura (com saldo anterior): 8_500 + 38_150 = **46_650**

Fechamento 20/12 com banco = app (**46_650**), sem divergência. Sem pagamento em dezembro (fica aberta/fechada sem pagar conforme o cenário: fechamos com conferência ok).

Estado após fechar: status `closed`, pago 0, remaining 46_650 (ou carried se houver regra). No cenário: **fechada, não paga**.

### Cartão Sem Limite em dezembro

| Data | Descrição | Centavos |
|---|---|---|
| 03/12 | Restaurante | 4_500 |

Ciclo fecha 15/12: total **4_500**, status aberto ou fechado sem pagamento.

### Compra USD

- Conta Exterior QA Dez, 16/12, amount_cents **2_000** (USD)
- PTAX automática bloqueada ou ignorada: cotação manual **5,4321**
- amount_brl_cents = round(2000 × 5.4321) = round(10864.2) = **10_864**

## Saldos no fim de dezembro

### Corrente QA Dez

Partida após nov: 990_000

| Movimento | Δ |
|---|---|
| Salário | +800_000 |
| Aluguel | −250_000 |
| Mercado 08/12 | −12_345 |
| Divisão (10_000) | −10_000 |
| Reembolso | +3_000 |
| Luz | −22_000 |
| Transferência cash | −50_000 |
| Aporte investimento | −100_000 |
| Compra USD não é nesta conta | 0 |

Soma Δ = 800_000 − 250_000 − 12_345 − 10_000 + 3_000 − 22_000 − 50_000 − 100_000 = **358_655**

Saldo final Corrente = 990_000 + 358_655 = **1_348_655**

### Cartão Limite

Movimentação (signo de cartão: compras positivas aumentam saldo devido):

Nov: 18_000 compras + 500 ajuste − 10_000 pagamento + 150 juros = **8_650** devido?  
Conferência: total fatura 18_500, pagou 10_000, restou 8_500 + juros 150 no ciclo seguinte.

Saldo do cartão (account balance) ao fim de dez:
- Compras/ajustes/juros/antecipação acumulados − pagamentos
- Nov: 10_000 + 8_000 + 500 − 10_000 + 150 = 8_650
- Dez: 10_000 (parc 4) + 10_000 (6×) + 18_000 (antec) = 38_000
- Total devido: 8_650 + 38_000 = **46_650**

(Confere com total da fatura 20/12 fechada.)

### Cartão Sem Limite

Saldo: **4_500**

### Investimento QA Dez

200_000 + 100_000 aporte = **300_000**

### Exterior QA Dez (USD)

10_000 + 2_000 compra = **12_000** USD cents  
(BRL da compra 10_864 só no resumo.)

### Conta Destino QA (cash) da transferência

0 + 50_000 = **50_000**

## Resumo lateral dezembro (BRL, só o que entra nos totais)

Renda:

- Salário: **800_000**

Despesas por grupo (exclude_totals fora: transferência, reembolso, pagamentos de fatura):

| Grupo | Categoria | Centavos |
|---|---|---|
| Moradia | Aluguel | 250_000 + 6_000 (parte da divisão) + 22_000 (luz) = **278_000** |
| Alimentação | Mercado | 12_345 + 4_000 (parte da divisão) + 10_864 (USD) = **27_209** |
| Ajustes / sistema | Diferença de fatura | 0 em dezembro (ajuste foi em nov) |
| — | Tarifas | 0 em dez no resumo de gasto do mês se o juros conta no mês da fatura/compra: juros 26/11 → spending_month novembro. Em dez, tarifas do cartão na antecipação? Antecipação é kind especial. |

Gasto no cartão entra no orçamento/resumo no mês da compra; parcela no mês da fatura.

- Parcela 4 (retroativa) e parcela 1 (6×) e antecipação: spending no mês da fatura dezembro.
- Cartão Sem Limite 4_500 em 03/12.

Incluindo cartões no resumo de despesas (valor em BRL):

| Origem | Categoria | Centavos |
|---|---|---|
| Parcela/compras cartão limite no ciclo dez | Mercado (herdado) | 10_000 + 10_000 + 18_000 = **38_000** |
| Juros (se spending_month=2026-11) | Tarifas | 0 em dez |
| Sem limite | (categoria da compra) | **4_500** |

Total despesas totais (aproximação do resumo):  
Moradia 278_000 + Mercado corrente 27_209 + cartão limite 38_000 + sem limite 4_500 = **347_709**  
Renda 800_000.

O teste compara categoria a categoria com o `/api/month-summary?month=2026-12`.

## Comprometido e disponível (15/12, após lançamentos de dez)

### Cartão Limite (500_000)

Comprometido = parcelas futuras em aberto + recorrentes de cartão (nenhum) + fatura atual não paga.

Após antecipar 5 e 6, restam parcelas 4 (já no ciclo atual), 7,8,9,10 da retroativa (4 × 10_000) + parcelas 2–6 da nova 6× (5 × 10_000) + fatura atual remaining.

Definição da API (`/commitment`): soma do horizonte (hoje→fim do próximo mês) sem dupla contagem do que já está na fatura.

O teste lê `/api/cards/:id/commitment` e registra o valor obtido; o gabarito esperado mínimo:

- Parcelas futuras da retroativa após nº4: 7–10 = 4 × 10_000 = 40_000 (se ainda no horizonte)
- Parcelas 2–6 da 6× = 50_000
- Fatura atual remaining 46_650 (se conta no committed)

Valores exatos conferidos na execução; se a API divergir da conta acima, registra-se a diferença.

Disponível = 500_000 − committed.

### Cartão Sem Limite

`credit_limit_cents = null`, `available_cents = null`, `committed_cents` ≥ 4_500.

## Próximos em 15/12/2026

Horizonte: 15/12 → 31/01 (fim do mês seguinte).

Deve incluir, entre outros:

- Fatura Cartão Limite venc. 27/12 (se fechada/em aberto com remaining)
- Fatura Cartão Sem Limite venc. 22/12 (4_500)
- Parcelas futuras de cartão nos vencimentos dos ciclos
- Recorrente Luz: já reconhecida → **não** prevista de novo
- Recorrente Aluguel: já reconhecida → **não** prevista de novo
- Anual QA Dez: se next_date era 01/12 e não realizada, pode aparecer ou ter avançado; conferir na execução
- Aluguel jan/27: previsto ~05/01

## Reconhecimento dos recorrentes (dezembro)

| Recorrente | Esperado | Realizado | Janela |
|---|---|---|---|
| Aluguel QA Dez | 250_000 | 250_000 | 28/11–12/12 |
| Luz QA Dez | 18_000 | 22_000 | 03/12–17/12 |
| Anual QA Dez | 120_000 | 0 | 24/11–08/12 |

## Observação sobre PTAX

Se `/api/fx` retornar 503 (rede bloqueada), a compra USD usa só cotação manual 5,4321 e o ID T15/cenário fica **Ok** na parte manual; a automática marca-se **Bloqueado** no relatório da fase 1, não Falhou.

## Resultado da execução (Sessão M, 20/11/2026)

Rodado em `tests/aceitacao/dezembro-simulado.test.ts` com `today` = 20/11/2026. 9/9 asserts aprovados. Restrição: a API rejeita `date > today()`, então novembro foi pela API e dezembro via SQL; saldos de fim de dezembro conferidos por SQL (sem o filtro `date <= today()` de `/api/accounts`).

| Item do gabarito | Esperado | Obtido | Nota |
|---|---|---|---|
| Fatura nov total antes da conferência | 18_000 | 18_000 | Ok |
| Ajuste Diferença de fatura | +500 | +500 | Ok (K05) |
| Pagamento parcial | 10_000 em 25/11 | 10_000 em 20/11 | data trocada por bloqueio da API |
| Saldo anterior na fatura 20/12 | 8_500 | 8_500 | Ok (K03) |
| Fatura 20/12 total | 46_650 | 46_650 | Ok (status `open`; fechamento do gabarito não rodado neste dia) |
| Corrente fim de dez | 1_348_655 | 1_348_655 | Ok (SQL) |
| Investimento | 300_000 | 300_000 | Ok |
| Destino cash | 50_000 | 50_000 | Ok |
| Exterior USD | 12_000 no gabarito | 8_000 | gabarito somou abertura+compra; convenção do app é abertura−despesa |
| Cartão Sem Limite | 4_500 devido | −4_500 contábil | mesmo valor em absoluto |
| Cartão Limite “saldo” | 46_650 devido da fatura | −136_650 no saldo da conta | o saldo da conta inclui parcelas futuras ativas; o total da fatura 20/12 bate 46_650 |
| Resumo salário dez | 800_000 | 800_000 | Ok |
| Resumo aluguel/moradia | 278_000 | 278_000 | Ok |
| USD amount_brl | 10_864 | 10_864 | Ok |
| Antecipação 5 e 6 via API | 18_000 na fatura dez | API 409; simulado via SQL | P06 isolado Ok; no cenário composto falhou a API |
| Comprometido Cartão Limite | (a conferir) | committed 146_650, available 353_350 | registrado |
| Próximos em 15/12 | Luz fora da previsão | não observável | `today` da sessão é 20/11 |

Diferenças impressas no log do teste como `DIFERENCAS_GABARITO`.
