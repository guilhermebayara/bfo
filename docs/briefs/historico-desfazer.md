# Brief: histórico de alterações, desfazer e aviso de transação

Decidido pelo dono em 20/11/2026, na triagem da QA da fase 1. Constrói depois da Sessão Q, porque mexe na tabela de Transações. As regras do resto do app continuam valendo, em especial as travas das importadas e das faturas fechadas.

## Por quê

A planilha salva sozinha. Hoje, um valor digitado errado só volta se o dono lembrar o valor antigo e editar de novo. Num app de dinheiro usado todo dia, isso pesa na confiança do lançamento. O histórico também ajuda a investigar divergência de fatura.

## Histórico de alterações

- Toda criação, edição e exclusão de transação fica registrada: o campo, o valor antes, o valor depois, a data e a hora e de onde veio a ação (célula da tabela, edição em lote, conferência, divisão, parcelas, importação).
- A exclusão guarda a transação inteira, com partes da divisão e tags, para poder voltar.
- O histórico abre pela transação, no menu "..." da linha.
- Dá para voltar qualquer campo a um valor anterior a partir do histórico. Isso é uma edição nova, que também entra no histórico.
- Ações que geram várias transações (parcelada, antecipação, transferência, pagamento de fatura) ficam agrupadas como uma ação só.

## Desfazer

- Cmd+Z (Ctrl+Z fora do Mac) desfaz a última ação da sessão, em pilha: edição de célula, edição em lote, criação e exclusão.
- Desfazer recalcula tudo que depende da transação na hora (saldos, faturas, resumos, Próximos), como qualquer edição.
- Desfazer respeita as mesmas travas da edição. Valor e data de importadas não voltam por aqui, porque nunca mudam.
- Desfazer também entra no histórico.

## Aviso de transação

- Ao adicionar, editar ou excluir uma transação, aparece um aviso que diz o que mudou e o novo saldo da conta afetada. Referência: o aviso do Lunch Money ("o saldo da conta foi atualizado para R$ ..."), enviado pelo dono em 20/11.
- Edição em lote mostra um aviso só, com a quantidade de transações e as contas afetadas.
- O dono pediu para considerar um botão de desfazer no próprio aviso. A sessão constrói e mostra na prévia para ele confirmar.
- O aviso usa os componentes e tokens das fundações (`/fundacoes`), sem identidade visual nova.

## Escolhas a confirmar no relatório da sessão

Onde este brief não diz, a sessão segue estes padrões e lista cada um como escolha a confirmar:

- Cmd+Shift+Z refaz o que foi desfeito.
- A pilha de desfazer vale enquanto a página estiver aberta. Depois de recarregar, sobra o histórico.
- Desfazer uma ação que mexe numa fatura fechada pede para reabrir a fatura antes, com a mesma regra da edição.
- O aviso some sozinho depois de alguns segundos e fica parado enquanto o mouse estiver em cima.

## Testes

- Dinheiro com números: saldo antes, depois da edição e depois de desfazer; fatura e Próximos recalculados; exclusão desfeita volta com divisão e tags.
- Travas: importada e fatura fechada.
- Navegador com relógio fixo: Cmd+Z na célula, histórico pelo menu da linha, aviso com o saldo novo.
