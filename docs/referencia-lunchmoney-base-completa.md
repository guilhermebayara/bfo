# Referência: base de conhecimento completa do Lunch Money

Leitura das 66 páginas do sitemap de support.lunchmoney.app, em 19/11/2026. Complementa `docs/referencia-lunchmoney.md` com o que não estava lá. Contexto, sem decisão.

## Transações

- Transação manual atualiza o saldo de conta manual. Transação ligada a recorrente fica com beneficiário e nota do recorrente e não pode ser dividida nem agrupada.
- Edição em lote: data, beneficiário, categoria, notas, moeda, conta, tags, recorrente e revisão.
- Exportação CSV do que está na tela. Link direto para uma transação.
- Busca rápida por categoria, valor ou beneficiário. Filtros avançados e ordenação.
- Remoção de duplicadas: ação pontual sobre a lista filtrada, com 2 a 4 critérios, só seleciona para revisão e nunca apaga sozinha.
- Transferência entre moedas diferentes: cada lado na moeda da sua conta, sem agrupar, porque a soma não fecha em zero.
- Sem limite de quantidade de transações. A análise busca até 20 mil.
- Mudar a categoria salva na hora.

## Orçamento (versão 2)

- Períodos próprios: semanal, quinzenal, mensal ou outro. Mudar o período apaga os orçamentos antigos.
- Orçamento por grupo de categoria opcional. Com ele ligado, a sobra passa a ser por grupo.
- Ações rápidas ao orçar: o que falta orçar, zerar o disponível, gasto atual ou anterior, orçamento anterior, média de três períodos, valor fixo, completar até um valor, total dos recorrentes previstos.
- Copiar orçamento preenche só o que está vazio, a menos que se escolha sobrescrever.
- Mover dinheiro entre categorias não muda o total disponível. Ajuste de saldo do orçamento fica com histórico.
- Notas no orçamento. Histórico de gasto por categoria com variação em relação a períodos anteriores.
- Fundo de reserva: categoria com orçamento mensal recorrente e sobra acumulando nela.
- Não existe conferência exata entre orçamento e banco.

## Início e relatórios

- Visão geral com período escolhido. A renda é definida pela marca "tratar como renda" da categoria, não pelo sinal. Os totais projetados incluem recorrentes ainda não pagos.
- Patrimônio: contas encerradas podem ser escondidas e saem dos totais. Visão por conta ou por tipo.
- Estatísticas e tendências com opção de incluir recorrentes e categorias fora dos totais. Taxa de poupança = (renda - gasto) / renda. Gasto por categoria contra o orçamento.
- Análise: tabela, pizza, barras, linhas, barras empilhadas e Sankey. Consultas salvas.
- Tags não entram em estatísticas e tendências, só na análise.

## Contas

- Conta padrão, "não acompanhar transações" e estado encerrada. Conta encerrada mantém o histórico e sai das listas de lançamento.
- Juntar duas contas, mantendo o saldo de uma delas. Ao remover, manter, reatribuir ou apagar os dados.
- Editar o saldo direto não cria transação.

## Categorias, tags e regras

- Criação de categorias em lote por texto: uma por linha, traço para subcategoria e marcas entre colchetes. Dá para exportar e importar a estrutura inteira.
- Categoria pode ser arquivada (com data), juntada a outra ou apagada. Apagar em lote não tem volta.
- Tags: nome, descrição e cor. Podem ser arquivadas e escondidas. Não recebem orçamento nem servem de condição de regra.
- Regras: condições por beneficiário, categoria, nota, faixa de valor, faixa de dia e conta. Mudar a categoria cria uma regra automaticamente, por padrão.

## Configurações

- Formato de data e hora, sugestão de beneficiário, exibição do sinal, modo escuro.
- E-mails: resumo mensal e lembretes.
- Vários orçamentos isolados na mesma assinatura (pessoal, compartilhado, empresa).
- App de celular para lançamento rápido, estatísticas e categorização deslizando.
