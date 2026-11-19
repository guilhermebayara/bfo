# A construir

Ordem de construção. Cada sessão marca aqui o que entregou.

## Fase 1: Movimento (brief em docs/briefs/fase-1-movimento.md)

- [x] Sessão A: fundação técnica, seed e interface funcional de Transações e Contas (estrutura e hierarquia, visual neutro).
  - Implementação e validação local concluídas. Publicação e validação remota dependem dos passos em `docs/cloudflare.md`.
- [ ] Sessão B: lançamento manual completo, categorias e grupos, marco e ajuste por conta.
- [ ] Sessão C: cartão, fatura, parceladas, pagar fatura, conferência.
- [ ] Sessão D: recorrentes, assinaturas, aviso de renovação.
- [ ] Sessão E: script de importação do Lunch Money (API v2), apagar e refazer importação.

- [ ] Conceito visual: feito no Claude depois que a estrutura da fase 1 estiver redonda. Duas propostas numa prévia, o dono escolhe olhando a tela, e só então o visual é aplicado.

## Fase 2: Patrimônio

- [ ] Contas de saldo, atualização mensal, investimentos por tipo, aporte e rendimento, empréstimos, patrimônio líquido ao longo do tempo. Brief a escrever quando a fase 1 estiver redonda.

## Fase 3: Orçamento

- [ ] Orçamento por categoria e por grupo, alocação por percentual, parcelas comprometidas. Brief a escrever quando a fase 2 estiver redonda.

## Produção (depois das três fases)

- [ ] Transferir bayara.design para a conta BFO (exportar registros DNS, importar na conta nova, conferir certificados, manter os registros do portfólio na Vercel). Fazer num momento tranquilo.
- [ ] Ligar bfo.bayara.design ao Worker de produção, com Access.
- [ ] Repositório privado antes do primeiro uso do token real.
- [ ] Importação definitiva e datas de corte de cada conta.
