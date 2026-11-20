# Brief: tela inicial (regras e números)

Decidido pelo dono em 20/11/2026, para a fase 1. Motivo: no Lunch Money, a visão inicial tinha gráficos espalhados e blocos sem uso. Aqui a tela responde só a perguntas que o dono escolheu, e cada número leva às transações que o formaram.

Esta etapa constrói as regras, os números e uma página neutra simples. O arranjo (hierarquia, peso de cada bloco, gráfico ou lista) fica para o conceito visual, que vai desenhar a tela com estes números. Nas fases 2 e 3 a tela ganha blocos novos (patrimônio, orçamento); o que está aqui não é refeito.

## As quatro perguntas

### Quanto tenho disponível

Uma projeção dos próximos 30 dias, em janela que anda (no dia 28 já enxerga o salário do dia 5 e as contas antes dele).

- Ponto de partida: saldo de hoje das contas correntes e de dinheiro, só com o que tem data até hoje (mesma regra da conferência de saldo).
- Entradas previstas: recorrentes em categoria de renda com data prevista nos próximos 30 dias, que ainda não foram reconhecidos.
- Saídas previstas: faturas a pagar com vencimento na janela (inclusive pagamento agendado), recorrentes de saída pagos pela conta corrente, lançamentos e transferências com data futura que saem dessas contas. Compras e recorrentes do cartão entram pela fatura, sem contar duas vezes.
- A tela diferencia o que já entrou (o saldo de hoje) do que ainda vai entrar (renda prevista) e do que vai sair, e mostra o resultado no fim da janela.
- Mostra também o ponto mais baixo da projeção dentro da janela e a data dele, para o aperto antes do salário aparecer como um vale com a recuperação logo depois.
- Transferência entre contas que entram na projeção não muda o total. Transferência para conta de saldo (investimento, por exemplo) conta como saída.
- A renda prevista depende dos recorrentes de renda cadastrados. Sem nenhum, a tela avisa que a projeção está sem renda prevista.

### O que pede atenção

Lista curta do que precisa de ação, cada item levando ao lugar onde se resolve:

- fatura fechada ainda não conferida;
- recorrente cuja janela de reconhecimento já passou sem transação;
- assinatura dentro do prazo de aviso de renovação;
- conta de movimento sem conferência de saldo há mais tempo que o limite.

Sem nada pendente, o bloco diz que está tudo em dia.

### O que vence em breve

Próximos 7 dias de Próximos: faturas, recorrentes, parcelas e lançamentos agendados. O resto continua na tela Próximos.

### Como o mês está andando

- Gasto do mês até hoje, por grupo de categoria, comparado ao mesmo intervalo do mês anterior (do dia 1 até o mesmo dia; se o mês anterior for mais curto, até o último dia dele).
- Segue as marcas: fora dos totais e transferência ficam de fora; renda aparece separada do gasto.
- Cada grupo leva às transações dele no mês (mesma regra de "total leva às transações").
- Quando a fase 3 existir, o orçado entra como segunda comparação.

## Escolhas a confirmar no relatório da sessão

Onde este brief não diz, a sessão segue estes padrões e lista cada um como escolha a confirmar:

- A tela inicial abre em "/" e vira o primeiro item da navegação.
- Conta sem conferência entra em "pede atenção" depois de 30 dias da última conferência.
- Recorrente de renda que ainda não veio, mas está dentro da janela de sete dias, continua contando como previsto; depois da janela, sai da projeção e vai para "pede atenção".
- Contas em moeda estrangeira entram convertidas pela última cotação conhecida.

## Testes

- Dinheiro com números, com relógio fixo: projeção com salário depois de uma conta (o ponto mais baixo cai antes do salário, com data certa); virada de mês dentro da janela; fatura com pagamento agendado; compra no cartão contada só pela fatura; transferência entre contas que não muda o total.
- Cada total da tela igual à soma das linhas para onde ele leva.
- Comparação do mês num dia 31 contra um mês anterior de 30 dias.
