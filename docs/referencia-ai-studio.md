# Referências: análise do Google AI Studio

Análise feita pelo dono no Google AI Studio em 20/11/2026, sem contexto do projeto, só com as referências e a informação de que era um app de finanças pessoais para desktop. Diferente das análises anteriores, esta viu as capturas das telas: Mira (5), Charted (2) e as nove do Mobbin. Sem decisão. O texto do AI Studio está abaixo, como veio; o moodboard em HTML que o acompanha ficou fora do repositório.

## Cruzamento com o BFO

### Onde contraria decisões

- Parte do claro, com cartões escuros de destaque. O BFO decidiu modo escuro sempre; o eixo continua sendo escuro neutro ou escuro tingido (ver [consolidado](referencia-visual-consolidado.md)).
- Fila "a revisar", motor de regras e modo casal ou família ficam de fora pelas decisões (lançamento manual, uma pessoa só).
- A paleta e a tipografia propostas são do AI Studio. Identidade visual só sai das duas direções do conceito, escolhidas pelo dono.

### O que acrescenta ao conceito visual da fase 1

- As nove telas do Mobbin descritas uma a uma (seção 1C). Serve de pré-leitura para a análise com o dono, que pode ficar mais curta: confirmar o que fica e o que sai.
- Gramática de micrográficos da Mira, mais detalhada que no consolidado: faixa de pontos com marcador de hoje, anel com marcas, cápsulas de progresso e linha do tempo em barras finas. A linha do tempo em barras finas atende o patrimônio com um ponto por mês, que o consolidado já dizia pedir barras ou degraus.
- Título em dois tons, com o fato em tinta forte e a leitura em tom apagado, junto de contadores de estado. Conversa com a frase de situação da Mira e com "o que pede atenção" da tela inicial.
- Conta explícita em "+ / - / =" (Rocket Money). Serve à projeção de "quanto tenho disponível": saldo de hoje, mais entradas previstas, menos saídas previstas, igual ao fim da janela.
- Mestre e detalhe em três colunas, com um painel à direita que explica o número selecionado (Copilot e Mira). Conversa com "todo total leva às transações" e com a origem ao lado do resultado.

### Para os briefs das fases 2 e 3

- Fase 3: cascata do plano do mês (renda, menos fixos, menos planejado, menos reservas, igual ao que sobra), do Quicken Simplifi; matriz de vários meses com grupos recolhíveis, do Monarch.
- Fase 3: reservas por objetivo com cápsulas de progresso, junto da ideia de metas com valor e data.

---

# Quiet Ledger — Visual Moodboard & Consolidated Design Direction Report
**Project:** Personal Finance Desktop Application  
**Date:** November 2026  
**Guardrail:** *Pattern & hierarchy synthesis only. Zero brand identity (colors, typography, or logos) copied from any reference.*

---

## Executive Thesis: "Quiet Ledger"
Personal finance desktop apps typically fall into two traps: cold accounting spreadsheets or noisy mobile-first consumer feeds. **Quiet Ledger** bridges both worlds—combining **institutional tabular precision** (hairline grids, `tabular-nums`, explicit math waterfalls) with **calm, editorial visual storytelling** (warm light canvas, strategic dark atmospheric focal cards, plain-language takeaways, and discrete micro-visualizations).

---

## 1. Visual DNA Extracted from All References

### Phase 1: Product & Functional Benchmarking (Websites & Apps)
| Reference | Organizational / Hierarchical Pattern Observed | Intentionally Left Behind |
| :--- | :--- | :--- |
| **Copilot Money** | "Transaction fixes" review queue; plain-language context; seamless bird's-eye → drilldown | Heavy dark neon aesthetic; emoji clutter |
| **Origin Financial** | Prioritized "Next Action" insight cards (`RESERVES`, `CASH FLOW`) and scenario forecasting | Advisory upsell framing |
| **Lunch Money** | Desktop-first ledger density, color-coded tags, multi-currency clarity, rules engine | Older web-app chrome |
| **PocketGuard** | Immediate "Safe to Spend / Leftover" hero metric + month-end "Pace" warning | Mobile-only card stacking |
| **YNAB** | Intentional category grouping ("Available" vs. "Assigned") that lowers money anxiety | Mandatory zero-based budgeting friction |
| **Quicken** | Projected cashflow factoring upcoming bills/taxes alongside net worth | Legacy multi-ribbon desktop clutter |
| **Revolut / Nubank** | Modular goal containers ("Caixinhas" / Vaults), localized BRL (`R$`) clarity, calm trust cues | Consumer super-app promo banners |
| **Stripe** | Tabular numeric alignment, clean status pills (`Cleared`, `Pending`, `Refunded`), hairline tables | Developer/B2B SaaS terminology |

### Phase 2: Aesthetic & Data-Viz Calibration (16 Uploaded Screenshots)

#### A. Preferred Data Visualization (`mirabio.framer.website` — 5 screens)
* **80/20 Light-to-Dark Contrast:** ~80% warm off-white Bento cards anchored by **1–2 high-contrast dark cards with a soft ambient radial glow** for the most important forecast, score, or contextual inspector.
* **Two-Tone Editorial Headlines:** Uppercase micro-eyebrow (`SATURDAY, 21 NOVEMBER`) above a split-contrast headline—**dark ink for the primary fact, muted gray for the takeaway** (`"R$ 2.140 safe to spend. Trending better than Oct."`), paired with right-aligned summary counters (`12 On track · 2 Watch · 1 Review`).
* **Signature Micro-Visualizations (Zero Visual Noise):**
  * **Discrete Dot-Matrix Range Strips:** Horizontal dot tracks showing spent dots vs. limit dots with a crisp vertical "Today Pace" marker (replaces loud rainbow progress bars).
  * **Radial Tick-Mark Ring:** Segmented/ticked circular gauge for monthly budget pace or savings score.
  * **Capsule Battery Meters:** Tiny vertical capsule ticks (`6/8 filled`) for Vaults, Reserves, and Goal milestones.
  * **Vertical Tick-Bar Timeline:** Minimalist bar-tick horizon for multi-month Net Worth or runway tracking.
* **Floating Pill Top Navigation + Master-Detail Drawer:** Lightweight top pill switcher freeing full horizontal width for 3-column screens.

#### B. General Visual Inspiration (`Charted` / `second-hexagon-433551.framer.app` — 2 screens)
* Generous whitespace, matte paper-like surfaces, crisp 1px borders, bold typographic hierarchy, structured 2-column comparison cards, and pill CTAs with circular directional arrows.

#### C. Financial Dashboard Patterns (`Mobbin` — 9 screens)
1. **Remote:** Clean SaaS header + KPI banner + 3-column ring progress cards + key-value metadata table.
2. **Rocket Money:** Sticky right-hand **Summary Ring + `+ / - / =` Cashflow Equation** + daily allowance run-rate (`R$ 238/day for the next 9 days`).
3. **Monarch Money:** Multi-month **Budget & Forecast Matrix** with collapsible groups (`Income`, `Fixed`, `Flexible`), inline totals, and subtle pill-inputs.
4. **HoneyBook:** Cashflow combo chart (bars + net income line) with inline legend metrics and `Show net income` toggle.
5. **Copilot Money (Light Mode):** **3-column Categories Master-Detail** (Account/Group tree left · Category pace bars center · Yearly sparkline + grouped daily transaction inspector right).
6. **Quicken Simplifi (Dark Mode):** Left-to-right **Spending Plan Waterfall** (`Income +` → `Bills -` → `Planned Spend -` → `Goals -` = `Left this month`).
7. **Sweatpals & Posh (Dark Mode):** Disciplined dark bento spacing, 4-column semantic KPI strip, clean dark sortable expense tables (blueprint for optional Dark Focus Mode).
8. **Stripe:** `Today` hero pulse + `Your overview` modular sparkline cards + crisp tabular alignment.

---

## 2. Four Visual Pillars (DO / DON'T Guardrails)

1. **Quiet Surfaces, Loud Data:** Matte paper neutrals, 1px hairline dividers, minimal shadows. Color is reserved strictly for status, trajectory, and interactive focus.
2. **Bird's-Eye → Inspector:** Always allow checking the month in 3 seconds (KPI pulse) or reconciling transactions in a right-hand contextual inspector without losing page context.
3. **Forward-Looking Rhythm:** Emphasize *pace*, *today markers*, *daily run-rate*, and *projected horizons* rather than staring only in the rearview mirror.
4. **Tactile Modularity:** Separate day-to-day liquidity (`Safe to Spend`) from protected reserves (`Vaults / Goals`) and long-term `Net Worth`.

---

## 3. Original Color & Token System *(Zero Brand Overlap)*

Completely distinct from Mira's lime-olive, Charted's sage-green, Stripe/Nubank's purple, and Rocket Money's coral.

### Surfaces & Ink (Light-First Cockpit)
* `#F3F2EE` **Warm Chalk** — App canvas (paired with subtle `9%` teal ambient wash in top-right)
* `#FFFFFF` **Pure Sheet** — Primary Bento cards, tables, floating pill bar
* `#FAF9F6` **Soft Paper** — Nested mini-cards, table headers
* `#EAE8E1` **Sand Well** — Pill tracks, secondary wells, inactive dot states
* `#E2DFD7` **Hairline Stone** — 1px structural borders & subtle gridlines
* `#17191A` **Deep Ink** — Primary balances, active pills, headline part 1
* `#8F918C` **Editorial Muted** — Headline part 2, secondary labels, timestamps
* `#5E6260` **Slate Body** — Metadata, column headers, axis labels

### Strategic Dark Focal Cards
* `#14171A` **Obsidian Slate** — Dark anchor card base (Net Worth hero, Category Inspector, Dark Mode base)
* `#1D4B4F` **Petrol Ambient** — Soft radial gradient glow inside dark focal cards

### Original Accents & Semantic Status
* `#175C5E` **Deep Petrol Teal** — Primary interactive accent, on-track / surplus (`soft bg #E6F2F1`)
* `#C98224` **Burnished Amber** — Watch / approaching pace, needs review (`soft bg #FAF0E2`)
* `#B84A39` **Clay Terracotta** — Over budget, negative variance, alert (`soft bg #F9E9E7`)
* `#3C5A78` **Mineral Blue** — Forecast projections, investments, scheduled items (`soft bg #EAF0F6`)

### Data-Viz Multi-Series Palette (Colorblind-Considerate)
1. `#175C5E` Deep Petrol Teal *(Housing / Core Fixed)*
2. `#3C5A78` Mineral Blue *(Investments / Savings)*
3. `#C98224` Burnished Amber *(Dining / Lifestyle)*
4. `#7A638D` Muted Plum *(Subscriptions / Recurring)*
5. `#5B8A8A` Seafoam Slate *(Transport / Utilities)*
6. `#B0ACA3` Warm Taupe *(Other / Uncategorized)*

---

## 4. Typography & Numeric Craft

* **Display & UI Sans:** Clean neo-grotesque (*Inter*, *Plus Jakarta Sans*, or *Geist*).
* **Numeric Discipline (Non-Negotiable):**
  * `font-variant-numeric: tabular-nums lining-nums` on **every** monetary figure, percentage, and date.
  * Right-align all ledger currency columns (`-R$ 284,50`) with clean visual hierarchy between sign, symbol, whole units, and cents.
* **Type Scale Specimen:**
  * *Two-Tone Editorial Greeting:* `30px–34px` / Weight `600` (`-0.03em` tracking)
  * *Hero Card Figure:* `36px–40px` / Weight `500` (`tabular-nums`)
  * *Card Title / Metric:* `16px–20px` / Weight `600`
  * *Dense Ledger Row:* `12.5px–13px` / Weight `400–500` (`tabular-nums`)
  * *Micro-Eyebrow / Status Pill:* `10.5px–11px` / Weight `600` (`+0.06em` uppercase)

---

## 5. Data Visualization Grammar

1. **Dot-Matrix Pace Strips (Default Category View):** Replaces heavy multi-color progress bars. Discrete dots show allocation; filled dots show spend; a crisp vertical tick marks *today's ideal pace*.
2. **Radial Tick Dial + `+ / - / =` Equation:** Pairs Mira's radial tick ring with Rocket Money's explicit budget equation and daily run-rate.
3. **Projected Cashflow Line + Dashed Horizon:** Solid line for actual MTD balance; dashed `#3C5A78` line + soft `10%` translucent band for upcoming bills/inflows.
4. **Capsule Reserve Meters:** Discrete vertical pills (`6/8` filled) for Vaults and Emergency Fund runway.
5. **Chart Hygiene:** Zero 3D effects, zero heavy shadows under curves, max 3 dashed horizontal gridlines (`#E2DFD7`), and exact crosshair deltas on hover.

---

## 6. Three-Screen Desktop Architecture

### Screen 1: Overview *(Bento Cockpit)*
* **Top:** Floating Pill Nav (`Overview | Transactions | Budgets | Forecast | Vaults`) + Account Sync indicator + `+ Add entry`.
* **Header:** Two-tone editorial greeting + right-aligned status counts (`12 On track · 2 Watch · 1 Review`).
* **Upper Bento:** *Categories to watch* (4 mini dot-strip cards) on the left (60%) + *Dark Net Worth & Trajectory Card* on the right (40%).
* **Lower Strip:** *Monthly Pace Dial & Equation* + *Vaults Capsule Meters* + *Needs Review Queue* (suggested refund matches & uncategorized items).

### Screen 2: Budgets & Categories *(3-Column Master-Detail)*
* **Left (`200px`):** Collapsible group/account tree (`All`, `Fixed`, `Living`, `Subscriptions`, `Excluded`) with status dots & counts.
* **Center (Fluid):** Clean table (`Category | Spent | Dot-Matrix Pace Strip | Budget | Status`) + dense transaction drilldown toggle.
* **Right (`310px` Dark Inspector):** Hero spent vs. budget figure, 6-month sparkline with average band, plain-language diagnosis, and bottom pill CTA (`View transactions →`).

### Screen 3: Forecast & Cashflow *(Matrix + Waterfall + Ledger)*
* **Top Controls:** `Budget | Forecast` switch · `Monthly | Yearly` toggle · `Today` jump.
* **Spending Plan Waterfall:** Quicken-style vertical/horizontal equation (`Income +` → `Bills -` → `Planned -` → `Vaults -` = `Projected Left`).
* **Multi-Month Matrix:** Monarch-style expandable groups across 6 months with editable assumption pills, paired below with a Stripe/Lunch Money hairline **Transactions Ledger**.

---

## 7. Owner Sign-Off Checklist (Before Wireframing)
1. **Navigation Topology:** Stick with **Floating Pill Top Nav** (maximum horizontal space for 3-column Master-Detail & Forecast matrices) or add a **Slim Collapsible Left Rail** for always-visible bank account balances?
2. **Dark Mode Scope:** Keep the **80/20 Light Canvas + Dark Focal Cards** as default with an optional full **Dark Focus Mode** toggle (inspired by Posh/Sweatpals)?
3. **Accent Temperature:** Confirm **Deep Petrol Teal (`#175C5E`) + Burnished Amber (`#C98224`)** as the original brand direction, or test a shift toward Mineral Indigo or Warm Espresso.
---

# Rodada 2: captura a captura, com o contexto do BFO

Mesma conversa do AI Studio, 20/11/2026, agora com as decisões principais no prompt (escuro sempre, lançamento manual, planilha densa em Transações, quatro perguntas da tela inicial, todo número leva às transações). Sem decisão. Texto do AI Studio abaixo, como veio.

## Cruzamento

### O que mais serve, na leitura do chat

- Stripe "Today": linha contínua até hoje e pontilhada até o fim da janela, com o saldo mínimo sinalizado e um link direto para os lançamentos. É o desenho mais próximo da pergunta "quanto tenho disponível" (projeção de 30 dias com o ponto mais baixo e a data).
- Quicken Simplifi, a única captura já no escuro: a conta em cascata até o que sobra e os cartões de "Included this month" com o dia num quadrado, selo de estado e valor à direita. Servem a "o que vence em 7 dias" e à tela de Assinaturas.
- Copilot: clicar numa linha abre à direita o histórico e as transações que formam o número. É o desenho mais direto de "todo total leva às transações".
- Mira Biomarkers: três colunas (filtros com ponto de atenção, lista com faixa e marcador, painel escuro de detalhe com botão para as transações), para Contas e Cartão.
- Rocket Money: sublinhado tracejado indicando valor editável ao clicar. Detalhe útil para a planilha de Transações.

### Onde a leitura dele não se aplica

- Ele sugere o Monarch como molde estrutural de Transações. A planilha já existe e foi decidida; do Monarch vale o acabamento (grupos recolhíveis, subtotais), sem trocar a estrutura.
- Valores de cor citados das capturas (Sweatpals) não entram: identidade visual sai das duas direções do conceito.
- As duas capturas do Charted eram a mesma página de divulgação. O que vale dele segue no consolidado (origem ao lado do resultado).

### Efeito na fila

Esta rodada cobre a descrição das nove telas do Mobbin. A análise com o dono pode virar uma rodada curta de confirmação (o que fica e o que sai), antes do conceito visual.

---

Abaixo está a análise das 16 capturas avaliada estritamente segundo as decisões do projeto: aplicativo desktop individual em português do Brasil, sempre em modo escuro, lançamento 100% manual (sem conexão bancária, sem regras automáticas, sem fila de revisão e sem modo casal), tela de **Transações** como planilha densa editável na célula, telas de leitura mais arejadas (**Tela inicial**, **Cartão de crédito** com fatura, **Contas** e **Assinaturas**), rastreabilidade de todo número até as transações que o formaram e **Tela inicial** restrita às quatro perguntas definidas.

---

## Avaliação individual das 16 capturas

| Captura | O que a tela resolve | Elemento específico que vale levar e para qual tela | O que não serve e por quê |
| :--- | :--- | :--- | :--- |
| **input_file_0.png**<br>Mira (Overview) | Painel diário de saúde reunindo biomarcadores em alerta, idade biológica, sono, checklist do dia e chat médico. | 1) Os 4 mini-cards dentro de *"Biomarkers to watch"* com pílula de status e faixa horizontal de pontos com traço vertical de referência, para a pergunta 4 na **Tela inicial** (gasto por grupo contra o mesmo intervalo do mês anterior).<br>2) O card escuro *"Biological age"* com número principal grande (`31.6`) e barra de traços verticais com marcador destacado, para o bloco da pergunta 1 (projeção de 30 dias com ponto mais baixo e data) na **Tela inicial**.<br>3) Os 3 contadores discretos no topo direito (`80 Optimal`, `27 In range`, `5 To review`) para resumir pendências na pergunta 2 da **Tela inicial**. | O fundo claro predominante contraria o modo escuro fixo. O bloco de conversa *"Ask your care team"* e o checklist com horários fixos *"Today's plan"* não têm função em finanças individuais manuais. A saudação genérica *"You're trending better"* sem vínculo clicável não atende à regra de todo número levar às transações. |
| **input_file_1.png**<br>Mira (Biomarkers) | Exploração mestre-detalhe de 112 marcadores por categoria e status, com painel lateral explicativo do item selecionado. | A estrutura em 3 colunas: filtros à esquerda com bolinha laranja indicando categorias com alerta (`Heart · 3`), lista central limpa com a faixa pontilhada e traço vertical de limite por linha, e painel direito escuro com número grande (`103`), gráfico de linha sobre faixa de referência (`OCT 25` a `OCT 26`) e botão em pílula no rodapé (convertido em *"Ver transações"*). Serve às telas de **Contas**, **Cartão de crédito** e ao detalhamento de um grupo clicado na **Tela inicial**. | A barra superior, a coluna de filtros e a tabela central estão em tema claro, o que fere o modo escuro obrigatório. A tabela central funciona apenas para leitura e não resolve a edição por célula exigida na tela de **Transações**. Os rótulos clínicos (*Optimal*, *Watch*, *Low*) precisam virar estados reais (*Conferida*, *Sem conferência*, *Atrasado*). |
| **input_file_2.png**<br>Mira (Sleep) | Detalhamento de uma noite de sono por estágios horários, pontuação radial e regularidade semanal. | Apenas os 4 mini-cards inferiores com valor e variação comparativa (`Deep 1h 38m`, `+12 min vs avg`) e as 4 barras horizontais no canto inferior direito (`Duration`, `Deep sleep`, `Consistency`, `Restfulness`), que funcionam em modo escuro para mostrar variações comparativas na tela de **Cartão de crédito** ou em **Assinaturas**. | O gráfico central *"Sleep stages"* (faixas luminosas de `23:00` a `07:00`), o seletor diário de notas (`M 71` até `S 86`) e o card *"Bed & wake times"* são metáforas exclusivas de sono circadiano e não traduzem vencimentos, faturas ou fluxo de caixa. O tema branco predominante fere o modo escuro fixo. |
| **input_file_3.png**<br>Mira (Plan) | Plano trimestral com três metas comportamentais, agenda diária e controle de estoque de suplementos. | 1) O card escuro *"Supplements"* no canto inferior direito com medidores em cápsulas verticais segmentadas (8 tracinhos indicando reserva restante) e botão *"Refill"*, útil na tela de **Assinaturas** para indicar parcelas/ciclos cumpridos ou renovação próxima.<br>2) A lista *"Today"* com data/hora alinhada à esquerda em linha simples, útil na **Tela inicial** para listar o que vence nos próximos 7 dias (pergunta 3). | Os três grandes cards verticais de hábitos (`Lower LDL`, `Rebuild iron`, `Protect sleep`) ocupam a maior parte da tela com instruções qualitativas sem vínculo transacional. Os dois cards brancos centrais e o fundo claro desrespeitam o modo escuro obrigatório. |
| **input_file_4.png**<br>Mira (Care) | Troca de mensagens com equipe médica, envio de resultado no chat e marcação de chamada de vídeo. | Somente o microchip escuro embutido na conversa (`Ferritin · Nutrients · 22 ng/mL · Low`), como formato compacto de linha para itens da pergunta 2 (o que pede atenção) na **Tela inicial**. | A lista de contatos clínicos à esquerda, a janela de chat central e o seletor de data e hora *"Book another time"* servem para comunicação com terceiros e agenda de consultas, recursos inexistentes em um aplicativo pessoal individual e manual. O fundo claro também não serve. |
| **input_file_5.png**<br>Charted (`second-hexagon-433551.framer.app`) | Página comercial de apresentação de um software médico de transcrição de consultas, integrações e planos. | O pequeno card explicativo *"From conversation to signed note"*, que destaca em cor suave o trecho de origem correspondente ao campo preenchido, como referência sutil de realce visual ao inspecionar de onde veio um total na **Tela inicial** ou na conferência de **Cartão de crédito**. | Trata-se de um site de marketing em tema claro (hero de vendas, depoimentos, FAQ, formulário de demonstração e preços), e não de uma tela operacional de desktop app. Além disso, o produto divulgado gira em torno de automação por IA, o que contraria o lançamento manual sem regras automáticas. |
| **input_file_6.png**<br>Mobbin (Remote) | Painel de acompanhamento de período de teste gratuito de plataforma empresarial de RH e recrutamento. | O card *"Plan details"* com pares chave e valor limpos (`Plan status`, `Activated on`, `Ends on`) combinado ao box de alerta com borda destacada (`"1 day left on your free trial"`), útil em versão escura para a ficha de cada item em **Assinaturas** ou para avisar conta sem conferência há muito tempo. | Os três cards gigantes de rosca quase vazia (`Talent insights (9/20)`, `Job posts (1/50)`, `Profile unlocks (1/15)`) desperdiçam espaço nobre com baixa densidade. O menu lateral de RH (`Recruiting`, `Team Management`, `Payroll`), o banner azul e o fundo branco não atendem ao projeto. |
| **input_file_7.png**<br>Mobbin (Rocket Money) | Acompanhamento mensal de orçamento por categorias com cálculo do valor disponível por dia. | 1) O card direito *"SUMMARY"* com a conta explícita `+ / - / =` (`Spending Budget`, `Current Spend`, `Remaining`) e a frase de ritmo diário (`"That's $1,815/day for the next 11 days of the month"`), útil como complemento de leitura no card de projeção de 30 dias (pergunta 1) na **Tela inicial**.<br>2) O sublinhado tracejado nos valores da coluna `Budgeted` sinalizando edição direta ao clicar, útil na tela de **Transações**.<br>3) O seletor de mês no topo direito (`<- Jul. 2025`, `Sep. 2025 ->`) para navegar entre faturas de **Cartão de crédito**. | Fundo branco claro. A tabela central compara gasto contra teto estático sem comparar com o mesmo intervalo de dias do mês anterior (pergunta 4). O bloco *"Get the app"* na lateral direita do rodapé do menu empurra para aplicativo móvel, enquanto a decisão é desktop primeiro. Não há indicação clara de clique no valor gasto para abrir as transações. |
| **input_file_8.png**<br>Mobbin (Monarch) | Matriz financeira de múltiplos meses (`Feb 2025` a `Jul 2025`) com grupos expansíveis de receita e despesa. | A grade densa de planilha desktop com grupos recolhíveis (`Income`, `Expenses -> Fixed`, `Flexible`), linhas de subtotal em negrito (`Total Income`) e células numéricas editáveis diretamente na tabela (`$12,900`, `$500`, `$100`). É o melhor molde estrutural para a tela de **Transações** como planilha densa editável na célula (trocando colunas de meses pelas colunas de lançamento). | Tema branco claro. Banner promocional amarelo *"Get 45% discount"* e item *"Advice"* no menu lateral. A lógica exibida na imagem serve para digitar valores orçados futuros, e não para registrar lançamentos individuais com data, conta e status de conferência. |
| **input_file_9.png**<br>Mobbin (HoneyBook) | Painel financeiro para autônomos e pequenas empresas com fluxo de caixa anual, pagamentos e vínculo bancário. | 1) O gráfico *"Cashflow"* com os três totais na legenda superior (`Net income`, `Paid payments`, `Expenses`) e barras combinadas com linha de saldo líquido cruzando valores positivos e negativos (`-$10K` a `$15K`), útil para inspirar o histórico de saldo ou a projeção de 30 dias na **Tela inicial** (com destaque do ponto mais baixo).<br>2) A faixa inferior de status (`Paid (4)`, `Processing (0)`, `Overdue (1)`, `Upcoming (1)`) para resumir atrasos e vencimentos em **Contas** ou **Tela inicial**. | Toda a coluna direita *"Financial tracker"* com botão `"+ Link account"` e avisos de `"Connect your bank accounts"` e `"Connect your cards"` viola a regra de lançamento manual sem conexão bancária. A área principal clara, as abas empresariais (`QuickBooks`, `Tax Hub`) e o foco em cobranças de clientes não servem. |
| **input_file_10.png**<br>Mobbin (Copilot Money) | Gestão de categorias em três colunas ligando árvore de contas, barras de consumo e lista de transações do item selecionado. | A ligação direta do painel direito *"Category"*: ao clicar em uma linha central (`Shopping`), o painel lateral exibe o gráfico ao longo do tempo, os resumos (`Spent per year`, `Avg monthly`) e a lista das transações que formam aquele número (`Sunday, June 21 · Powerbank $15.00`). Resolve com precisão a regra de todo número levar às suas transações na **Tela inicial** (pergunta 4), em **Contas** e em **Cartão de crédito**. A lista agrupada de saldos à esquerda (`Depository`, `Investment`, `Loan`) também ajuda na tela de **Contas**. | Tema claro. Uso de emojis em categorias e transações. As barras horizontais coloridas comparam apenas contra o orçamento total do mês e não contra o mesmo intervalo do mês anterior. O menu suspenso com *"Excluded categories"* existe sobretudo para limpar ruído de importação bancária automática, desnecessária no lançamento manual. |
| **input_file_11.png**<br>Mobbin (Quicken Simplifi) | Planejamento mensal em modo escuro calculando quanto sobra no mês após contas fixas, gastos planejados e metas. | Já está em **modo escuro** e traz dois elementos fortes: (1) Os blocos empilhados à esquerda com sinais `+`, `-` e `=` levando ao saldo final (`Left this month`); (2) Os cards da direita dentro de *"Included this month"* exibindo quadradinho do dia (`12`, `26`), selo `"Upcoming"`, ícone de recorrência e valor à direita (`+$150.00`), ideais para responder à pergunta 3 (o que vence nos próximos 7 dias) na **Tela inicial** e para a tela de **Assinaturas**. | O botão roxo flutuante de assistente de IA no canto inferior direito e a caixa *"Excluded this month"* ligada a filtros automáticos não servem. A rosca vermelha grossa abaixo de `Left this month` mostra só um saldo estático sem curva temporal de 30 dias, o que não responde ao ponto mais baixo e à data pedidos na pergunta 1. |
| **input_file_12.png**<br>Mobbin (Sweatpals) | Painel analítico escuro para organizadores de eventos acompanharem inscrições, acessos, conversão e capacidade. | Apenas a paleta escura discreta (`#0A0A0A` e `#121212` com bordas finas) e a barra dupla horizontal de *"Event Capacity"* (`Spots Taken 6` e `Spots Remaining 4`), adaptável para mostrar limite utilizado e limite disponível na tela de **Cartão de crédito**. | Toda a lógica da tela é funil de marketing de eventos (`RSVPs`, `Event page views`, `Conversion Rate 71%`, `Retention Rate`, `First Timer vs Returning`), com dois gráficos de rosca enormes ocupados por um único dado cada. Não há projeção temporal, lista de vencimentos nem caminho até transações. |
| **input_file_13.png**<br>Mobbin (Posh) | Controle de orçamento e despesas de um evento em modo escuro com quatro indicadores no topo e tabela ordenável. | O visual escuro limpo dos 4 cards superiores com cor semântica nos valores (`Current Revenue`, `Total Expenses`, `Projected Profit`, `Maximum Profit`) e a tabela escura com setas de ordenação nas colunas (`Amount`, `Date`), aplicável ao acabamento visual escuro de **Transações** ou à listagem em **Assinaturas** e **Contas**. | O botão `"+ Add Expense"` que abre modal, os ícones de lápis e lixeira por linha que obrigam edição fora da célula e a paginação curta de rodapé (`Previous / Next`) prejudicam a fluidez de planilha densa editável diretamente na célula exigida em **Transações**. O contexto de evento (`Live -- event starts in 3 days`, `Budgeting | Analytics | Profit & Loss`) também não se aplica. |
| **input_file_14.png**<br>Mobbin (Stripe) | Painel operacional financeiro mostrando volume do dia, saldo negativo, chaves técnicas de integração e grade modular. | O conjunto do bloco superior *"Today"*: linha contínua até o momento atual que segue pontilhada até o fim da janela, acompanhada abaixo pelo saldo com ícone de atenção vermelho (`-MYR 49.08`) e link direto *"View"* ao lado. Esse formato (linha sólida até hoje, linha pontilhada até +30 dias, sinalização de mínimo negativo e link direto para os lançamentos) resolve a pergunta 1 na **Tela inicial** e os alertas de saldo na tela de **Contas**. | Tema claro. Os blocos direitos *"Recommendations"* e *"API keys"*, assim como a barra inferior *"Developers"*, são exclusivos de infraestrutura técnica para programadores. Os minigráficos da seção *"Your overview"* exibem eixos cortados e não oferecem edição manual. |
| **input_file_15.png**<br>Charted (`second-hexagon-433551.framer.app`) | Cópia exata da captura `input_file_5.png` (página comercial completa do software clínico Charted). | Na metade inferior da página, apenas o pequeno card flutuante dentro do acordeão que mostra comparações diretas antes e depois (`8.1% -> 7.4%`) e a tabela escura compacta de correspondência de campos (`Chief complaint -> Encounter reason`), úteis apenas como referência discreta de comparação numérica em **Cartão de crédito** (fatura anterior contra atual). | Sendo duplicata de uma página de vendas médica em tema claro, todo o restante (cartões de especialidades, depoimentos, conformidade HIPAA, tabela de preços, FAQ e formulário de contato) não oferece nenhuma estrutura de tela operacional para finanças pessoais em modo escuro. |

---

## As cinco capturas que mais servem

1. **input_file_11.png (Mobbin, Quicken Simplifi):** Já funciona em modo escuro com barra lateral compacta de desktop e entrega prontos dois componentes críticos: a soma em cascata até o valor disponível e a lista de lançamentos futuros com badge de dia do mês e estado *"Upcoming"*, atendendo diretamente às perguntas 1 e 3 da **Tela inicial** e à tela de **Assinaturas**.
2. **input_file_8.png (Mobbin, Monarch):** É a única captura que mostra com clareza uma planilha densa de desktop com agrupamentos expansíveis, subtotais e células editáveis diretamente na grade, fornecendo o modelo estrutural exato para a tela de **Transações** (convertida para modo escuro e colunas de lançamento manual).
3. **input_file_10.png (Mobbin, Copilot Money):** Resolve melhor do que qualquer outra captura a rastreabilidade exigida pelo projeto ("todo número leva às transações que o formaram"), conectando no mesmo espaço visual a lista de grupos ou contas, a barra de consumo e o inspetor lateral com gráfico histórico e transações agrupadas por dia.
4. **input_file_1.png (Mira, Biomarkers):** Traz a melhor arquitetura arejada de leitura em três colunas para telas secundárias (**Contas** e **Cartão de crédito**), unindo filtros com ponto indicador de atenção à esquerda, comparação visual limpa sem poluição no centro e painel lateral escuro de análise detalhada com botão de ação para abrir os lançamentos.
5. **input_file_0.png (Mira, Overview):** Embora clara no original, resolve exatamente a separação visual das quatro perguntas da **Tela inicial** sem virar outra planilha: card escuro de destaque numérico com régua de ticks (projeção de 30 dias), grade de quatro cards comparativos com marcadores de referência (gasto por grupo contra o mês anterior), contadores de atenção no topo direito e bloco limpo de próximos compromissos.

---

## As cinco capturas que menos servem

1. **input_file_5.png (Charted, Landing page):** Página institucional de marketing médico em fundo claro, com preços, depoimentos, FAQ e formulário de contato, focada em automação por IA e sem nenhuma utilidade prática para telas internas de aplicativo financeiro manual.
2. **input_file_15.png (Charted, Duplicata de input_file_5.png):** Arquivo idêntico ao anterior, repetindo os mesmos problemas de ser um site comercial de produto médico em tema claro, sem interface operacional de desktop app.
3. **input_file_4.png (Mira, Care):** Tela inteira dedicada a chat com equipe clínica e marcação de videoconferência, recursos que conflitam diretamente com a premissa de aplicativo individual, sem terceiros, sem consultor e sem modo casal.
4. **input_file_6.png (Mobbin, Remote):** Painel corporativo claro de gestão de período de teste de RH, dominado por roscas grandes com pouquíssimos dados (`9/20`, `1/50`, `1/15`), banner promocional e menus de equipe e folha de pagamento distantes de finanças pessoais manuais.
5. **input_file_12.png (Mobbin, Sweatpals):** Embora esteja em modo escuro, é um painel de funil de marketing para produtores de eventos (`RSVPs`, visualizações de página, taxa de conversão e retenção) com gráficos de rosca gigantes quase vazios e nenhuma estrutura ligada a fluxo de caixa, vencimentos, faturas ou planilha editável.
---

# Rodada 3: a linguagem das referências no escuro, em duas direções

Mesma conversa, 20/11/2026. Pedido: mostrar como a linguagem da Mira e do Charted vive num fundo escuro, em duas direções (A, escuro neutro em carvão; B, escuro tingido), com superfícies, escala de números, pílulas de estado, cores de sinal e duas telas de exemplo. O HTML está em [referencias/ai-studio-direcoes-escuras.html](referencias/ai-studio-direcoes-escuras.html), com nomes de banco inventados. Sem decisão: identidade visual só sai das duas direções do conceito, escolhidas pelo dono.

## Cruzamento

### O que serve ao conceito

- A divisão das duas direções coincide com o eixo do consolidado (escuro neutro ou tingido) e mostra que os dois funcionam com números densos.
- Regras de número que valem testar: "R$" menor e em tom apagado, para o olho correr só pelos algarismos; três níveis (herói, indicador, célula); transferência com uma marca neutra (⇄) no lugar do sinal.
- Alerta (âmbar) e estouro (vermelho-coral) distintos em matiz, como o consolidado pedia, e transferência em cinza.
- Pílulas que se diferenciam também por contorno (pontilhado, tracejado, só borda), não só por cor. Ajuda a planilha a não virar mosaico.
- A leitura dele sobre a escolha: A favorece a planilha, onde nada compete com os estados; B dá personalidade às telas de leitura. Fica a pergunta para o conceito se os dois registros (planilha e leitura) podem usar graus diferentes de tingimento.

### Onde erra o BFO, por falta de contexto

- Estados usados no sentido errado. Aberta, fechada e paga são estados de fatura, e aparecem em linhas de transação. "Herdada" no BFO é a marca de categoria que vem do grupo, e ele usa em parcela. "Pendente" no BFO é a transação que veio pendente do Lunch Money, e ele usa em assinatura perto de renovar. "Só arquivo" é estado de conta. "Ajuste" é lançamento de diferença, e ele usa como "conferir". Fatura fechada aparece sempre em âmbar, mas só pede atenção enquanto não foi conferida. O prompt do conceito precisa trazer a definição de cada estado.
- Transferência mostrada como "Alvorada -> Meridiano" na coluna da conta, que é justamente o formato substituído em 19/11 (origem na coluna Conta, "→ destino" no Beneficiário).
- Pagamento de fatura aparece como lançamento comum em âmbar; no BFO é transferência para o cartão, neutra.
- A planilha tem colunas genéricas (Grupo, Estado). A do BFO tem conta, beneficiário, categoria, tags, notas e valor com o botão de sinal.
- Pergunta 1: o número herói é o saldo de hoje. A regra da tela inicial pede o resultado no fim da janela, separando o que já entrou, o que vai entrar e o que vai sair. A conta "+ / - / =" da rodada 2 resolve isso.
- Pergunta 4: grupos acima do mês anterior em âmbar e vermelho. Nenhuma decisão define limiar de alerta nessa comparação; fica como pergunta.
- Só mostra navegação no topo; a pergunta de navegação lateral ou no topo segue aberta.

---

A linguagem da Mira e do Charted não depende do fundo branco para existir. O que sustenta aquela estética é a combinação de **hierarquia tipográfica em dois tons** (fato principal em alto contraste e contexto em tinta contida), **camadas com contraste controlado**, **micrográficos limpos sem ruído de eixos** e **espaço de respiro nas telas de leitura** em contraste com **alta densidade alinhada nas grades**.

Para trazer essa linguagem para um aplicativo **sempre escuro**, sem apenas inverter o claro para preto, o caminho se divide em duas direções contrastantes. Nenhuma delas copia o verde oliva e o lima da Mira, o verde musgo do Charted ou as fontes de marca de qualquer referência.

---

## Direção A: Escuro neutro em carvão

Esta direção traduz a clareza editorial do Charted e a leveza da Mira para um ambiente **estritamente acromático nas superfícies**. O fundo e os cartões não têm temperatura de cor; todo o protagonismo cromático fica reservado exclusivamente aos sinais financeiros (positivo, alerta e estouro).

### 1. Superfícies e bordas
* **Fundo da aplicação (`#0D0E10`):** carvão profundo fosco, sem brilho ambiente colorido, reduzindo fadiga em uso prolongado no desktop.
* **Superfície primária de leitura (`#15171A`):** cartões da Tela inicial, painéis laterais e área principal da planilha.
* **Superfície elevada / cabeçalho fixo / barra de navegação (`#1C1F23`):** usada na pílula de navegação superior, no cabeçalho fixo da planilha de transações e no cartão de projeção de 30 dias (destacado por contraste de borda e iluminação sutil branca de 4% no topo, e não por cor).
* **Poço interno / célula em edição / campo de entrada (`#101214`):** afunda levemente para dar sensação tátil de digitação direta na célula.
* **Bordas:** hairline de `1px` em `#26292E` para cartões e `#202328` para divisórias internas de planilha; na célula ativa em edição, borda de foco nítida em branco suave (`#D8DCE2`) com anel externo discreto.

### 2. Escala de números em três níveis e regra de `R$` e sinal
* **Nível 1, Número herói (`36px`, peso `600`, tracking `-0.03em`, `tabular-nums`):** usado apenas no valor central de disponibilidade da projeção de 30 dias na Tela inicial.
* **Nível 2, Indicador (`20px`, peso `600`, tracking `-0.02em`, `tabular-nums`):** usado nos totais dos grupos de gasto, no ponto mais baixo projetado e nos totais de resumo da barra superior da planilha.
* **Nível 3, Célula de tabela (`13px`, peso `500`, `tabular-nums`):** usado em todas as linhas da planilha densa de transações, sempre alinhado à direita.
* **Regra para `"R$"`:** sempre dois pontos abaixo em peso e menor em escala (`0.68em` no herói e indicador; `11px` na célula), em tinta apagada (`#7E848E`), separado por um espaço fino fixo, para que o olho escaneie apenas a coluna dos algarismos.
* **Regra para o sinal:**
  * **Saídas:** sinal `-` em cor de texto principal ou de estouro/despesa antes do `"R$"` (ex.: `- R$ 284,50`), alinhado à esquerda do bloco numérico da célula.
  * **Entradas:** sinal `+` em cor positiva antes do `"R$"` (ex.: `+ R$ 6.800,00`).
  * **Transferência entre contas:** sem sinal de `+` nem `-` (substituído por ícone discreto de dupla seta `⇄` em cinza neutro antes do `"R$"`), garantindo que nunca pareça gasto nem receita.

### 3. Cores de sinal
* **Positivo / folga (`#38B889`):** verde esmeralda frio dessaturado, legível sobre carvão sem vibrar.
* **Alerta (`#E0A23B`):** âmbar dourado quente, usado para fatura fechada sem conferência, assinatura perto de renovar, conta desatualizada ou grupo encostando no ritmo do mês anterior.
* **Estouro (`#E05858`):** carmim coral nítido, claramente separado do âmbar tanto no matiz quanto na carga emocional, reservado para saldo projetado negativo, recorrente atrasado ou grupo que já superou o mesmo intervalo do mês anterior.
* **Transferência entre contas (`#8B929E`):** cinza ardósia neutro, com zero carga semântica de ganho ou perda.

### 4. Pílulas de estado (9 estados)
Para manter a planilha densa sem virar um mosaico colorido, as pílulas diferenciam estado financeiro por **preenchimento sutil, contorno ou estilo de borda**:
* **aberta:** fundo `#1D232B`, borda `#2F3A47`, texto `#B4C2D4` (ciclo atual em andamento).
* **fechada:** fundo `rgba(224, 162, 59, 0.14)`, borda `rgba(224, 162, 59, 0.40)`, texto `#ECC173` (fatura fechada pedindo conferência).
* **paga:** fundo `rgba(56, 184, 137, 0.13)`, borda `rgba(56, 184, 137, 0.35)`, texto `#6BD4AC`.
* **importada:** fundo `#202328`, borda `#323740`, texto `#B5BBC4` (vinda de importação manual de arquivo).
* **retroativa:** fundo `#1F2029`, borda `#37394C`, texto `#B7BCE0` (lançada em data passada).
* **só arquivo:** fundo transparente, borda pontilhada `#353940`, texto `#787E88` (registro histórico fora do saldo ativo).
* **pendente:** fundo `rgba(224, 162, 59, 0.08)`, borda tracejada `rgba(224, 162, 59, 0.45)`, texto `#E0A23B`.
* **ajuste:** fundo `#27221B`, borda `#4A3D28`, texto `#D6B484` (acerto manual de conciliação).
* **herdada:** fundo transparente, borda sólida `#31353B`, texto `#9AA0AA` (parcela ou recorrência trazida de ciclo anterior).

---

## Direção B: Escuro tingido (inspirada no cartão escuro da Mira e nos blocos do Charted)

Esta direção transporta para a tela inteira a atmosfera do cartão escuro da Mira (profundidade por gradiente radial deslocado e superfícies translúcidas sobrepostas) e a precisão dos blocos escuros do Charted (tabelas de borda fina sobre massa cromática escura). Para não copiar os verdes da Mira nem do Charted, o tingimento aqui usa um **petróleo oceânico profundo e frio**.

### 1. Superfícies e bordas
* **Fundo da aplicação (`#071013`):** carvão profundamente tingido de petróleo frio, com brilho radial muito suave no quadrante superior direito (`rgba(44, 132, 145, 0.14)`).
* **Superfície primária de leitura (`#0D1A1F`):** cartões de leitura e área base da planilha com leve transparência mineral.
* **Cartão focal com atmosfera Mira (`linear-gradient` `#132B32` até `#0B1519` com foco radial `#1C4954`):** usado no card de projeção de 30 dias da Tela inicial, reproduzindo exatamente a profundidade do cartão escuro da Mira sem recorrer ao verde oliva.
* **Superfície elevada / cabeçalho / barra de pílulas (`#122329`):** mantém o mesmo matiz petróleo para evitar cinza morto sobre fundo tingido.
* **Bordas:** sempre tingidas no mesmo eixo (`#1C323A` nos cartões e `#162930` nas linhas da planilha); célula em edição recebe borda luminosa em água-marinha clara (`#63D0D6`).

### 2. Escala de números em três níveis e regra de `R$` e sinal
* **Nível 1, Número herói (`36px`, peso `500`, tracking `-0.03em`, `tabular-nums`):** segue o peso ligeiramente mais esguio e editorial dos números grandes da Mira (`31.6`, `103`), em branco mineral (`#F0F7F8`).
* **Nível 2, Indicador (`20px`, peso `600`, tracking `-0.02em`, `tabular-nums`):** leitura imediata nos cards de grupo, ponto mínimo da projeção e subtotais.
* **Nível 3, Célula de tabela (`13px`, peso `500`, `tabular-nums`):** células densas da planilha, com alto contraste (`#E1ECEE`) contra fundo `#0D1A1F`.
* **Regra para `"R$"`:** em escala reduzida (`0.65em` no herói e indicador; `11px` na célula) e tinta secundária tingida (`#719199`), mantendo a coluna numérica limpa.
* **Regra para o sinal:**
  * **Saídas:** sinal `-` antes do `"R$"` em `#B9CDD2` (ou `#E86B5D` quando for atraso/estouro).
  * **Entradas:** sinal `+` antes do `"R$"` em verde água-esmeralda (`#47C99E`).
  * **Transferência entre contas:** marcador neutro `⇄` antes do `"R$"` em azul-petróleo dessaturado (`#7C9AA3`), sem alterar o peso semântico de receitas ou despesas.

### 3. Cores de sinal
* **Positivo / folga (`#47C99E`):** verde-menta mineral frio, harmonizado com a base petróleo.
* **Alerta (`#E8AD42`):** ocre dourado luminoso, nítido para pendências, vencimentos próximos e itens próximos do limite.
* **Estouro (`#E86458`):** terracota coral vivo, bem separado do ocre dourado tanto em temperatura quanto em saturação, usado para estouro de gasto contra o mês anterior, atraso ou saldo mínimo crítico.
* **Transferência entre contas (`#7C9AA3`):** cinza-petróleo neutro, integrado à paleta sem parecer entrada nem saída.

### 4. Pílulas de estado (9 estados)
* **aberta:** fundo `rgba(76, 195, 200, 0.12)`, borda `rgba(76, 195, 200, 0.34)`, texto `#8CE0E3`.
* **fechada:** fundo `rgba(232, 173, 66, 0.14)`, borda `rgba(232, 173, 66, 0.42)`, texto `#F2C572`.
* **paga:** fundo `rgba(71, 201, 158, 0.14)`, borda `rgba(71, 201, 158, 0.36)`, texto `#78DFBA`.
* **importada:** fundo `#14262D`, borda `#23414B`, texto `#9EC0C9`.
* **retroativa:** fundo `#152130`, borda `#273E59`, texto `#9CC0E8`.
* **só arquivo:** fundo transparente, borda pontilhada `#243D45`, texto `#65848C`.
* **pendente:** fundo `rgba(232, 173, 66, 0.08)`, borda tracejada `rgba(232, 173, 66, 0.48)`, texto `#E8AD42`.
* **ajuste:** fundo `#262118`, borda `#4C3F28`, texto `#DFBE8A`.
* **herdada:** fundo transparente, borda sólida `#233A42`, texto `#89A8B0`.

---

### Resumo prático da escolha entre A e B
* **Direção A (Carvão Neutro)** maximiza neutralidade na planilha densa de **Transações**, pois nada compete com as 9 pílulas de estado e com os sinais de positivo, alerta e estouro durante horas de digitação manual.
* **Direção B (Escuro Tingido)** preserva melhor a personalidade atmosférica do cartão escuro da Mira e dos blocos do Charted nas telas de leitura arejadas (**Tela inicial**, **Contas**, **Cartão de crédito** e **Assinaturas**), dando identidade própria sem perder legibilidade numérica.
---

# Rodada 4: refinada com as referências de family office

Conversa do AI Studio, 21/11/2026, com docs/referencia-family-office.md e docs/a-construir.md como base. HTML em [referencias/ai-studio-family-office.html](referencias/ai-studio-family-office.html), com alternância de navegação (lateral ou topo) e de mês (saudável ou apertado). Sem decisão.

Leitura do dono: melhorou, direção certa, mas ainda mais perto da origem (painel de produto comum) do que do destino (a sensação de family office).

## Cruzamento

### O que avançou

- Marfim no lugar do branco puro, "R$" apagado, número herói em peso leve.
- Latão para alerta e terracota para estouro: o mês ruim fica visível sem virar alarme.
- Marinho só no bloco de destaque e nos links clicáveis, separado do verde de positivo.
- Navegação recuada, em contraste mais baixo que a área de trabalho.
- Alternância de mês apertado, para julgar o tom no aperto.

### Por que ainda está perto da origem, na leitura do chat

- A estrutura não mudou: a mesma grade de cartões com borda, um dentro do outro (cartão com caixinhas dentro), rótulos pequenos em caixa alta sobre cada bloco e pílula em quase toda linha. Trocou a paleta e manteve o esqueleto de painel.
- Muitos contêineres disputando atenção. A sensação buscada pede menos caixas e mais estrutura sentida: espaço e alinhamento organizando a página, colunas que se alinham de uma seção para outra.
- Cor ainda distribuída por toda parte (cada estado com sua cor). No destino, a página fica quase monocromática e a cor aparece só onde há exceção.
- O gráfico de projeção é pequeno e decorativo; na tela inicial ele é a resposta principal.
- O refino que define a sensação (ritmo de espaçamento, movimento, resposta ao teclado, acabamento dos detalhes) não aparece num protótipo estático.

---

Esta nova versão do moodboard deixa para trás a estética genérica de painel SaaS e traduz para o **BFO** a sobriedade de um escritório patrimonial sob medida, unindo o controle rigoroso da Fase 1 (`docs/a-construir.md`) às referências de family office, aplicativos nativos de Mac e finanças sóbrias.

---

## 1. O que muda a partir das novas referências

| Referência | Princípio absorvido para o BFO | O que fica de fora |
| :--- | :--- | :--- |
| **Addepar** | **Elevação por iluminação** no escuro (o fundo é o plano `0`; cartões ganham profundidade ficando um grau mais claros em vez de depender de bordas fortes em tudo; poços de entrada e gráficos ficam um grau mais escuros); **links clicáveis em azul/marinho** para nunca disputar cor com o verde de saldo positivo. | Tom corporativo pesado multiusuário e tipografia de marca da Addepar. |
| **Masttro** | Todo número de topo tem caminho direto até a origem; a **prontidão e confiabilidade dos dados** aparece no centro da tela inicial (fatura fechada sem conferência, conta desatualizada), porque número sem conferência derruba a confiança do painel. | Estruturas societárias complexas de múltiplos custodiantes e automação documental. |
| **Linear** | **Navegação recuada**: barra lateral ou barra superior entra em contraste mais baixo que a área de trabalho para não competir com os números; **estrutura sentida, não gritada** (menos linhas divisórias); **cuidado com o escuro quente demais**, que deixa a tela turva em uso contínuo. | Visual de startup de engenharia com brilho roxo ou ícones miúdos por toda parte. |
| **Things 3 e Apple macOS** | **95% da interface em neutros precisos** e cor reservada apenas para significado real; geometria firme de Mac (raios contidos entre `6px` e `14px`, evitando o arredondado "divertido" em excesso); densidade calma com respiro medido, fonte do sistema com `tabular-nums` e prioridade total ao teclado. | Metáforas literais de papelaria ou animações decorativas. |
| **Mercury** | Tom institucional sério e sereno em modo escuro: fluxos de caixa e transações sem ruído visual de banco de varejo, respeitando a hierarquia entre dia a dia e reservas. | Colaboração em equipe, comentários entre colegas e integrações de folha. |

---

## 2. Linguagem visual do BFO (Tradução arquitetônica sem literalidade)

A sua referência de espaço físico (neutros quentes e claros, marinho como destaque, verde floresta quebrando em pontos específicos, madeira e modernismo brasileiro) não entra de forma literal (sem texturas de madeira nem marrom turvo no fundo). Ela orienta a **temperatura e o peso cromático** sobre um escuro limpo:

### A. Superfícies, profundidade por luz e bordas
* **Plano `0` (Fundo da aplicação, `#0B0C0E`):** grafite mineral profundo e limpo. Evita ficar turvo (como alerta a Linear) e garante descanso visual no Mac.
* **Plano `-1` (Poços rebaixados / células em repouso / área de gráficos, `#08090B`):** um degrau abaixo do fundo, seguindo a lógica da Addepar para acomodar números e inputs sem caixas chamativas.
* **Plano `1` (Superfície de leitura / cartões principais, `#121417`):** eleva pela luz, reduzindo a dependência de bordas pesadas.
* **Plano `1.5` (Bloco focal em Marinho Profundo, `#0F1926` com brilho sutil `#17283D`):** onde o **marinho** aparece como destaque arquitetônico (card de projeção de 30 dias na Tela inicial e fatura selecionada no Cartão de crédito).
* **Plano `2` (Barra de navegação recuada / cabeçalho da planilha, `#16191D`):** discreta e estável.
* **Bordas:** apenas `1px solid rgba(255, 255, 255, 0.06)` nos cartões e `rgba(255, 255, 255, 0.05)` na grade da planilha. O foco de edição usa contorno limpo em marfim (`#D9D4CA`).

### B. Tipografia e escala numérica (Mac nativo + precisão tabular)
* **Família:** pilha nativa Apple (`-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui`), mantendo `font-variant-numeric: tabular-nums lining-nums` em toda a aplicação.
* **Três níveis numéricos:**
  1. **Número herói (`38px`, peso `300` Light, tracking `-0.03em`):** elegância editorial inspirada na Apple e na leveza dos totais da Addepar, em **Marfim Alabastro (`#EFECE6`)** em vez de branco `#FFFFFF` estourado.
  2. **Indicador (`20px`, peso `500`, tracking `-0.02em`):** nos cartões de grupo, ponto mínimo dos 30 dias, limite do cartão e totais do resumo mensal.
  3. **Célula da planilha (`12.5px`, peso `400/500`, linhas de `40px`):** alinhada à direita, mantendo o tamanho exato em repouso, hover e edição (conforme decidido na Sessão I).
* **Regra para `"R$"` e sinal:**
  * `"R$"` sempre em `0.62em` (ou `10.5px` na célula) e tinta mineral apagada (`#646973`).
  * Saídas com `-` antes do `"R$"`; entradas com `+` antes do `"R$"` em verde floresta; transferências sem `+` nem `-`, com `⇄` em neutro (`#7A818D`) e destino `→ Conta B` na coluna `Beneficiário`.
  * **Links e números clicáveis ("todo número leva às transações"):** sublinhado pontilhado discreto no repouso e tinta **Marinho Claro (`#78A2D4`)** no hover, separando clicabilidade do verde positivo.

### C. Cores pontuais e sinais (incluindo o mês ruim)
* **Verde Floresta (`#3C946E` / suave `#64BA93`):** folga, entrada positiva, categoria abaixo do mês passado, estado `paga`.
* **Ouro Envelhecido / Latão (`#C99A49`):** o toque quente sutil (referência filosófica aos metais e madeiras do escritório) usado exclusivamente no **Alerta** (fatura fechada sem conferência, assinatura perto de renovar, conta desatualizada, grupo encostando no mês anterior).
* **Terracota Carmim (`#CC5E55`):** usado exclusivamente no **Estouro / Déficit** (saldo mínimo negativo na projeção de 30 dias, recorrente atrasado, grupo estourado). Mantém o mês ruim visível, pragmático e acionável, sem parecer alarme de videogame.
* **Transferência neutra (`#7A818D`):** cinza mineral neutro.

---

## 3. Resposta visual para as duas questões abertas do `a-construir.md`

O arquivo HTML interativo abaixo traz dois seletores no topo para você testar olhando:
1. **Navegação Lateral Recuada (estilo Things/Linear)** contra **Navegação no Topo Compacta (estilo Mira/macOS)**: na lateral, a hierarquia (`Movimento`, `Cadastros`, `Aplicativo`) acomoda melhor o crescimento das Fases 2 e 3, mas disputa `~200px` horizontais com as 9 colunas da planilha de **Transações** e com o resumo mensal ao lado; no topo, a planilha e as telas de 3 colunas ganham largura máxima, exigindo um agrupamento compacto para os futuros itens de Patrimônio e Orçamento.
2. **Mês Saudável** contra **Mês Apertado ("Todo Ferrado")**: alterna os números da Tela inicial para você julgar se, mesmo mostrando déficit de `- R$ 1.240,00` no ponto mínimo e cartões estourados, a interface continua transmitindo calma, controle e clareza de ação.

---

## 4. Moodboard Interativo Completo (`bfo-moodboard-family-office.html`)

Salve o código abaixo como `bfo-moodboard-family-office.html` e abra no Safari ou navegador no Mac.

### Próximo passo após analisar este protótipo
1. Alternar **Nav Lateral** contra **Nav no Topo** no HTML e decidir qual acomoda melhor as 9 colunas de **Transações** e o crescimento das Fases 2 e 3.
2. Alternar **Mês Saudável** contra **Mês Apertado** para validar se o tom pragmático em **Terracota** e **Marinho** passa a firmeza de escritório patrimonial mesmo no aperto.
3. Após a sua análise das 9 telas do Mobbin depois de 23/11, consolidar a escolha de navegação e fechar os tokens finais antes de aplicar no BFO.