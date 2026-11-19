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
