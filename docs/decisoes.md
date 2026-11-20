# Decisões

Registro do que foi decidido pelo dono. Exemplos com nomes de bancos e valores são ilustrativos.

## Produto

- Princípio: as decisões de produto não fixam forma nem posição de elementos de interface quando isso não for necessário. Layout fica livre para o conceito visual.

- BFO (Bayara Family Office) é a versão própria do Lunch Money: transações, contas, recorrentes, orçamento, patrimônio líquido ao longo do tempo, dívidas, imóvel, investimentos e categorias agrupadas.
- O dono só passa a usar de verdade quando as três fases estiverem prontas. As fases são rodadas de teste e ajuste: cada uma fica redonda antes de construir a que depende dela.
- Web, desktop primeiro. App nativo é possibilidade para o futuro.
- Estrutura antes do visual. A primeira etapa acerta a estrutura, a interface funcional e as hierarquias, com visual neutro. O conceito visual vem depois, numa etapa própria, com duas propostas para o dono escolher.

## Importação e os dois momentos

- O histórico vem do Lunch Money pela API v2, por um script rodado na máquina do dono. O token ele digita na hora. O arquivo gerado nunca entra no repositório.
- Na API v2, valor positivo é sempre débito e valor negativo é sempre crédito, independente da configuração do usuário no Lunch Money.
- Cada conta tem dois momentos: arquivo (importado) e daqui pra frente (lançamento manual).
- Cada conta tem a própria data de corte e um saldo de abertura nessa data, conferido com o extrato. As contas são ativadas uma a uma.
- A diferença entre o saldo do arquivo e o saldo de abertura aparece como um ajuste visível na conta.
- Transação importada: valor total e data ficam travados. A classificação pode ser editada: categoria, nota, tags e divisão em partes (a soma das partes sempre igual ao valor original). Decidido em 19/11/2026, resolvendo a ambiguidade levantada na Sessão G.
- Valores com mais de duas casas decimais (comum em conversão de moeda) são arredondados para o centavo mais próximo. Se isso mudar a soma da conta, a diferença aparece no ajuste visível da data de corte. Decidido em 19/11/2026.
- Transação marcada como pendente no Lunch Money (`is_pending`) entra como transação normal, com a nota "pendente no Lunch Money". O relatório da importação informa quantas vieram assim. Transações `delete_pending` ficam de fora. Decidido em 19/11/2026.
- Grupos de categoria importados entram numa alocação temporária "Importado", com 0%, porque o Lunch Money não tem grupos de alocação. No dia da importação real, o dono move cada grupo para a alocação certa em Categorias. Decidido em 20/11/2026.
- Durante as fases, a importação precisa poder ser apagada e refeita. A importação definitiva e as datas de corte acontecem quando o dono começar a usar.
- Faturas no arquivo: o período importado fica sem faturas. Compras e pagamentos de cartão antigos entram como transações e transferências comuns. As faturas de cada cartão começam na data de corte dele.
- Grupos do Lunch Money que não são transferência nem pagamento de fatura: cada transação do grupo entra separada, com uma nota indicando o grupo de origem.
- Recorrentes do Lunch Money: os ativos entram como recorrentes, com as transações passadas ligadas a eles pelo `recurring_id`. Marca de assinatura e tipo o dono aplica depois.
- Histórico de saldos e de orçamento: importados já na sessão de importação e guardados para as fases 2 e 3, para o token ser usado uma vez só.
- Dados de teste: as sessões usam dados fictícios do repositório (seed). Na homologação, o dono roda a importação real.

## Contas

- Instituição é o primeiro nível. Cada conta pertence a uma instituição, e o tipo (corrente, cartão, investimento, empréstimo) fica na conta. A tela de Contas agrupa por instituição, com subtotal, e tem alternância para agrupar por tipo.
- Toda conta criada à mão nasce ativa. Só as contas importadas do Lunch Money começam como "só arquivo", e são ativadas no dia em que o dono começar a usar o BFO. A tela explica esse estado.
- "Atualizado em" é a data da última conferência de saldo. A ação "Conferir saldo" funciona como a conferência da fatura: o dono digita o saldo do banco, vê a diferença e escolhe procurar o que faltou ou lançar um ajuste.
- Saldo do cartão na tela de Contas: o que já foi lançado até hoje e ainda não foi pago. Parcelas futuras ficam fora do saldo e aparecem no comprometido do cartão. Decidido em 20/11/2026, depois da QA da fase 1.
- Conta encerrada sai da lista principal e dos filtros e vai para uma seção recolhida "Encerradas" no fim da tela. O histórico continua nas transações e no patrimônio.

- Contas de movimento (corrente, cartão) vivem de transações.
- Contas de saldo (imóvel, investimentos, empréstimos) recebem uma atualização mensal com o valor do momento.
- Patrimônio líquido ao longo do tempo é a soma das duas no fim de cada mês.
- Investimentos: uma conta por corretora, com saldo separado por tipo (renda variável, renda fixa, fundos). Atualização mensal numa tela só. Sem acompanhar ativo individual.
- Aporte e rendimento separados. Aporte vem das transferências lançadas da conta corrente para a conta de investimento. Rendimento é a variação do saldo menos os aportes do mês.
- Empréstimos: saldo devedor atualizado no mês. A parcela entra como recorrente na conta corrente.

## Tabela de transações

- Transações é o painel de gestão: tudo que mexe em dinheiro pode ser registrado ali. As outras telas (Cartão, Contas, Recorrentes) servem para ver e conferir e podem ter as mesmas ações, mas nenhuma ação é exclusiva delas.
- Como cada tipo entra pela tabela:
  - Despesa e receita: linha normal, sinal automático pela categoria.
  - Transferência: "Nova transferência" na seta do botão de adicionar, com conta de origem e de destino lado a lado, data e valor. Nota e tags funcionam como em qualquer lançamento. A categoria nasce como Transferência (fora dos totais) e pode ser trocada. O destino pode ser qualquer conta ativa, inclusive as contas de saldo, porque o aporte em investimento é uma transferência para a conta de investimento e é reconhecido pelo destino, sem categoria própria. Decidido em 19/11/2026.
  - Pagamento de fatura: transferência cujo destino é um cartão. A linha vira pagamento de fatura sozinha e pergunta qual fatura, sugerindo a mais antiga em aberto. Aceita pagamento parcial.
  - Compra parcelada: quando a conta da linha é um cartão, aparece a célula de parcelas (1x por padrão). Acima de 1x surge "parcela atual" (retroativa) e a prévia das parcelas.
  - Ações sobre transação existente no menu "..." da linha: dividir, antecipar, mover de fatura, cancelar parcelas futuras, criar recorrente.
  - Ajustes de conferência nascem na conferência de saldo ou de fatura e aparecem na tabela como linhas de ajuste.

- A tabela de Transações funciona como uma planilha. Toda célula visível é editável com um clique, salva sozinha e atualiza na hora tudo que depende dela (saldos, faturas, resumos). Teclado como numa planilha: Enter e Tab salvam e avançam, Esc cancela, setas movem entre células. Campos travados das importadas ficam visivelmente não editáveis.
- A célula tem o mesmo tamanho em repouso, ao passar o mouse e em edição, como no Lunch Money: o campo de edição ocupa exatamente a célula, sem crescer nem encolher. Vale também para a linha de lançamento novo.
- Isso é comportamento da interface e vale desde já, antes do conceito visual.
- Campo de valor com um botão de sinal ao lado: [-] para saída e [+] para entrada. O valor é digitado sempre sem sinal. O sinal muda sozinho conforme a categoria (categoria de renda deixa [+], as demais deixam [-]) e o dono pode inverter com um clique.
- Transferência entre contas aparece como uma linha só: a coluna Conta mostra a origem e a coluna Beneficiário mostra o destino ("→ Conta B"), nas mesmas posições da linha de lançamento novo. Decidido em 19/11/2026, substituindo "Conta A → Conta B" na coluna da conta, que cortava o texto. O valor movido aparece em cor neutra, sem sinal de gasto ou renda. Com filtro por uma das contas, a linha mostra o sinal do ponto de vista dela (saída na origem, entrada no destino). Sem a soma zerada do Lunch Money.
- Seleção múltipla abre um painel com total e média dos selecionados, edição em lote (data, beneficiário, categoria, nota, adicionar e remover tags, ligar a um recorrente) e exclusão em lote. Importadas selecionadas aceitam só a classificação. Ficam de fora: marcar como revisado (tudo é lançado pelo dono), trocar moeda e mover de conta em lote.
- Lançamento manual aceita data futura (ex.: boleto agendado). Ele entra no saldo da conta só quando a data chegar e, até lá, aparece em Próximos. Decidido em 20/11/2026, depois que a QA encontrou no código um bloqueio de data futura que não tinha sido decidido.
- Histórico de alterações com desfazer. Cada transação guarda o que mudou e quando, inclusive criação e exclusão. Cmd+Z desfaz a última ação da sessão, e o histórico permite voltar qualquer campo a um valor anterior. Decidido em 20/11/2026, na triagem da QA. Detalhe em docs/briefs/historico-desfazer.md.
- Aviso ao adicionar, editar ou excluir uma transação, como no Lunch Money: diz o que mudou e o novo saldo da conta afetada. O dono pediu para considerar um botão de desfazer no próprio aviso. Decidido em 20/11/2026.
- Novo lançamento entra como uma linha extra no topo da tabela. O botão de adicionar já traz a conta padrão do dono (definida nas configurações) e tem uma seta para escolher outra.
- A lista de contas dessa seta mostra só contas de movimento, agrupadas por tipo (cartões, contas correntes, dinheiro), com a instituição em cada uma e em ordem alfabética dentro do grupo. Contas de saldo (investimento, imóvel, empréstimo) e contas encerradas ficam de fora, porque não recebem lançamentos.

## Moedas

- Configurações: moeda principal (padrão de contas novas e base dos totais, BRL) e lista de moedas em uso. As listas de moeda do app mostram só as moedas em uso.

- Cada conta tem a sua moeda. Cada lançamento guarda o valor original, a moeda e o valor em reais.
- A cotação é buscada sozinha na data do lançamento, pela PTAX do Banco Central. O dono pode corrigir quando o banco tiver usado outra cotação.
- Orçamento, categorias e relatórios usam o valor em reais.
- No patrimônio, o saldo de conta em moeda estrangeira é convertido pela cotação do último dia de cada mês.

## Tags e beneficiários

- Tags continuam: nome e cor, várias por transação, filtro em Transações. São importadas do Lunch Money. A tag "Pagamento de fatura" do Lunch Money vira o tipo próprio de lançamento na importação.
- Sem regras automáticas. No lugar, ao digitar o beneficiário, o app sugere a categoria e as tags usadas da última vez com ele.
- Tela de beneficiários para unificar nomes repetidos em lote.
- O beneficiário pode ter categoria e tags padrão. Quando houver, a sugestão usa o padrão no lugar da última vez; continua sendo sugestão visível, editável antes de salvar. Motor de regras segue fora. Se um dia existir a importação de extrato (OFX ou CSV), regras podem vir junto, só como regras de importação aplicadas na tela de revisão, com prévia antes de salvar. Decidido em 20/11/2026.

## Cartão e fatura

- Fatura é uma entidade: fechamento, vencimento, compras do ciclo, estado (aberta, fechada, paga).
- Pagar fatura é um tipo próprio de lançamento. Sai da corrente, abate o cartão, nunca entra no orçamento e aparece como uma linha só (ex.: "Fatura Cartão X novembro").
- Conferência: ao fechar a fatura, o dono digita o valor do banco. O app compara com a soma lançada e mostra a diferença. Ele escolhe procurar a compra que faltou ou fechar com um ajuste. O app guarda o histórico de divergência por fatura.
- O ajuste de fatura conta como gasto, na categoria própria "Diferença de fatura".
- Compra parcelada: lançada uma vez, com valor total e número de parcelas. O app gera as parcelas, cada uma ligada à fatura do seu mês.

- Parcelada retroativa: ao lançar uma compra que já começou (ex.: 3/10), o dono informa valor da parcela, total de parcelas e parcela atual. O app cria todas as parcelas, cada uma na fatura do seu mês, incluindo as que já passaram. Motivo: serve no dia da virada e também depois, quando uma compra ficar sem lançar por um tempo.
- Parcelas retroativas que caem antes da data de corte da conta ficam marcadas como retroativas, porque os meses entre o fim do Lunch Money e o início do BFO não são fidedignos. Parcela retroativa que cai numa fatura já fechada entra na fatura, aparece marcada e a conferência daquela fatura é recalculada.
- A quantidade é sempre em número de parcelas, nunca em meses.
- Antecipação no cartão: ação na compra parcelada. O dono escolhe quantas parcelas antecipa, o app mostra o valor cheio e ele digita o valor cobrado pelo banco. Entra uma linha só na fatura atual com o valor pago, as parcelas antecipadas saem dos meses seguintes e o desconto fica no histórico da compra, reduzindo o custo real dela.
- Editar parcela: escolher entre "só esta" e "esta e as futuras". Cancelar as parcelas futuras de uma compra (ex.: devolução). Mover uma compra para a fatura anterior ou seguinte.
- Reabrir fatura fechada, registrando o motivo e a data. Ao fechar de novo, a conferência é refeita. O histórico mostra o que mudou.
- Antecipar o fechamento da fatura (como o "vira fatura" do Itaú): o dono escolhe a data de fechamento antecipado; compras depois dela vão para a próxima fatura, e as datas de fechamento e vencimento dos ciclos seguintes não mudam.
- Pagamento parcial de fatura: o restante aparece como "saldo anterior" na fatura seguinte. Juros e encargos do banco entram como lançamento próprio, na categoria de tarifas.
- Limite do cartão: campo opcional no cartão. A tela de Cartão mostra o limite, quanto das próximas faturas já está comprometido (parcelas e recorrentes) e o limite disponível. Cartão sem limite definido (ex.: alguns Amex) mostra só o comprometido, sem limite nem disponível.
- Painel "Próximos" já na fase 1: o que vence no resto do mês e no mês seguinte, juntando recorrentes, parcelas e faturas.
- Antecipação de parcelas que foram reclassificadas: a linha da antecipação sai dividida automaticamente, cada parte com a classificação da sua parcela.
- Antecipação de empréstimo (fase 2): o pagamento sai da corrente, o saldo devedor cai pelo valor cheio das parcelas antecipadas e o desconto fica registrado no empréstimo.

## Divisão de transação

- Uma transação pode ser dividida em partes, cada uma com categoria e tags próprias, por valor ou por percentual. O app mostra quanto falta dividir e só salva com a soma fechada. Desfazer a divisão volta a uma transação só.
- Sem "dividir ao longo do tempo": o parcelamento por número de parcelas cobre isso.

## Categorias e orçamento

- Cada categoria tem três marcas, como no Lunch Money: tratar como renda, fora do orçamento e fora dos totais. Marcas definidas no grupo de categoria valem para as categorias dele (herdadas), e a tela mostra quando uma marca é herdada.
- Tratar como renda: entra no total de renda dos resumos, e o sinal padrão do lançamento é [+].
- Fora do orçamento: a categoria não aparece no orçamento nem na alocação por percentual (ex.: emergências, reembolsos).
- Fora dos totais: a transação atualiza os saldos das contas, mas não entra nos totais de renda nem de gasto do mês (ex.: reembolsos, saques, pagamentos e transferências). Reembolso usa uma categoria com essa marca.

- Duas camadas. Grupos de categoria organizam (Moradia, Alimentação). Grupos de alocação dizem o tipo de dinheiro (Essencial, Estilo de vida, Investimento), cada um com percentual previsto (ex.: 60 / 25 / 15). Cada grupo de categoria pertence a um grupo de alocação.
- Base do percentual: renda prevista do mês, informada ao montar o orçamento, comparada depois com a renda que entrou.
- Investimento na alocação conta só os aportes. Rendimento fica fora. Investimento fica fora do orçamento de gastos.
- Orçamento pode ser preenchido por categoria (o grupo é a soma) ou por grupo, distribuindo depois entre as categorias.
- Tela de orçamento por grupo de alocação: percentual previsto, valor distribuído nas categorias, valor realizado. Avisa quando as categorias passam do percentual do grupo.
- Período do orçamento: mês do calendário.
- Sobra: cada mês começa do zero. Categorias marcadas como reserva acumulam a sobra para os meses seguintes (ex.: IPVA, viagens, presentes de fim de ano).
- Ajudas ao preencher: copiar do mês anterior, média dos últimos 3 meses e total dos recorrentes previstos na categoria.
- Percentuais de alocação: padrão nas configurações, ajustável num mês específico.
- Gasto no cartão entra no orçamento no mês da compra.
- Exceção: parcela entra no orçamento no mês da fatura dela.
- Parcelas futuras aparecem como valor já comprometido no orçamento de cada mês seguinte, antes da distribuição do resto.

## Resumo lateral do mês

- Transações tem um resumo lateral do mês: renda e despesas por grupo e categoria, com barra por categoria, como no Lunch Money.
- Com orçamento (fase 3), no mês corrente a barra mostra uma marca de ritmo: onde o gasto deveria estar naquele dia do mês. Passar da marca é um sinal visual leve de que o mês está no ritmo de estourar.
- Cálculo da marca de ritmo: nas categorias com recorrentes, cada conta fixa entra na marca no dia previsto dela. O resto do orçado da categoria segue uma linha reta ao longo do mês. Assim, o aluguel pago no dia 5 não vira alerta.
- Gastar exatamente o orçado conta como dentro do orçamento, sem cor de alerta. O dono acha o amarelo do Lunch Money ambíguo justamente por isso. As cores em si ficam para o conceito visual.

## Recorrentes e assinaturas

- Janela de reconhecimento do recorrente: 7 dias antes ou depois da data prevista. Conta no mês previsto mesmo quando a transação cai no mês seguinte. A regra fica visível no recorrente (ex.: "reconhece de 28/11 a 12/12").

- Recorrente é reconhecido pela conta, pelo beneficiário e pela data próxima. O valor pode variar (ex.: conta de luz), sem faixa de valor para configurar.

- Assinatura é uma marca aplicável a qualquer recorrente. A categoria do item continua a dele. Não existe categoria de assinatura.
- Tipo de assinatura: lista que o dono cria e edita (ex.: Essencial e as demais). A tela de assinaturas agrupa por tipo e também por grupo de alocação.
- Tela de assinaturas: valor, próxima cobrança, conta ou cartão onde cai, total por tipo.
- Assinatura anual: no planejamento e no orçamento conta no mês da cobrança. A tela de assinaturas mostra também o equivalente mensal, como informação.
- A assinatura guarda data de renovação e um prazo de aviso próprio, com 30 dias como padrão. Aviso dentro do app, numa faixa no topo enquanto a renovação estiver próxima. Sem e-mail.

## Fases

1. Movimento: contas de movimento, lançamento manual, lista de transações, marco e ajuste por conta, recorrentes, grupos de categoria, cartão com fatura, parceladas, conferência de fatura, assinaturas, importação.
2. Patrimônio: contas de saldo, investimentos por tipo, aporte e rendimento, empréstimos, patrimônio líquido ao longo do tempo.
3. Orçamento: orçamento por categoria e por grupo, alocação por percentual, parcelas comprometidas.

## Infraestrutura

- Cloudflare, conta BFO, dentro do login do dono. D1. Access fechado no e-mail do dono.
- Homologação em homologacao.bfo.bayara.design, como prévia da branch homologacao.
- Produção em bfo.bayara.design. O domínio está sendo transferido para a Cloudflare e vai ficar na conta BFO.
- Backup automático diário dos bancos com dados reais num bucket R2 da conta BFO, guardando os últimos 30 dias, com restauração testada. Decidido em 20/11/2026, na triagem da QA.
- Repositório público por enquanto, só com dados fictícios. Vira privado quando o token do Lunch Money entrar em uso.
