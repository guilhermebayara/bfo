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