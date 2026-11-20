# Sessão J: cartão e parcelas

Branch `tst-cartao-parcelas`, criada de `origin/homologacao` no commit `be9b5e6`. Sem PR nesta sessão. O chat de gestão abre o PR para `homologacao`.

## Entrega

As transferências preservam nota e tags e nascem com a categoria Transferência, editável. A origem fica em Conta e o destino em Beneficiário. O destino aceita contas de saldo ativas e o aporte é identificado pela conta de investimento.

A tabela permite lançar parceladas com prévia, editar uma parcela ou a selecionada e as futuras, dividir, antecipar, mover de fatura, cancelar futuras e criar recorrente. As ações de conferência, reabertura, fechamento antecipado e pagamento também estão no menu da linha.

Faturas reabertas guardam motivo, data e histórico antes/depois, com nova conferência ao fechar. Fechamento antecipado preserva a data programada e as datas dos próximos ciclos. Pagamento parcial transporta o restante como saldo anterior sem criar gasto ou movimentação. Juros são lançados à parte em Tarifas e encargos.

O limite é opcional. Comprometido soma faturas não quitadas e parcelas, mais recorrentes ainda não reconhecidos. A previsão dos recorrentes vai até o último ciclo cadastrado, com mínimo no fim do próximo mês, e esse horizonte aparece na interface. Próximos organiza o restante do mês e o seguinte; os componentes do cartão ficam dentro das faturas para contar uma vez.

## Validação

- Build com TypeScript e Vite aprovado.
- 127 testes de API/regras/migrações aprovados, incluindo migração da base anterior, centavos, 120 parcelas, pagamentos concorrentes, bloqueios de faturas, histórico, cancelamentos e reconhecimento de recorrentes.
- 46 testes de navegador aprovados na suíte completa. Os cinco testes da Sessão J também foram repetidos após ampliar a cobertura de edição nos dois alcances e criação de recorrente pela parcela.
- Dimensões das células preservadas em repouso, hover e edição; interface usa os tokens existentes.
- Migração `0009_cartao_parcelas.sql` e seed aplicados pela integração Cloudflare em `bfo-teste` e `bfo-homologacao`. `PRAGMA foreign_key_check` sem erros nos dois bancos. Seed da Sessão J confirmado, cinco parcelas e exemplos de reabertura, fechamento antecipado, limite opcional e saldo anterior conferidos. Nenhuma operação em produção.

## O quê | Onde ver

| O quê | Onde ver |
|---|---|
| Transferência, nota, tags e aporte | https://tst-cartao-parcelas.bfo.bayara.design/transacoes/2026-11?account=seed-j-investment |
| Parcelas e menu da linha | https://tst-cartao-parcelas.bfo.bayara.design/transacoes/2026-11?account=seed-j-card |
| Compra original e antecipação | https://tst-cartao-parcelas.bfo.bayara.design/parceladas/seed-j-plan |
| Fatura reaberta e limite | https://tst-cartao-parcelas.bfo.bayara.design/cartao?account=seed-j-card&statement=seed-j-statement-2026-11 |
| Fechamento antecipado | https://tst-cartao-parcelas.bfo.bayara.design/cartao?account=seed-j-card&statement=seed-j-early |
| Pagamento parcial | https://tst-cartao-parcelas.bfo.bayara.design/cartao?account=seed-j-no-limit&statement=seed-j-partial |
| Saldo anterior, tarifas e cartão sem limite | https://tst-cartao-parcelas.bfo.bayara.design/cartao?account=seed-j-no-limit&statement=seed-j-balance |
| Próximos | https://tst-cartao-parcelas.bfo.bayara.design/proximos |

## Defeitos conhecidos

Nenhum defeito funcional conhecido ao concluir os testes locais. A navegação autenticada da prévia depende do Cloudflare Access do dono.

## Escolhas que precisam do dono

Nenhuma decisão reaberta. O horizonte de previsão dos recorrentes fica explícito para conferência na tela de Cartão.

## Passos do dono

1. Entrar na prévia pelo Cloudflare Access e conferir os exemplos da tabela.
2. Informar os ajustes ao chat de gestão, que abre o PR para `homologacao`.
