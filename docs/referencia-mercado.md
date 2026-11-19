# Referência: o Lunch Money e o mercado

Resumo do site público do Lunch Money (lunchmoney.app: páginas de recursos, comparações e blog), coletado em 19/11/2026. É contexto para ideias, sem decisão. O que está em `docs/decisoes.md` vale mais.

## Como o Lunch Money se apresenta

- Importação por sincronização com bancos, CSV, PDF, lançamento manual e API.
- Orçamento flexível: categorias e períodos próprios, servindo a vários métodos (envelope, base zero, contínuo, 50/30/20) sem impor um.
- Mais de 160 moedas, com cotação histórica por transação.
- Transações com categorias, grupos, tags coloridas, divisão, agrupamento, busca avançada e anexos (comprovantes).
- Regras automáticas com sugestões aprendidas.
- Ferramenta de consulta: conjuntos de dados próprios, filtros de incluir e excluir, tabelas com total, média e contagem, gráficos e exportação CSV.
- Estatísticas e tendências, com um resumo mensal por e-mail.
- Calendário de fluxo de caixa por dia, com lançamento direto.
- Recorrentes com projeção de renda e gasto, detecção de divergência e análise do custo mínimo de vida.
- Patrimônio com fotos de fim de mês, histórico editável e exportação.
- Cripto, colaboração com vários logins e API pública.
- Posicionamento: pago pelo cliente, sem anúncios, sem venda de dados.

Fontes: https://lunchmoney.app/features/import-transactions/, https://lunchmoney.app/features/budgeting/, https://lunchmoney.app/features/transactions, https://lunchmoney.app/features/analytics/, https://lunchmoney.app/features/calendar/, https://lunchmoney.app/features/recurring-expenses/, https://lunchmoney.app/features/net-worth, https://lunchmoney.app/why-lunch-money

## Produtos com que ele se compara

- **Actual Budget:** código aberto, dados locais, só método envelope. Pede servidor próprio para sincronizar. https://lunchmoney.app/compare/actual-budget-alternative
- **YNAB:** base zero, curva de aprendizado alta. https://lunchmoney.app/compare/ynab-alternative
- **Monarch Money:** planejamento e projeções, uma moeda só, API fechada. https://lunchmoney.app/compare/monarch-alternative
- **Empower:** painel de investimentos e patrimônio, com orçamento básico. https://lunchmoney.app/compare/empower-alternative
- **Rocket Money:** foco em detectar e cancelar assinaturas. https://lunchmoney.app/compare/rocket-money-alternative
- **Quicken Simplifi:** plano de gastos e projeções. https://lunchmoney.app/compare/simplifi-alternative
- **Tiller:** transações e saldos direto numa planilha (Google Sheets ou Excel). https://lunchmoney.app/blog/best-budgeting-apps
- **Origin:** consultor com IA, projeções, planejamento de vida. https://lunchmoney.app/blog/best-budgeting-apps
- Também citados: Mint (encerrado), Credit Karma, QuickBooks, Goodbudget, EveryDollar, Dollarwise.

## Pistas para o BFO (sem decisão)

- **Custo mínimo de vida** a partir dos recorrentes essenciais: conversa com a meta de independência financeira e com a alocação.
- **Calendário de fluxo de caixa:** quando entra e sai dinheiro em cada dia, com recorrentes e parcelas futuras.
- **Anexos:** comprovante ou nota na transação.
- **Resumo mensal:** um fechamento do mês (não necessariamente por e-mail).
- **Ferramenta de consulta** para perguntas livres sobre o histórico.
- **Pesquisas que valem depois:** Actual Budget (lançamento manual e código aberto), Monarch e Empower (patrimônio e investimentos), Tiller (planilha como interface), Rocket Money (assinaturas). Nenhum produto brasileiro aparece nas comparações; Mobills e Organizze seriam a referência local.
