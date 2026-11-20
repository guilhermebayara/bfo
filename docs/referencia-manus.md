# Referências do Manus: finanças pessoais no desktop

Pesquisa feita pelo dono no Manus em 20/11/2026, a pedido dele, no mesmo formato da pesquisa do Yogurt. Sem decisão. O texto do Manus está abaixo, como veio. Antes dele, o cruzamento feito no chat de gestão com as decisões e o que já está construído.

## Cruzamento com o BFO

Ressalva geral: quase todas as referências são serviços com conexão bancária. O BFO é de lançamento manual, então o que trata de sincronizar com o banco não se aplica direto. A pesquisa fala de estrutura e fluxo; a linguagem visual segue no [consolidado](referencia-visual-consolidado.md).

### Já está nas decisões ou construído

- Todo total leva às transações que o formaram (Sessão V): é o drill-down do Monarch e do YNAB e a ideia singular da seção 6.
- Saldo corrido por conta (Sessão V): o registro do Quicken, seção 2.
- Sugestão de categoria e tags pelo beneficiário, com padrão no beneficiário: o autocomplete do Moneydance, seção 2.
- Projeção de 30 dias com o ponto mais baixo e a data dele (Sessão X): o Projected Cash Flow do Simplifi e o calendário do Quicken, seção 4.
- "Atualizado em" e "Conferir saldo" com ajuste visível: a reconciliação manual da seção 8.
- Contas agrupadas por instituição, com subtotal: os grupos do Banktivity, seção 1.

### Ideias para o conceito visual da fase 1

- Projeção ponto a dia: passar o mouse ou clicar num dia da projeção mostra o que forma o saldo daquele dia e leva ao item. Junta a tela inicial com a regra de que todo número leva à sua origem.
- Lista de próximos colada à linha do tempo da projeção, com entrada e saída diferenciadas por cor e legenda fixa (seção 4).

### Para os briefs das fases 2 e 3

- Patrimônio (fase 2): alternar o patrimônio líquido com a composição de ativos e dívidas no mesmo gráfico, com escolha das contas; imóvel financiado com o valor líquido resumido e o bruto e a dívida ao expandir (Simplifi e Banktivity, seção 1). Conversa com [referencia-patrimonio.md](referencia-patrimonio.md).
- Orçamento (fase 3): orientação no lugar do alerta de estouro, oferecendo rever o limite, mover saldo ou manter (seção 3). Combina com a decisão de não alertar gasto exatamente no orçado.
- Metas (fase 3): reserva de emergência como meta que recebe retiradas e reposições, separada das metas de quitação (Monarch, seção 5).
- Dados (depois da produção): mostrar no mesmo lugar onde os dados estão e quando foram atualizados (seção 8). Aqui poderia ser a data do último backup no R2 e da última conferência de cada conta.

---

# Referências de interface para finanças pessoais em desktop

## 1. Visão geral financeira, contas e patrimônio

**Padrão observado.** Um total patrimonial funciona como âncora visual, seguido por tendência temporal e composição por ativos e dívidas. Contas detalhadas ficam agrupadas, filtráveis ou recolhíveis. Um dashboard modular e com ordem configurável permite priorizar sem exibir todos os widgets de uma vez.

- [Quicken Simplifi](https://support.simplifi.quicken.com/en/articles/13337631-using-the-net-worth-feature) — resolve a leitura do patrimônio líquido ao longo do tempo, com ativos, dívidas e contas selecionadas comparáveis. Para uma interface desktop de finanças pessoais, mostrar patrimônio líquido e variação do período como foco; deixar alternância ativos versus dívidas e filtros de contas no contexto do gráfico, com a lista detalhada abaixo. **Evidência visual verificada:** artigo oficial aberto e conferido; GIFs visíveis mostram Net Worth Over Time, seletor de inclusão de contas, alternância Total Net Worth/Assets vs. Debt e decomposição de ativos e dívidas. O artigo também indica acesso pelo tile do Dashboard. [1]

- [Banktivity](https://www.banktivity.com/content/topics/net-worth-tracking/) — resolve a organização do balanço em grupos e subgrupos e relaciona ativo e dívida, por exemplo casa e mortgage, para mostrar o saldo líquido sem ocultar a composição. No desktop, usar grupos recolhíveis — dinheiro, investimentos, imóveis e dívidas — com subtotais; para imóvel financiado, resumir o equity e permitir expandir valor bruto e financiamento. **Evidência visual verificada:** página oficial aberta; a galeria/legendas identifica imagens da interface Mac como “Your complete net worth at a glance on Mac”, “Organize accounts into groups that reflect how you think about your money” e “Net worth over time on Mac”. [2]

- [MoneyWiz](https://www.wiz.money/download) — resolve a necessidade de uma visão ampla da vida financeira, reunindo contas e patrimônio em vez de tratar cada saldo como destino isolado. Aproveitar a largura desktop para combinar resumo total compacto e grupos de contas, mantendo os detalhes abaixo do resumo e sem competir com ele. **Evidência visual verificada:** seção oficial “Real app screens with sample data. Select a device to enlarge it” disponibiliza capturas reais por dispositivo; a seção Mac descreve uma “spacious view”. A evidência confirma o panorama amplo, não controles ou funções visuais específicos. [3]

**Ideia singular.** Permitir alternância entre patrimônio líquido e composição Assets vs. Debt, com seleção individual de contas no mesmo contexto, preservando o panorama enquanto se investiga o que o moveu.

**Lacuna.** Monarch foi considerado, mas as páginas oficiais abertas não forneceram evidência visual de tela suficientemente confirmável. MoneyWiz confirma capturas Mac, mas a extração não expôs uma tela isolada nem cada detalhe de controle; por isso, a recomendação limita-se ao panorama amplo.

## 2. Revisão, busca e categorização de transações

**Padrão observado.** As telas verificadas favorecem um registro denso com atributos editáveis e sinais de contexto — status, categoria, saldo e orçamento. Filtros e ordenação ajudam a reduzir o conjunto antes da revisão.

- [Moneydance](https://moneydance.com/) — resolve o preenchimento e a correção de lançamentos com registro tabular, edição direta e autocomplete de favorecido e categoria. Em desktop, permitir correção inline com sugestões baseadas no histórico daquele estabelecimento, mantendo memo e saldo visíveis. **Evidência visual verificada:** página oficial com seção “Account Registers” e imagem identificada como “Entering transactions in Moneydance with categories, description and amount”; a página também explica edição/exclusão, autocomplete de payee e categorização e oferece downloads para macOS e Windows. [4]

- [Quicken Classic for Windows](https://info.quicken.com/win/using-the-account-register) — resolve a conferência contextual de lançamentos ao reunir status, categoria, tags, anexos/recibos e saldo corrido, com colunas ajustáveis. Em desktop, exibir lado a lado valor/payee importados e valores corrigidos pelo usuário, além de acesso rápido ao recibo para validar itens ambíguos. **Evidência visual verificada:** guia oficial “Using the account register” mostra a imagem “registersimple.png” e descreve colunas da tela, incluindo status, payee, memo, category, attachments, cleared e balance. [5]

- [YNAB](https://www.ynab.com/features) — resolve a conexão entre gastos categorizados, saldos e prioridades do orçamento. Em desktop, ao editar uma categoria, mostrar o impacto imediato no orçamento e no saldo disponível sem tirar a pessoa da lista de transações. **Evidência visual verificada:** página oficial contém imagem descrita como interface YNAB com despesas categorizadas, saldos, distribuição de gastos e prioridades em desktop e duas telas móveis; é uma visão desktop ampla, não uma tela dedicada à fila de transações. [6]

**Ideia singular.** Juntar numa única linha revisável estado da importação, categoria sugerida/editável e contexto de orçamento, com correção inline e confirmação rápida.

**Lacuna.** Não foi possível confirmar três telas dedicadas exclusivamente à fila de revisão/categorização. A imagem do YNAB é uma visão desktop ampla; o guia do Quicken confirma registro e colunas, mas não demonstra visualmente busca. As referências validam registro/contexto, não todos os fluxos de revisão e filtro.

## 3. Orçamento, limites e acompanhamento de gastos

**Padrão observado.** Resumo por período com saldo restante, categorias agrupadas, barras ou bolhas de progresso e exploração progressiva até transações. Combinar alerta cromático moderado com opções de ajuste ou redistribuição.

- [Monarch Money](https://help.monarch.com/hc/en-us/articles/360048883631-Creating-Your-Budget-in-Monarch) — resolve o orçamento por categoria ou modo flexível, com média histórica de seis meses, saldo remanescente e redistribuição quando há excedente. Em desktop, oferecer modos por categoria e grupo flexível, valores iniciais históricos editáveis e realocação sem enquadrar excedente como falha pessoal. **Evidência visual verificada:** artigo oficial aberto com gravação “Screen Recording 2024-12-13 at 1.33.53 PM.gif”, captura da página de orçamento e exemplo de categoria excedida em vermelho; também descreve Budget desktop e categoria/flex budgeting. [7]

- [Quicken Simplifi](https://support.simplifi.quicken.com/en/articles/4212702-understanding-your-spending-plan) — resolve a organização do plano mensal entre receitas, contas recorrentes, gastos planejados, gastos restantes e metas, mostrando quanto resta no mês e por dia. Em desktop, apresentar “disponível até o fim do mês” e ritmo diário junto aos limites, diferenciar gastos recorrentes e variáveis e permitir reservar fundos para metas. **Evidência visual verificada:** artigo oficial aberto com GIFs incorporados de Planned Spend, Other Spend e Left This Month; demonstram valor disponível, média diária e atualização em tempo real. A página informa que ajuste de colunas é exclusivo da versão web. [8]

- [YNAB](https://www.ynab.com/blog/ynab-reports-and-data) — resolve a investigação de gastos em vários níveis, com filtros, drill-down, comparação mensal e totais/médias por seleção. Em desktop, permitir abrir categoria para ver subcategorias e transações e comparar o período atual com histórico filtrável. **Evidência visual verificada:** post oficial aberto com imagens de relatórios, gráfico por categoria, tendência mensal em barras, filtros por período/categorias/contas e detalhamento clicável até subcategorias e transações. [9]

**Ideia singular.** Substituir alertas de “estouro” por orientação contextual e acionável — “você está acima do ritmo planejado; quer rever o limite, mover saldo ou manter como está?” — preservando autonomia e evitando linguagem de culpa.

**Lacuna.** As três referências têm telas/imagens verificadas, mas Monarch e YNAB são serviços web consultados em desktop e Simplifi também é web; não há confirmação de tela de orçamento em produto desktop nativo macOS/Windows.

## 4. Fluxo de caixa, contas recorrentes e calendário

**Padrão observado.** Os padrões mais úteis unem uma visão temporal — calendário ou gráfico de saldo — a uma lista de eventos futuros. Entradas e saídas são diferenciadas por cor, e o agendamento pode ser editado a partir do item. O calendário comunica timing; o gráfico explicita o efeito acumulado no saldo.

- [Quicken Simplifi — Projected Cash Flow](https://support.simplifi.quicken.com/en/articles/3357429-using-projected-cash-flow) — resolve a ligação entre saldo projetado e eventos que o alteram. Ao selecionar um ponto da projeção desktop, abrir abaixo a lista de contas e entradas daquele dia, com valor, estado e menu rápido para editar ou pular ocorrência. **Evidência visual verificada:** artigo oficial com três GIFs embutidos e acessíveis — gráfico Projected Cash Flow, lista de reminders e interação com o gráfico. O texto informa que a projeção considera saldo atual, contas e receitas recorrentes, reembolsos previstos e transações futuras. [10]

- [Quicken for Windows — Financial Calendar](https://info.quicken.com/win/how-do-i-work-with-the-financial-calendar) — resolve a visualização do saldo por dia, distinguindo renda esperada, despesa esperada e item vencido, e permite criar ou editar transações e lembretes pela data. Em desktop, usar cores consistentes com legenda persistente e abrir a data para editar reminder sem sair da projeção diária. **Evidência visual verificada:** página oficial contém imagens inline `calendarview.png` e `calendarlegend.png`; documentação descreve calendário diário, saldo real passado, saldo projetado futuro e lembretes diferenciados por cor. A captura automatizada do navegador não disponibilizou screenshot independente. [11]

- [Moneydance](https://moneydance.com/) — resolve a visibilidade persistente de próximos e atrasados junto aos saldos e o agendamento de transações únicas ou recorrentes. No desktop, manter faixa de próximos vencimentos e recebimentos ligada às contas afetadas, com ação direta para registrar ou revisar o lembrete. **Evidência visual verificada:** página oficial com capturas inline e imagens diretas Summary (`https://infinitekind.com/assets/images/moneydance/screenshots/homepage.png` ) e Reminders (`https://infinitekind.com/assets/images/moneydance/screenshots/reminders.png` ); a descrição de Summary inclui saldos, transações futuras e lembretes próximos/vencidos, e Reminders mostra configuração de recorrência. Produto desktop para macOS, Windows e Linux. [4]

**Ideia singular.** Interação ponto-a-dia: passar o cursor ou clicar na data do gráfico revela os reminders que compõem o saldo projetado daquele dia e leva diretamente à lista editável de ocorrências.

**Lacuna.** Três referências distintas verificadas; não foi encontrada fonte distinta adicional suficientemente forte sem repetição de produto ou apoio em página genérica. A captura direta do navegador falhou; nas páginas Quicken e Simplifi, a evidência foi confirmada por imagens/GIFs embutidos identificados, e Moneydance também oferece URLs diretas de imagens.

## 5. Metas de poupança, dívidas e planos

**Padrão observado.** Separar poupança de quitação; mostrar saldo atual versus alvo e prazo projetado; explicitar status e permitir simular alterações sem comprometer o plano ativo.

- [YNAB](https://www.ynab.com/whats-new?339368af_page=6) — resolve o acompanhamento da quitação com histórico de pagamentos, progresso esperado e simulador de possibilidades. Em desktop, combinar saldo restante, pagamentos feitos e previstos numa curva de quitação, com cenário de pagamento extra sem alterar o plano base. **Evidência visual verificada:** página oficial acessível exibe captura identificada como Loan payoff simulator no app web e descreve gráfico de progresso do empréstimo e simulações. [12]

- [Monarch Money — Save-Up Goals](https://help.monarch.com/hc/en-us/articles/44373182867476-Using-Save-Up-Goals) — resolve metas como reserva de emergência e poupança por valor-alvo, data e aporte mensal, com status on track/ahead/at risk e opção de repor gastos da reserva. Em desktop, oferecer uma meta recorrente de emergência separando saldo atual, alvo e trajetória projetada. **Evidência visual verificada:** guia oficial acessível explica timeline visual e elementos do gráfico — saldo, alvo, gastos e projeção — e contém figuras de interface incorporadas; experiência web, não app nativo. [13]

- [Monarch Money — Pay-Down Goals](https://help.monarch.com/hc/en-us/articles/44373293932052-Using-Pay-Down-Goals) — resolve a visão consolidada e por dívida, incluindo comparação avalanche/snowball, juros e data projetada de quitação. Em desktop, vincular cada dívida à conta de passivo e tornar visível o impacto de aportes extras. **Evidência visual verificada:** guia oficial acessível descreve painel de dívidas, gráfico colorido por conta, cartões de principal/juros/data livre de dívidas e simulador; há referências a imagens de interface incorporadas. Experiência web, não app nativo. [14]

**Ideia singular.** Tratar o fundo de emergência como meta que pode sofrer retiradas e reposições, enquanto dívidas têm projeção por conta com cenários avalanche/snowball.

**Lacuna.** Há somente duas referências distintas verificadas; Monarch aparece em dois fluxos. Não foi encontrada terceira referência distinta com tela de metas/dívidas verificável. Moneydance não tinha captura adequada desse fluxo; Simplifi descreve Savings Goals, mas a página consultada não expõe captura específica. YNAB e Monarch são web, não nativos macOS/Windows; falta evidência visual adequada de produto desktop nativo.

## 6. Relatórios, tendências e comparação temporal

**Padrão observado.** Painel analítico com abas por pergunta financeira, controles de período e agrupamento próximos ao gráfico, resumo quantitativo e detalhamento transacional acessível por seleção ou seção inferior.

- [Monarch Money (web/desktop)](https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports) — resolve múltiplas lentes analíticas — Sankey, barras de tendência, donut, barras ordenadas e treemap — com filtros, indicadores-resumo e acesso às transações que compõem cada dado. Em desktop, criar abas Fluxo de caixa, Gastos e Renda, alternar tendências/composição e atualizar tabela de transações ao selecionar período no gráfico. **Evidência visual verificada:** página oficial de ajuda aberta e verificada, com arquivos visuais “Screen Recording 2026-08-06 at 12.00.41 PM.gif” e “Reports revamp.gif”; texto confirma abas Cash Flow, Spending e Income, gráficos interativos, filtros e drill-down. O blog oficial confirma clique em gráficos desktop para filtrar transações na mesma página. [16]

- [Quicken Simplifi — Reports on the web app](https://support.simplifi.quicken.com/en/articles/4592676-using-reports-on-the-quicken-simplifi-web-app) — resolve escolhas explícitas de intervalo, agrupamento e visualização, separa resumo de transações e inclui comparação de renda e despesas ao longo do tempo; personalizações podem ficar salvas. Em desktop, mostrar série temporal conjunta de renda e despesas, seletor de intervalo e agrupamento, vistas de resumo e transações e filtros persistentes. **Evidência visual verificada:** documentação oficial aberta com imagens e GIFs nas seções “Breakdowns and Viewing Options”, “Date Range and Filters” e “Graph Views”, além de outras capturas de Reports. Descreve relatórios Spending, Income, Income & Expense e Net Worth. [17]

**Ideia singular.** Transformar cada marca temporal ou segmento clicado em filtro coordenado para resumo e transações, mantendo análise e explicação visíveis na mesma tela.

**Lacuna.** Apenas duas referências visuais distintas adequadas. Quicken Windows tem documentação de comparação entre períodos, mas a página consultada não exibe captura; MoneyWiz oferece página de relatórios, porém a imagem identificada é de iPhone, não evidência desktop. Não foram incluídas para não tratar descrição textual ou imagem móvel como captura desktop verificada.

## 7. Contas, investimentos e patrimônio consolidado

**Padrão observado.** Painel consolidado como ponto de entrada, com contas e investimentos exploráveis em níveis de detalhe separados. Indicadores e gráficos resumem o todo sem substituir registros por conta ou por ativo.

- [Moneydance](https://moneydance.com/) — resolve a navegação entre painel financeiro, registro de conta e acompanhamento de investimentos, mostrando valor total de contas de investimento e desempenho de ativos individuais em seção própria. Em desktop, agrupar contas numa barra lateral navegável, manter resumo consolidado e abrir o registro detalhado ao selecionar conta ou ativo. **Evidência visual verificada:** página oficial aberta exibe imagens de resumo financeiro e investimentos; imagens identificadas como resumo e acompanhamento de investimentos, incluindo capturas diretas `https://infinitekind.com/assets/images/moneydance/screenshots/investments.png` e `https://infinitekind.com/assets/images/moneydance/screenshots/homepage.png`. [4]

- [Quicken Classic Premier](https://www.quicken.com/products/classic-premier/) — resolve a distinção entre agregado de portfólio e exploração por conta/posição, consolidando corretora, 401(k), Roth IRA e outras contas e oferecendo ferramentas de alocação, desempenho, lotes e análise fiscal. Em desktop, separar visão agregada de portfólio da exploração por conta e posição, com alocação e retorno consolidados e acesso a detalhes sem perder contexto total. **Evidência visual verificada:** página oficial aberta contém capturas Quicken Classic descritas como tela de conta, lista de transações e resumo de gastos; a página descreve visão de portfólio através de contas. Não foi identificada captura específica de patrimônio líquido consolidado. [18]

**Ideia singular.** Permitir que a seleção de conta ou posição abra seus detalhes preservando o mesmo período e o contexto do patrimônio total.

**Lacuna.** Somente duas referências com evidência visual adequada. Monarch descreve recursos de patrimônio/investimentos, mas a página consultada não mostrou captura verificável na extração. Portfolio Performance tem conteúdo público, porém o walkthrough acessado descreve telas móveis, não uma captura confirmada da interface desktop. Não se completou artificialmente a lista.

## 8. Confiança, privacidade e controle de dados financeiros

**Padrão observado.** Explicitar o modelo de confiança em texto curto e próximo das telas; sinalizar estado/atualização da sincronização; oferecer caminhos manuais de importação, edição ou reconciliação.

- [Moneydance](https://moneydance.com/) — resolve a comunicação de privacidade e criptografia junto a telas reconhecíveis de transações baixadas, registro e visão geral financeira; apresenta sincronização como extensão do fluxo desktop. Em desktop, exibir estado de conexão, “última atualização”, horário e origem dos dados, com ações claras de sincronizar, revisar e reconciliar manualmente. **Evidência visual verificada:** página oficial aberta com capturas vinculadas em tamanho integral, entre elas Online Banking (`onlinebanking_thumb.png` → `onlinebanking.png`), Summary e Account Registers. O texto adjacente declara privacidade, criptografia e não compartilhamento, e descreve sincronização com desktop; as capturas não confirmam painel detalhado de permissões. [4]

- [Actual Budget](https://actualbudget.org/) — resolve a explicação da relação entre dados sob controle do usuário, operação sem rede, sincronização entre dispositivos e criptografia ponta a ponta opcional, com telas de orçamento e transação como apoio. Em desktop, adotar indicador persistente “local / sincronizado / offline”, hora da última sincronização e indicação de que edições continuam disponíveis offline. **Evidência visual verificada:** página oficial aberta mostra `actual-main-budget.webp` e `actual-main-transaction.webp` como imagens embutidas de telas do produto; o texto descreve operação local-first, sincronização em segundo plano e criptografia opcional. As imagens não mostram controles específicos de conexão ou segurança. [19]

- [YNAB](https://www.ynab.com/features) — resolve a comunicação de continuidade entre dispositivos e associa conexão bancária a uma etapa identificável de seleção de instituição, com segurança apresentada em linguagem direta. Em desktop, separar visualmente “conectado ao banco” de “dados atualizados”, exibindo último sucesso/erro, frequência/estado e alternativa manual. **Evidência visual verificada:** página oficial aberta contém imagem de interface em browser, tablet e celular (`img_features_sync...avif`) e captura de seleção de instituição para importação bancária; também apresenta texto sobre segurança, criptografia, 2FA e atualização entre dispositivos. A imagem de sincronização é composição multiplataforma, não tela detalhada de configuração. [6]

**Ideia singular.** Mostrar “onde seus dados estão” e “quando foram atualizados” no mesmo local, com estado local/offline/sincronizado e opção de sincronizar ou reconciliar manualmente.

**Lacuna.** Três referências verificadas, uma delas app nativo multiplataforma (Moneydance) e duas web desktop. As capturas não mostraram painel detalhado de privacidade/permissões nem controles de sincronização; Actual Budget e YNAB são padrões adjacentes, não demonstrações diretas desses controles.

## Síntese

**Padrões recorrentes.** As referências convergem em resumir primeiro e permitir exploração progressiva: patrimônio, saldo ou indicador principal aparece antes da composição e dos registros. Gráficos tornam tendências e projeções legíveis quando estão ligados a filtros, categorias e transações subjacentes. Contexto preservado — saldo corrido, categoria, conta, status ou orçamento — reduz a necessidade de navegar para outra tela para entender um lançamento. Agrupamento, filtros e controles de período ajudam a lidar com a densidade do desktop. Para calendários, recorrências e sincronização, estado e timing devem ser explícitos; recomendações e alertas devem oferecer ações sem linguagem de culpa.

**Ideias singulares.** (1) Alternar patrimônio líquido e composição de ativos versus dívidas no mesmo gráfico, com seleção de contas. (2) Fazer do gráfico de fluxo de caixa uma interação ponto-a-dia que revela os lembretes responsáveis pela projeção e abre a ocorrência editável. (3) Exibir, no mesmo local, onde os dados estão e quando foram atualizados, incluindo alternativa de sincronização ou reconciliação manual.

**Falhas do workflow.** Nenhuma falha foi reportada nos dados fornecidos (`Falhas: []`). As ressalvas de evidência e as lacunas de quantidade estão registradas nas seções correspondentes.

## Referências

[1]: https://support.simplifi.quicken.com/en/articles/13337631-using-the-net-worth-feature "Using the Net Worth Feature"

[2]: https://www.banktivity.com/content/topics/net-worth-tracking/ "Net Worth Tracking"

[3]: https://www.wiz.money/download "MoneyWiz — Download"

[4]: https://moneydance.com/ "Moneydance"

[5]: https://info.quicken.com/win/using-the-account-register "Using the account register"

[6]: https://www.ynab.com/features "YNAB Features"

[7]: https://help.monarch.com/hc/en-us/articles/360048883631-Creating-Your-Budget-in-Monarch "Creating Your Budget in Monarch"

[8]: https://support.simplifi.quicken.com/en/articles/4212702-understanding-your-spending-plan "Understanding Your Spending Plan"

[9]: https://www.ynab.com/blog/ynab-reports-and-data "YNAB Reports and Data"

[10]: https://support.simplifi.quicken.com/en/articles/3357429-using-projected-cash-flow "Using Projected Cash Flow"

[11]: https://info.quicken.com/win/how-do-i-work-with-the-financial-calendar "How do I work with the Financial Calendar?"

[12]: https://www.ynab.com/whats-new?339368af_page=6 "YNAB — What's New (Loan Payoff Simulator)"

[13]: https://help.monarch.com/hc/en-us/articles/44373182867476-Using-Save-Up-Goals "Using Save-Up Goals"

[14]: https://help.monarch.com/hc/en-us/articles/44373293932052-Using-Pay-Down-Goals "Using Pay-Down Goals"

[15]: https://help.monarch.com/hc/en-us/articles/21846787088916-Using-Reports "Using Reports"

[16]: https://www.monarch.com/blog/monarch-brand-refresh "Monarch Brand Refresh"

[17]: https://support.simplifi.quicken.com/en/articles/4592676-using-reports-on-the-quicken-simplifi-web-app "Using Reports on the Quicken Simplifi Web App"

[18]: https://www.quicken.com/products/classic-premier/ "Quicken Classic Premier"

[19]: https://actualbudget.org/ "Actual Budget"