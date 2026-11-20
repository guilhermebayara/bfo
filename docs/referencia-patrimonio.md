# Referência: patrimônio, investimentos e dívidas (fase 2)

Observações a partir de páginas públicas dos produtos, vistas em 20/11/2026. Sem decisão. O que está em `docs/decisoes.md` (seção Contas e fase 2) continua valendo para o BFO. O que já está em `docs/referencia-mercado.md` sobre o Lunch Money não é repetido aqui, salvo o recorte de patrimônio.

## Lunch Money (net worth)

Fontes: https://lunchmoney.app/features/net-worth · https://lunchmoney.app

- **Patrimônio líquido ao longo do tempo:** o site define patrimônio como ativos menos passivos. O rastreador tira foto dos saldos no fim de cada mês (contas sincronizadas, manuais e cripto). Há gráfico colorido histórico, visão em tabela ordenável, filtro por conta ou tipo (empréstimos, cartões, caixa), percentual de variação mês a mês por conta e por grupos de ativo/passivo, histórico manual editável e exportação CSV.
- **Investimentos:** o material de net worth fala em saldos de contas e carteiras cripto na soma; não descreve, nessa página, acompanhamento por ticker individual nem separação explícita de aporte e rendimento no gráfico de patrimônio.
- **Empréstimos e financiamentos:** entram como passivos na fórmula; o filtro cita loans e credit cards. Não há, na página de net worth, detalhe de parcelas ou antecipação.
- **Imóvel e outros bens:** a fórmula cita “everything you own”; contas manuais entram no snapshot. A página não descreve estimativa automática de imóvel.

## Monarch Money

Fontes: https://www.monarch.com/features/tracking · https://help.monarch.com/hc/en-us/articles/360048393392-Connect-or-Manually-Add-Accounts · https://help.monarch.com/hc/en-us/articles/41855507661076-Investments-in-Monarch · https://www.monarch.com/blog/personal-finance/net-worth-tracking-guide

- **Patrimônio líquido ao longo do tempo:** ativos conectados (caixa, investimentos, veículos, imóvel) menos passivos (cartões e empréstimos); contas manuais entram na soma. Gráfico ao longo do tempo com filtros por tipo; o blog descreve atualização diária após conectar contas e leitura da tendência em meses, não só do dia.
- **Investimentos:** por holding (ticker, quantidade, valor) e por classe na área Advanced; conexão automática ou conta manual com holdings (preço atualizado) ou só saldo manual. Retorno ponderado pelo tempo (time-weighted), comparado a benchmarks como S&P 500. Movimentações de compra/venda afetam holdings; o help separa performance de holdings do restante das finanças.
- **Empréstimos e financiamentos:** hipotecas e loans como contas de passivo; o saldo entra na soma. Discussões oficiais e de usuários descrevem imóvel + hipoteca como dois lados (ativo estimado e saldo devedor). A página pública de tracking não detalha parcelas nem antecipação de financiamento.
- **Imóvel e outros bens:** Zillow Zestimate para imóvel nos EUA; alternativa de conta manual com valor informado; veículos citados na fórmula de patrimônio.

## Empower (Personal Dashboard)

Fontes: https://www.empower.com · https://www.empower.com/tools/link-accounts · https://www.empower.com/tools/net-worth · https://support-personalwealth.empower.com/hc/en-us/articles/201169740-Dashboard-Overview · https://support-personalwealth.empower.com/hc/en-us/articles/201169750-Accounts-Panel-Overview · https://www.nerdwallet.com/finance/learn/empower-personal-dashboard-budget-app-review

- **Patrimônio líquido ao longo do tempo:** widget de net worth com total atual e gráfico dos últimos 365 dias, variação de 365 dias e de 1 dia; painel de contas separado em Assets e Liabilities. Contas ligadas (bancos, investimentos, cartões, empréstimos, hipotecas) alimentam a visão.
- **Investimentos:** widget de Performance do portfólio (90 dias); Market Movers e página de Holdings; Investment Checkup de alocação e taxas (descrito no marketing e em review). Atualização via vínculo com instituições; o material público enfatiza holdings e alocação mais do que “só saldo por tipo”.
- **Empréstimos e financiamentos:** Debt Paydown mostra total ainda devido e variação no ano calendário a partir dos saldos das contas de passivo ligadas; mortgages e loans entram no painel de Liabilities. Não há, no overview público, fluxo de antecipação de parcelas.
- **Imóvel e outros bens:** mortgages ligados; ativos manuais citados no painel de Accounts. A tabela comparativa pública da Kubera classifica imóvel no Empower como “Estimate” (https://www.kubera.com/net-worth-tracker). Detalhe de método de estimativa não estava na página de overview vista.

## Copilot Money

Fontes: https://www.copilot.money · https://help.copilot.money/en/articles/6213732-accounts-tab-overview · https://help.copilot.money/en/articles/6097003-tracking-holdings-with-manual-accounts · https://help.copilot.money/en/articles/5497919-calculating-investment-performance · https://help.copilot.money/en/articles/10262766-investment-account-limitations

- **Patrimônio líquido ao longo do tempo:** gráfico na aba Accounts; ativos (depository + investments) e dívidas; opção de uma linha só ou ativos e dívidas separados; exclusão de contas do gráfico; timeframe selecionável; marketing fala em net worth “every day”.
- **Investimentos:** por conta e por holding; conexão diária pós-fechamento do mercado; Live Estimates com preço quase em tempo real (não grava no histórico). Contas manuais por holdings (quantidade + preço) ou por saldo. Performance estimada no estilo time-weighted, excluindo depósitos e saques da métrica de retorno. Comparação de holdings com o mercado no marketing (`Your holdings` vs S&P 500).
- **Empréstimos e financiamentos:** cartões e dívidas entram no net worth (Assets vs Debt no marketing); utilização de limite em cartões aparece nos mockups. O help de Accounts não detalha parcelas de empréstimo nem antecipação.
- **Imóvel e outros bens:** contas manuais/offline citadas em reviews e no help; a tabela da Kubera lista “Estimate or manual” para real estate no Copilot (https://www.kubera.com/net-worth-tracker).

## Kubera

Fontes: https://www.kubera.com/net-worth-tracker · https://help.kubera.com/article/5-add-assets-kubera · https://help.kubera.com/article/135-how-to-manually-add-assets-with-quantity-and-price · https://help.kubera.com/article/142-ai-import-files-and-screenshots

- **Patrimônio líquido ao longo do tempo:** ativos menos dívidas; snapshot diário desde o início; gráfico histórico; CAGR/IRR e benchmark; métrica “investable” ao lado do total (tira o que não liquida rápido, ex. casa de moradia). Sem orçamento: o site se descreve como balanço, não budget.
- **Investimentos:** conexão a corretoras; tickers com quantidade e preço; privados com valor manual ou quantidade × preço; cash flows (capital calls e distributions) para IRR; importação de extratos/PDF/screenshot. Preços ao vivo onde há feed.
- **Empréstimos e financiamentos:** página própria de dívidas (hipoteca, HELOC, margin, cartões, empréstimos privados, committed capital ainda não chamado); dívida pode ser ligada ao ativo correspondente. Não descreve, nas páginas vistas, calendário de parcelas no estilo fatura.
- **Imóvel e outros bens:** imóvel por endereço com estimativa (EUA); carro por VIN (EUA/Canadá) ou valor manual; ouro, arte, domains com feeds ou estimativa; resto manual com histórico ao atualizar o número.

## Kinvo (Brasil)

Fontes: https://www.kinvo.com.br · https://suporte.kinvo.com.br/open-finance/articles/resumo-da-carteira · https://suporte.kinvo.com.br/open-finance/articles/analises-de-rentabilidade-no-kinvo · https://suporte.kinvo.com.br/articles/48c87376-9ec0-4f68-a67c-36f97dfb64fd · https://suporte.kinvo.com.br/open-finance/articles/como-conectar-instituicoes-financeiras-via-open-finance · https://suporte.kinvo.com.br/open-finance/articles/ativos-personalizados · https://suporte.kinvo.com.br/open-finance/articles/faq-ativos-personalizados

- **Patrimônio líquido ao longo do tempo:** Resumo da Carteira com patrimônio consolidado, evolução histórica de patrimônio ou de rentabilidade, patrimônio por instituição, ganho de capital. Histórico automático a partir da data do consentimento Open Finance (exceto conexão BTG, com histórico mais completo, segundo o suporte).
- **Investimentos:** consolidação via Open Finance e conexão BTG; análises por tipo (renda variável, fundos, renda fixa); rentabilidade histórica no modelo de cotas (aportes e resgates alteram quantidade de cotas, não “zeram” o rendimento passado). Comparação com CDI, IPCA, IBOV, IFIX etc.
- **Empréstimos e financiamentos:** categoria “Créditos e dívidas” nos Ativos Personalizados (empréstimos, financiamentos, FGTS entre os exemplos). Cadastro e cotação manuais; não há, no artigo visto, fluxo automático de parcelas bancárias.
- **Imóvel e outros bens:** Ativos Personalizados com categorias Imóveis, Veículos, Bens de valor, Metais, Outros; quantidade única (só cotação/resgate total) ou variável (aplicação, resgate parcial, cotação, proventos); valores em R$; evolução e rentabilidade no detalhe do ativo.

## Gorila (Brasil)

Fontes: https://www.gorila.com.br · https://gorila.com.br/para-investidores · https://gorila.com.br/view · https://gorila.com.br/core/docs/metrics/nav · https://gorila.com.br/core/docs/metrics/invested_amount · https://gorila.com.br/core/docs/core-concepts/portfolio

- **Patrimônio líquido ao longo do tempo:** no motor, NAV = valor de mercado das posições + caixa e provisões − obrigações; série histórica diária/mensal/anual. Produto voltado a consolidação de investimentos (B2B e investidores), não a orçamento doméstico completo.
- **Investimentos:** por ativo e por classe/custodiante; integração B3 e boletador; “Valor investido” (custo das unidades em carteira) separado do valor de mercado; aportes e resgates de caixa no portfólio (manual ou `autoRnC`); P&L com realizados e não realizados. Ativos personalizados no plano View.
- **Empréstimos e financiamentos:** obrigações entram no NAV na documentação de métricas; o site de investidor enfatiza carteira de investimentos. Parcelas de financiamento imobiliário no estilo conta corrente não aparecem nas páginas vistas.
- **Imóvel e outros bens:** ativos personalizados no View; o foco público é mercado financeiro. Estimativa automática de imóvel residencial não aparece nas páginas vistas.

## Mobills (Brasil)

Fontes: https://www.mobills.com.br · https://www.mobills.com.br/pricing/ · https://www.mobills.com.br/blog/mobills/como-utilizar-o-mobills/ · https://play.google.com/store/apps/details?hl=pt&id=br.com.gerenciadorfinanceiro.controller · https://www.mobills.com.br/blog/planilhas/planilha-de-investimentos/

- **Patrimônio líquido ao longo do tempo:** o app público descreve contas, cartões, receitas, despesas, orçamento, objetivos e saldo geral/previsto. Não descreve, nas páginas vistas do produto, um gráfico dedicado de patrimônio líquido no sentido ativos − passivos ao longo dos meses.
- **Investimentos:** fora do núcleo do gerenciador, a Mobills oferece planilha gratuita de investimentos (extrato de compra/venda, aportes/saques, painel de patrimônio da conta investimento e diversificação). No app, o posicionamento é fluxo de caixa e cartões.
- **Empréstimos e financiamentos:** conteúdo e calculadoras de empréstimo no ecossistema; no gerenciador, o destaque é cartão e contas. Plano de quitação de dívida no estilo Empower Debt Paydown não aparece nas páginas de produto vistas.
- **Imóvel e outros bens:** objetivos genéricos (ex. juntar para casa) no app; valor de imóvel como ativo de balanço não aparece nas páginas de produto vistas.

## Pistas para o BFO (sem decisão)

Perguntas cruzando as observações acima com a seção Contas de `docs/decisoes.md` (contas de saldo, investimento por tipo sem ativo individual, aporte via transferência, rendimento = variação − aportes, empréstimo com saldo mensal e parcela na corrente, imóvel com atualização mensal, patrimônio = soma no fim do mês).

1. O BFO separa aporte de rendimento pela transferência para a conta de investimento. Algum desses produtos trata o aporte da mesma forma (movimento entre contas), ou a separação aparece só na métrica de performance (Copilot TWR, Kinvo cotas, Gorila valor investido vs mercado)?
2. O BFO não acompanha ativo individual, só tipos dentro da corretora. Monarch, Copilot, Empower, Kubera, Kinvo e Gorila mostram holdings. O Lunch Money, na página de net worth, fala em saldos. Qual recorte de “por tipo” vs “por ticker” aparece com mais clareza nessas fontes quando o objetivo é só o patrimônio mensal?
3. O BFO tira foto no fim do mês. Lunch Money descreve snapshot de fim de mês; Monarch, Copilot, Empower e Kubera descrevem atualização diária ou contínua. O que muda na leitura do gráfico quando a foto é mensal e não diária?
4. Empréstimos no BFO: saldo atualizado no mês e parcela como recorrente na corrente; antecipação na fase 2. Empower mostra Debt Paydown por saldo; Kinvo coloca financiamento em ativo personalizado. Algum produto público descreve antecipação de empréstimo com desconto registrado, no mesmo espírito da antecipação de cartão já decidida no BFO?
5. Imóvel no BFO é conta de saldo com valor manual mensal. Monarch e Kubera (EUA) oferecem estimativa automática; Kinvo pede cotação manual. Como as fontes tratam a diferença entre valor estimado pelo mercado e valor que o dono confirma?
6. Kubera separa patrimônio total e “investable”. O BFO soma contas de movimento e de saldo no fim do mês. Alguma fonte brasileira (Kinvo, Gorila) expõe um recorte parecido (líquido vs investível)?
7. Gorila e Kinvo separam custo aplicado (valor investido / modelo de cotas) da variação de mercado. O BFO calcula rendimento como variação do saldo menos aportes do mês. Em que ponto essas contas públicas coincidem com essa regra, e em que ponto falam de P&L de ativo e não de conta?
8. Mobills cobre movimento e cartão, e empurra investimentos para planilha. Lunch Money junta orçamento e net worth no mesmo produto. O BFO já decidiu as três fases. O que as fontes mostram sobre manter patrimônio no mesmo app do lançamento manual, sem sync bancário?
