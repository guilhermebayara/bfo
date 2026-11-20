# Brief: ferramentas de uso diário

Decidido pelo dono em 20/11/2026, para a fase 1. Vêm da lista de ideias de docs/a-construir.md e respondem a uma dor da pesquisa com o dono: não achar onde o dinheiro está vazando num mês apertado. Constrói em paralelo à QA complementar (Sessão N). As regras do resto do app continuam valendo, em especial transferência neutra, fora dos totais, data futura e as travas das importadas.

## Total leva às transações

- Todo total clicável abre Transações já filtrada com as linhas que formaram aquele número: renda, despesa, grupo e categoria no resumo lateral do mês; total da fatura e compras do ciclo no Cartão; saldo da conta em Contas; itens de Próximos que vêm de transações.
- Os filtros ficam no endereço, como o mês (ex.: /transacoes/2026-11?categoria=...&conta=...), para voltar e compartilhar. Filtro novo que não existe hoje (por exemplo, por fatura) entra junto.
- A soma das linhas filtradas bate com o total clicado. Onde não bater por regra (transferência, fora dos totais, data futura), a tela diz por quê.

## Saldo corrido por conta

- Com Transações filtrada por uma conta só, aparece uma coluna com o saldo da conta depois de cada linha, em ordem de data.
- Serve à conferência de saldo: o saldo da última linha até hoje bate com o saldo da conta em Contas.

## Filtro de privacidade

- Um botão e um atalho de teclado escondem os valores em todas as telas, inclusive totais, saldos, gráficos e o aviso de transação. O que não é valor (nomes, datas, categorias) continua visível.
- Começa desligado. A escolha fica guardada no navegador.

## Exportação em CSV

- Baixa as transações do que está filtrado na tela de Transações, no período escolhido.
- Abre direto no Excel e no Numbers em português: separador ponto e vírgula, vírgula decimal, UTF-8 com BOM, datas em dd/mm/aaaa.

## Escolhas a confirmar no relatório da sessão

Onde este brief não diz, a sessão segue estes padrões e lista cada um como escolha a confirmar:

- Saldo corrido só aparece com filtro de uma conta e sem outros filtros, porque com filtro de categoria ou busca o saldo de cada linha engana. Linhas com data futura mostram o saldo previsto, marcado como previsto.
- No cartão, o saldo corrido mostra o devido acumulado, com a mesma regra do saldo em Contas.
- Atalho do filtro de privacidade: Cmd+Shift+H (Ctrl+Shift+H fora do Mac). Valores escondidos aparecem como "R$ ••••".
- CSV: uma linha por transação, com o valor total; transação dividida ganha uma coluna dizendo "dividida", e as partes não viram linhas. Transferência entra uma vez, com origem e destino. Colunas: data, conta, beneficiário, categoria, grupo, valor original, moeda, valor em reais, notas, tags, origem.

## Testes

- Dinheiro com números: total clicado igual à soma das linhas filtradas, em pelo menos três totais diferentes; saldo corrido da última linha até hoje igual ao saldo em Contas, inclusive com lançamento de data futura e transferência.
- Navegador com relógio fixo: clique num total abre o filtro certo e o endereço guarda o filtro; filtro de privacidade esconde valores em Transações, Contas e Cartão e sobrevive ao recarregar; CSV baixado tem o cabeçalho e uma linha conferida campo a campo.
