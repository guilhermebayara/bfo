# Revisão de código: Sessão G

Revisão de `homologacao`, base `7120827`, na branch `tst-revisao`, em 19/11/2026. Escopo: código das sessões A a F, antes da importação real. Todos os exemplos e testes usam dados fictícios.

Foram encontrados **17 defeitos: 0 críticos, 7 de gravidade alta, 9 de gravidade média e 1 de gravidade baixa**. Todos foram corrigidos. As perguntas de produto ao fim deste documento são separadas desses defeitos.

A revisão leu servidor, cliente, regras compartilhadas, SQL, scripts de seed e de build, roteamento dos bancos e configuração. A referência de produto foi `docs/decisoes.md`, com o esclarecimento do dono nesta sessão: importadas permitem categoria, nota, tags e divisão; valor total e data continuam travados. Nenhum histórico real foi importado e nenhum seed remoto foi executado.

## Gravidade alta

### G01. Edições concorrentes podiam sobrescrever dinheiro

- **Onde:** `src/server/index.ts`, rota `PATCH /api/transactions/:id`; `src/client/App.tsx`.
- **Problema:** a edição financeira lia a transação, preenchia os campos ausentes com essa cópia e depois gravava todos eles. Outra edição podia ocorrer entre a leitura e a gravação. Respostas antigas de atualização de saldos também podiam substituir as mais recentes no cliente.
- **Exemplo:** valor original de R$ 1,00. Uma requisição muda para R$ 2,00 e outra muda o beneficiário. Se ambas lessem antes da primeira gravação, a segunda voltava o valor para R$ 1,00.
- **Corrigido:** sim. O batch compara os campos lidos antes de escrever. Se mudaram, aborta todas as escritas e responde 409, permitindo conferir e repetir. O cliente aplica apenas a última atualização solicitada.
- **Teste:** `tests/review.test.ts`, edições financeiras concorrentes; `tests/browser/review.spec.ts`, resposta antiga de saldos.

### G02. Saldos e conferências avançavam o dia pelo UTC

- **Onde:** `src/server/index.ts`, cálculo de saldo e conferência; `src/client/components/ManualTransaction.tsx`; `src/client/screens/Accounts.tsx`; novo `src/shared/dates.ts`.
- **Problema:** o calendário mensal usava São Paulo, mas o saldo usava `date('now')` do SQLite e outros campos usavam `toISOString()`, ambos em UTC.
- **Exemplo:** às 22h30 de 30/11 em São Paulo, já é 01h30 de 01/12 UTC. Uma saída prevista para 01/12 entrava no saldo de 30/11; a conferência também podia receber a data do dia seguinte.
- **Corrigido:** sim. A data civil de São Paulo é compartilhada pelo saldo, conferência, marco, formulário e consulta de câmbio da conta.
- **Teste:** `tests/review.test.ts`, virada UTC com saldo e conferência; `tests/browser/review.spec.ts`, lançamento na virada UTC.

### G03. Conversão por ponto flutuante perdia meio centavo

- **Onde:** `src/server/fx.ts`; `src/shared/money.ts`; prévias em `ManualTransaction.tsx` e `Accounts.tsx`; ativação em `src/server/index.ts`.
- **Problema:** `Math.round(centavos * cotação)` dependia da representação binária do produto. A ativação ainda fazia uma segunda conversão no SQL, independente da usada pela API.
- **Exemplo:** 100 centavos com cotação 1,005 produzem 100,5 centavos, que devem arredondar para 101. O produto binário podia ficar em 100,49999999999999 e virar 100.
- **Corrigido:** sim. Conversão decimal com inteiros `BigInt`, arredondamento simétrico e limite de inteiro seguro. Servidor e prévias usam a mesma função; pagamentos entre moedas combinam as duas cotações como razão exata antes de arredondar os centavos. A ativação grava o valor já convertido, verificando o saldo do arquivo dentro do batch.
- **Teste:** `tests/review.test.ts`, conversão decimal e ajuste de abertura em moeda estrangeira; `tests/fx.test.ts` e `tests/statements.test.ts`, sinais, limites e soma das parcelas em reais.

### G04. Compra antiga podia sair de uma fatura fechada

- **Onde:** `src/server/index.ts`, edição e listagem de transações; trigger em `migrations/0006_review.sql`.
- **Problema:** compras antigas sem `statement_id` pertencem à fatura pelo intervalo do ciclo. A trava verificava somente o vínculo explícito, permitindo mover a compra para fora desse intervalo.
- **Exemplo:** compra de R$ 5,00 em 01/06, incluída na fatura já fechada em 20/06 por sua data. Alterar a compra para novembro retirava R$ 5,00 daquela fatura sem uma nova conferência.
- **Corrigido:** sim. API e trigger verificam também o ciclo inferido de origem. A listagem informa esse estado e a tabela mostra os campos financeiros protegidos.
- **Teste:** `tests/review.test.ts`, bloqueio pela API e pelo SQL de compra antiga em fatura fechada.

### G05. Ajustes de saldo apareciam nas somas de gasto

- **Onde:** view `spending_transactions`, corrigida em `migrations/0006_review.sql`.
- **Problema:** qualquer lançamento `regular` entrava na view de gastos, inclusive o marco de abertura e o ajuste de conferência de saldo.
- **Exemplo:** diferença de R$ 100,00 na ativação da conta podia aparecer como R$ 100,00 de consumo. Conferir um saldo com ajuste também criava gasto artificial.
- **Corrigido:** sim. Marco e ajuste ligado à conferência ficam fora das somas de gasto. O ajuste de fatura continua entrando em “Diferença de fatura”.
- **Teste:** `tests/review.test.ts`, abertura e conferência fora dos gastos e diferença de fatura dentro; `tests/statements.test.ts`, pagamento fora dos gastos.

### G06. Unificação em lote alterava o beneficiário exibido de importadas

- **Onde:** `src/server/index.ts`, `POST /api/payees/merge` e projeção dos beneficiários.
- **Problema:** a rota mudava aliases, sem passar pela trava da transação. O registro original continuava no banco, mas a lista passava a mostrar outro beneficiário.
- **Exemplo:** unificar “Nome original fictício” em “Destino fictício” trocava o nome visível de uma importada, embora os campos permitidos sejam os de classificação.
- **Corrigido:** sim. A rota recusa origens que tenham importadas, incluindo aliases. A listagem também preserva o nome original de importadas que já estejam ligadas a aliases. Unificação de nomes manuais continua disponível.
- **Teste:** `tests/model.test.ts`, unificação em lote; `tests/review.test.ts`, importadas e edição indireta.

### G07. Pagamento podia ser debitado sem abater o saldo ativo do cartão

- **Onde:** `src/server/index.ts`, `POST /api/statements/:id/pay`.
- **Problema:** a data era validada contra o corte da corrente, mas não contra o corte do cartão. O crédito no cartão podia cair antes de sua abertura, ficando fora do saldo ativo.
- **Exemplo:** corrente ativa desde janeiro e cartão com corte em 10/11. Pagar em 09/11 debitava a corrente, marcava a fatura como paga e deixava o crédito fora dos movimentos posteriores ao corte do cartão.
- **Corrigido:** sim. O pagamento exige cartão ativo e data posterior aos cortes das duas contas.
- **Teste:** `tests/review.test.ts`, pagamento antes do corte do cartão; os testes existentes mantêm a baixa única e a exclusão das somas de gasto.

## Gravidade média

### G08. Campos da Sessão F não estavam cobertos pela trava do banco

- **Onde:** triggers de importadas, complemento em `migrations/0006_review.sql`.
- **Problema:** a trava original não incluía `retroactive`, `added_to_closed` e `advance_id`.
- **Exemplo:** uma escrita SQL podia marcar como retroativa uma importada; alterar seu vínculo de antecipação também não era protegido por essa trava. Não havia rota pública que aceitasse esses campos diretamente.
- **Corrigido:** sim. Trigger adicional preserva os três campos. Categoria, nota, tags e divisão seguem editáveis conforme o esclarecimento do dono.
- **Teste:** `tests/review.test.ts`, alterações recusadas pela API e pelo banco; `tests/session-f.test.ts`, divisão e desfazer de importadas.

### G09. Editar valor ou beneficiário perdia a origem PTAX

- **Onde:** `src/server/index.ts`, edição de transações.
- **Problema:** a edição reutilizava a cotação armazenada, passando-a à função como se tivesse sido digitada pelo dono. `fx_source` mudava para `manual`.
- **Exemplo:** lançamento USD com PTAX 1,005. Corrigir somente o beneficiário fazia o registro passar a declarar cotação manual.
- **Corrigido:** sim. Mesma moeda e data, sem cotação explicitamente corrigida, preservam a cotação e sua origem. Mudança de data/moeda volta a consultar a cotação correspondente.
- **Teste:** `tests/review.test.ts`, edição com origem PTAX preservada.

### G10. Reabrir divisão com centavos invalidava os próprios valores

- **Onde:** `src/client/components/SplitTransaction.tsx`.
- **Problema:** a abertura do editor formatava números com ponto decimal, enquanto o parser da interface exige vírgula.
- **Exemplo:** divisão em R$ 33,33 e R$ 66,68 reabria como `33.33` e `66.68`. O app dizia que faltava dividir e desabilitava Salvar, mesmo sem alteração do dono.
- **Corrigido:** sim. Valores reabrem com vírgula. Os detalhes visíveis também são recarregados após editar a divisão, sem depender de desmontar a linha inteira.
- **Teste:** `tests/browser/review.spec.ts`, reabertura com centavos; `tests/browser/session-f.spec.ts`, alteração por percentual e desfazer.

### G11. Tabela não tinha o comportamento de planilha decidido

- **Onde:** `src/client/components/TransactionRow.tsx`, novo `SpreadsheetCell.tsx`, `src/client/screens/Transactions.tsx`.
- **Problema:** era necessário abrir a linha com “Editar” e confirmar em “Salvar”. Faltavam navegação entre células e salvamento ao sair. A linha era recriada a cada atualização, perdendo seleção e rascunhos.
- **Exemplo:** clicar no valor não abria sua edição; Tab não salvava nem avançava como planilha. Uma gravação lenta também podia roubar o foco da célula seguinte.
- **Corrigido:** sim. Um clique abre cada campo permitido; sair da célula salva; seletores salvam ao escolher; Enter salva e avança para baixo, Tab/Shift+Tab avançam/voltam, Esc cancela, setas movem entre células. Erros mantêm o rascunho para correção. Respostas atrasadas preservam o foco da próxima célula. Saldos são buscados imediatamente e as consultas dependentes são atualizadas.
- **Campos derivados:** alocação é editada pela escolha da categoria, mantendo o vínculo decidido. Origem continua definida pelo sistema, com indicação de trava. Valores de sistema, faturas fechadas e campos financeiros de importadas ficam visivelmente protegidos. Divisões abrem seu editor pela célula de classificação.
- **Teste:** `tests/browser/review.spec.ts`, clique, teclado, falha, foco, travas, saldos, fatura e realizado; testes anteriores de filtro e persistência adaptados ao novo comportamento.

### G12. Lançamento de retroativa não explicava a parcela atual nem mostrava prévia

- **Onde:** `src/client/components/ManualTransaction.tsx`; cálculo compartilhado em `src/shared/installments.ts`.
- **Problema:** o campo numérico aparecia sem uma escolha explícita de parcelamento e sem mostrar o resultado antes da gravação.
- **Exemplo:** ao informar 3 de 10, o dono não conseguia conferir na tela quais seriam as duas parcelas passadas e em quais faturas entrariam.
- **Corrigido:** sim. Escolha “Parcelado”, explicação “A parcela que aparece na fatura deste mês” e prévia com todas as parcelas, datas, faturas, valores, passadas marcadas como retroativas e indicação das anteriores ao corte. Cliente e servidor compartilham o cálculo dos ciclos.
- **Teste:** `tests/browser/review.spec.ts`, prévia antes de salvar; `tests/browser/session-f.spec.ts`, gravação e recálculo da fatura fechada.

### G13. Dados opcionais inválidos eram ignorados ou chegavam ao banco

- **Onde:** `src/server/index.ts`, edição, câmbio, recorrentes, conferência e divisão.
- **Problema:** nulos financeiros usavam silenciosamente os valores anteriores; cotação inválida em BRL era ignorada; opcionais de recorrentes podiam causar erro 500 por referência/tipo inválido.
- **Exemplo:** enviar `date: null` parecia editar com sucesso, mas preservava a data. Recorrente mensal com `subscription_type_id` inexistente ou intervalo textual chegava à persistência. Confirmação textual era tratada como prévia.
- **Corrigido:** sim. Campos presentes são validados, inclusive nulos; BRL só aceita cotação 1; opcionais de recorrentes, confirmação e quantidade de partes são validados antes de escrever. O vínculo de uma transação ao recorrente exige a mesma conta.
- **Teste:** `tests/review.test.ts`, entradas inválidas; `tests/recurring.test.ts`, validações e referências; `tests/session-f.test.ts`, soma e limites da divisão.

### G14. Ativação aceitava data de corte futura

- **Onde:** `src/server/index.ts`, prévia e confirmação da ativação.
- **Problema:** uma abertura futura passava a ser imediatamente a base do saldo atual.
- **Exemplo:** em novembro, ativar uma conta com corte em dezembro fazia a conta mostrar o saldo de abertura de dezembro e ignorar os lançamentos entre hoje e esse corte.
- **Corrigido:** sim. Prévia e confirmação recusam corte posterior ao dia de São Paulo.
- **Teste:** `tests/review.test.ts`, marco futuro.

### G15. Consultas de parcelas e históricos não tinham os índices correspondentes

- **Onde:** `migrations/0006_review.sql`; consultas em `src/server/index.ts`.
- **Problema:** faltavam índices por plano/número da parcela, fatura nos históricos de conferência e revisão, tag das partes, aliases e ajuste de conferência. A consulta de cada compra parcelada precisava percorrer transações alheias ao plano.
- **Exemplo:** abrir uma compra com dez parcelas em um histórico com milhares de transações examinava a tabela de transações para localizar essas dez linhas; os históricos correlacionados repetiam buscas sem índice por fatura.
- **Corrigido:** sim. Índices adicionados sem reescrever registros, incluindo categoria/data e classificação das partes. Os índices existentes de data, conta/data, beneficiário/data e fatura foram mantidos.
- **Teste:** `tests/review.test.ts`, `EXPLAIN QUERY PLAN` comprova busca indexada de parcelas, conferências, revisões e tags das partes. Não foi feito benchmark no banco real.

### G16. Foco do lançamento rápido dependia de um frame enquanto o formulário estava desabilitado

- **Onde:** `src/client/components/ManualTransaction.tsx`.
- **Problema:** o retorno de foco era agendado antes de a atualização de `busy` garantir a reabilitação do formulário.
- **Exemplo:** Enter salvava e limpava a linha, mas o beneficiário podia continuar sem foco, impedindo digitar o próximo lançamento diretamente.
- **Corrigido:** sim. O foco é aplicado após o formulário voltar a estar habilitado.
- **Teste:** `tests/browser/session-e.spec.ts`, Enter salva, limpa os campos e foca o beneficiário para o próximo lançamento.

## Gravidade baixa

### G17. Equivalente mensal tinha arredondamento assimétrico para entradas

- **Onde:** `src/shared/recurring.ts`, `monthlyEquivalent`.
- **Problema:** `Math.round` arredonda meio negativo em direção a zero, diferente da conversão monetária usada para saídas.
- **Exemplo:** seis centavos anuais davam um centavo mensal; menos seis centavos anuais davam zero. A função também fazia multiplicações intermediárias em ponto flutuante.
- **Corrigido:** sim. Razões inteiras com arredondamento simétrico; a cobrança anual continua integralmente no mês correspondente e o equivalente mensal continua apenas informativo.
- **Teste:** `tests/review.test.ts`, sinais no equivalente mensal; `tests/recurring.test.ts`, frequências e cobrança anual.

## Verificação das demais regras

- **Marco e saldo:** abertura substitui a base histórica; o ajuste fica visível na data de corte e não é somado novamente aos movimentos posteriores. Conferência verifica o saldo esperado antes de gravar e preserva o histórico.
- **Faturas:** fechamento inclui o próprio dia e respeita o fim de mês. Divergências e ajustes ficam no histórico; pagamento é uma linha na corrente com crédito correspondente no cartão e fica fora de `spending_transactions`.
- **Parcelas:** distribuição inteira com resto na última, inclusive total indivisível; soma em reais preservada; retroativas criadas em todos os ciclos; inclusão em fatura fechada/paga gera revisão sem apagar a conferência ou pagamento anterior. Antecipação remove apenas as próximas parcelas futuras abertas, registra uma linha atual e preserva valor cheio, valor pago, desconto e custo real.
- **Divisão:** exige soma completa por valor ou percentual; saldo e fatura continuam usando o original; gastos por categoria usam as partes; desfazer restaura o original sem duplicação. Valores em reais das partes fecham exatamente com o original.
- **Recorrentes e assinaturas:** sinal, conta e beneficiário são considerados no reconhecimento; o valor pode variar. Intervalos e datas de fim de mês, cobrança anual, renovação e prazo próprio são cobertos pelos testes. A definição numérica de “data próxima” continua como pergunta de produto abaixo.
- **Migrações:** as seis migrações foram aplicadas em sequência num D1 local vazio. O caminho desde a Sessão A mantém importadas e referências. Um banco no esquema da Sessão F com importadas, tags, divisão e recorrente foi fotografado antes/depois da 0006 e da reaplicação pelo controle de migrações, sem alteração de registros. `PRAGMA foreign_key_check` não encontrou referências quebradas. Nenhuma migração antiga foi editada.
- **Dinheiro:** persistência monetária em inteiros; cotação continua decimal, com conversão decimal exata no ponto em que gera centavos. Nenhum arquivo, token ou dado de importação real foi utilizado.

## Validação e limites

- Base anterior: 83 testes de API/regras passavam antes das correções.
- API, regras e migrações: 97 testes aprovados após as correções.
- Navegador: 28 testes aprovados em Chromium, em suíte completa com banco D1 local isolado, incluindo dez cenários novos da Sessão G.
- Build inclui checagem TypeScript e Vite; o preparo do navegador aplica migrações e seed fictício somente em `.wrangler/e2e`.
- A PTAX foi validada com respostas simuladas no teste da integração e do cache. O ambiente local apresentou falhas de DNS ao buscar o serviço externo; o fallback manual foi testado. Isso não valida a disponibilidade do Banco Central em produção.
- A configuração não explicita logs/traces em `wrangler.jsonc`; o estado efetivo de observabilidade depende também do painel, que não foi alterado nesta sessão.
- A publicação segue o fluxo existente: push da branch e build da prévia. O seed e a importação remotos permanecem manuais.

## Perguntas para o dono, sem alteração automática de produto

### P01. Qual é a janela de “data próxima” para reconhecer recorrentes?

- **Onde:** `src/server/index.ts`, `GET /api/recurring`.
- **Comportamento atual:** escolhe a transação mais próxima dentro do mesmo mês, sem limite de dias. Uma cobrança de 29/11 paga em 01/12 não é reconhecida em novembro, enquanto outra com mesmo beneficiário no começo de novembro pode ser considerada.
- **Pergunta:** qual distância em dias deve ser aceita e como a tela deve tratar cobranças que atravessam o mês? Conta, beneficiário e valor variável permanecem conforme a decisão existente.
- **Situação:** aguardando definição; nenhuma janela arbitrária foi introduzida.

### P02. Como classificar a linha de antecipação quando as parcelas futuras foram reclassificadas?

- **Onde:** `src/server/index.ts`, `POST /api/installment-plans/:id/advance`.
- **Comportamento atual:** a nova linha usa a categoria original da compra. Uma parcela pode ter recebido categoria ou divisão diferente depois; as tags das parcelas antecipadas permanecem no histórico delas e não são transferidas à linha atual.
- **Exemplo:** uma compra originalmente em “Entretenimento” teve uma parcela futura dividida entre “Mercado” e “Entretenimento”. Antecipá-la cria uma linha em “Entretenimento”; o valor total pago e o desconto permanecem corretos.
- **Pergunta:** a antecipação deve usar a classificação original, exigir uma classificação própria ou preservar proporcionalmente as classificações das parcelas escolhidas?
- **Situação:** aguardando definição; não foi inventada uma regra de distribuição do desconto por categoria.

## Onde conferir

| O quê | Onde ver |
|---|---|
| Código e relatório da revisão | https://github.com/guilhermebayara/bfo/blob/tst-revisao/docs/revisao-codigo.md |
| Planilha de transações e lançamento retroativo | https://tst-revisao.bfo.bayara.design/transacoes |
| Saldos, abertura e conferência | https://tst-revisao.bfo.bayara.design/contas |
| Faturas e acesso às compras parceladas | https://tst-revisao.bfo.bayara.design/cartao |
| Recorrentes e realizado | https://tst-revisao.bfo.bayara.design/recorrentes |
| Assinaturas e equivalente mensal | https://tst-revisao.bfo.bayara.design/assinaturas |
