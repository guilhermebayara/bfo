# Referência: estrutura do Lunch Money

Resumo da ferramenta que o dono usa hoje, feito a partir dos painéis dele. Serve de ponto de partida para estrutura e hierarquia. O que está em `docs/decisoes.md` vale mais do que esta referência. Sem nomes de bancos e sem valores reais.

## Navegação

Três áreas no topo, cada uma com abas:

- **Início:** visão geral, patrimônio líquido, estatísticas, tendências, calendário.
- **Finanças:** transações, orçamento, recorrentes, análise.
- **Configuração:** contas, categorias, tags, regras, beneficiários.

Quase toda tela tem uma coluna lateral à direita com cartões de revisão (transações a revisar, quanto falta orçar, recorrentes que não chegaram, contas a revisar) e um resumo do período.

## Telas

- **Transações:** navegação por mês (anterior, próximo, ir para o mês, voltar para este mês). Busca rápida, filtros, exportação. Colunas: data, categoria, beneficiário, valor, notas, conta, tags, estado de revisão. Ícones na linha para recorrente, dividida e agrupada. Botão de lançar já com a conta escolhida. Lateral com o resumo do mês: renda e despesas por grupo de categoria, com barra por categoria.
- **Contas:** agrupamento escolhível (o dono usa por instituição). Colunas: nome, tipo em selo (dinheiro, crédito, investimento, empréstimo), saldo, última atualização, estado (ativa ou encerrada em data). Lateral com o total por tipo e a quantidade de contas ativas.
- **Categorias:** grupo com categorias dentro. Marcas por categoria: tratar como renda, fora do orçamento, fora dos totais. Categorias herdam as marcas do grupo.
- **Tags:** nome, descrição, cor. O dono usa para recortes transversais (ex.: evitável, um evento, uma mudança de casa).
- **Regras:** gatilho (categoria, beneficiário, valor, dia, conta) e efeito (aplicar tag, definir categoria, ligar a recorrente). Na importação automática isso faz muito trabalho. No lançamento manual o papel muda.
- **Beneficiários:** lista de nomes com quantidade de transações e período, para limpar e unificar nomes em lote.
- **Orçamento:** entradas (esperado, realizado, disponível para orçar) e saídas por grupo e categoria (orçado, realizado, disponível). Lateral com quanto falta orçar e ações de copiar orçamento e limpar o período.
- **Recorrentes:** por mês, agrupado por categoria. Colunas: beneficiário, descrição, frequência, data de cobrança, valor, estado. Lateral com o esperado e o realizado de entradas e saídas recorrentes.
- **Análise:** ferramenta de consulta com período, agrupamento e visualização em tabela ou gráficos.
- **Visão geral:** contas por tipo com saldo, gastos do período por grupo e categoria com barra, valor projetado e percentual do total.
- **Patrimônio líquido:** barras mensais de ativos e passivos por tipo, linha do patrimônio, detalhe por tipo e subtipo ao passar o mouse.
- **Estatísticas:** maiores compras, beneficiários novos, maiores beneficiários por valor e por quantidade, maiores categorias.
- **Tendências:** totais do ano, gastos e renda por mês, taxa de poupança.
- **Calendário:** mês ou duas semanas, transações por dia com total diário e marca para recorrentes.

## O que o dono já disse que quer diferente

Está nas decisões: grupos de alocação com percentual, fatura como entidade, pagar fatura como ação própria, assinaturas como marca, investimentos por tipo, contas encerradas fora da lista principal.

## Regras dos recursos (base de conhecimento pública)

Resumo da base de conhecimento do Lunch Money (support.lunchmoney.app), coletado em 19/11/2026. Serve de contexto: o que está em `docs/decisoes.md` vale mais.

- **Estado de revisão:** transação importada automaticamente começa como não revisada; lançada à mão já nasce revisada. Editar pode marcar como revisada, conforme configuração. No BFO não existe revisão, porque tudo é lançado pelo dono. Fonte: https://support.lunchmoney.app/finances/transactions/transaction-status.md
- **Divisão:** uma transação vira duas ou mais partes, igualmente, por valores ou em pagamentos ao longo do tempo. A soma das partes é igual ao original, e cada parte aparece como transação própria ligada ao pai. Desfazer volta à transação única. Fonte: https://support.lunchmoney.app/finances/transactions/transaction-types.md
- **Grupos:** juntam transações sem alterar os dados delas. O grupo tem data, categoria, beneficiário, notas e tags próprios. As transações do grupo ficam escondidas na tabela, mas continuam nos filtros e na análise. Fonte: a mesma.
- **Transferências:** são uma saída na conta de origem e uma entrada na de destino, com a categoria "Payment, Transfer", que fica fora do orçamento e dos totais. A ação de criar transferência gera os dois lados já agrupados, e por isso a soma aparece zerada. Fonte: https://support.lunchmoney.app/finances/transactions/transaction-actions.md
- **Recorrentes:** valor fixo ou variável (com faixa de valor). Período ativo opcional, com início e fim. O reconhecimento usa beneficiário, valor e data, com uma margem na data, e a conta entra se for escolhida. Estado: verde quando a ocorrência chegou, laranja quando a data passou sem chegar, cinza quando ainda vai acontecer. Fontes: https://support.lunchmoney.app/finances/recurring-items/creating-recurring-items.md e https://support.lunchmoney.app/finances/recurring-items/the-basics-of-recurring.md
- **Categorias:** cada transação tem no máximo uma categoria. Grupo de categoria só organiza e não recebe transações. Uma categoria fica em um grupo só. As marcas do grupo são herdadas. Fonte: https://support.lunchmoney.app/setup/categories/category-groups.md
- **Marcas de categoria:** renda entra como renda. Fora do orçamento some do orçamento. Fora dos totais some das somas de gasto e renda, com opção de incluir nos relatórios. A categoria de transferência usa as duas últimas. Fonte: https://support.lunchmoney.app/setup/categories/category-properties.md
- **Orçamento:** a base de renda pode ser a renda esperada, a renda que já entrou ou a maior das duas. "Disponível para orçar" é a renda mais o que sobrou de períodos anteriores. "Falta orçar" é o disponível menos o orçado. Sobras podem passar para o mês seguinte por categoria ou num bolo geral (desligado por padrão). Fontes: https://support.lunchmoney.app/guides/budgeting/step-2-setting-up-your-budget.md e https://support.lunchmoney.app/guides/budgeting/step-3-navigating-the-budget-page.md
- **Saldos e patrimônio:** no fim de cada mês, o Lunch Money guarda uma foto dos saldos de todas as contas. Essas fotos podem ser editadas e não são recalculadas a partir das transações. Patrimônio líquido é ativos menos passivos, mês a mês. Fontes: https://support.lunchmoney.app/home/net-worth.md e https://support.lunchmoney.app/setup/accounts.md
- **Moedas:** uma moeda principal para todos os totais. O resto é convertido pela cotação histórica do dia da transação ou do saldo, e na falta dela pela do dia mais próximo. O patrimônio usa a cotação da data. Fonte: https://support.lunchmoney.app/settings/multicurrency.md
