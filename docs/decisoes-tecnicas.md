# Decisões técnicas

## Sessão A

### Execução e ambientes

Node.js 24 é a versão de desenvolvimento. O lockfile do npm fixa a árvore de dependências. O front é compilado pelo Vite em `dist/`. O mesmo Worker Hono serve `/api/*` e os assets com fallback para a aplicação React, permitindo acesso direto a `/transacoes` e `/contas`.

`wrangler.jsonc` exige ambiente explícito nas operações documentadas. `homologacao` usa `bfo-homologacao` e o D1 de homologação informado pelo dono; `producao` usa `bfo-producao` e o seu D1. Binding `DB` em ambos. Produção fica sem workers.dev nem prévias nesta etapa. Não há criação automática de D1. Os comandos de seed têm homologação fixa no código e recusam outros argumentos; não existe script de seed de produção.

### Valores, sinal e corte

A API recebe números inteiros seguros em centavos. O banco aplica restrições de tipo inteiro e limite seguro nos campos monetários. O campo de valor aceita reais com vírgula, sem separador de milhar, e converte para centavos sem multiplicar uma fração decimal. Datas são dias de calendário no formato `AAAA-MM-DD`, sem conversão de fuso na apresentação.

Antes da ativação, o saldo do arquivo é o negativo da soma dos lançamentos da conta. Saída positiva reduz o saldo; entrada negativa aumenta. A prévia considera todos os lançamentos até o final do dia de corte, inclusive. Depois da ativação, o saldo é a abertura informada menos a soma dos lançamentos com data estritamente posterior ao corte. Cartões podem ter saldo negativo.

O ajuste tem valor `saldo do arquivo no corte - abertura informada`. Fica no próprio dia de corte e não entra novamente no saldo posterior. Mesmo diferença zero gera um registro de ajuste, documentando a ativação. Um vínculo único `activation_account_id` identifica esse registro sem impedir ajustes de fatura futuros. Inserção do ajuste e atualização da conta acontecem em um batch transacional do D1, com condição de conta ainda inativa. A diferença é recalculada dentro da escrita. Duas confirmações não criam duas ativações. Reabrir ou alterar o corte fica fora desta sessão.

### Edição e consultas

A rota de edição aceita exclusivamente `category_id` e `note` nesta sessão, inclusive para lançamentos manuais e ajustes. Categoria pode ser removida; nota tem limite de 2.000 caracteres. Campos desconhecidos são recusados antes de qualquer escrita. Um trigger também protege todos os demais campos de transações importadas no banco. A importação poderá ser apagada na sessão E; o trigger não impede exclusão.

Filtros são combinados na API com parâmetros SQL vinculados. A lista tem páginas de 50 linhas, ordenação estável por data decrescente e ID. O estado de carregamento impede edição de linhas de uma consulta anterior enquanto novos filtros são aplicados. A edição inline usa botão explícito de salvar e apresenta sucesso ou erro junto ao campo.

A API exige JSON nas escritas, rejeita `Origin` diferente do host da requisição e desativa cache das respostas. A autenticação de homologação será feita pelo Cloudflare Access, abrangendo também `/api/*` e hosts de prévia. O código não substitui a configuração do Access pelo dono.

### Dados fictícios e validação

O seed cobre setembro/2025 a outubro/2026, com os primeiros sete meses importados. Contém corrente, dois cartões e carteira, grupos e categorias, assinaturas mensais e anual, recorrente de aluguel e parcelamento de 12 meses iniciado em junho/2026, com parcelas futuras até maio/2027. A fatura de outubro/2026 do Cartão Aurora tem diferença fictícia de R$ 14,20. As contas começam no estado de arquivo para exercitar a ativação.

IDs estáveis e inserções com conflito ignorado permitem repetir o seed sem duplicar dados ou apagar categoria, nota e ativação já editadas. Não há comando de limpeza remota nesta sessão.

Testes de modelo e API rodam em Workers com D1 local isolado pelo plugin oficial da Cloudflare para Vitest. Playwright prepara outro D1 em `.wrangler/e2e`, sobe o Worker com os assets reais e verifica filtros, paginação, edição persistida, ativação com prévia, ajuste visível e adaptação à tela pequena. A aplicação local usa apenas os dados fictícios do seed.

### Interface provisória

Uma família tipográfica de sistema, fundo escuro e tokens CSS centralizados. Componentes compartilhados concentram os controles para facilitar a etapa de conceito visual. Entrada e saída têm rótulos e sinais além de cor. O modal usa `dialog`, com foco e cancelamento por Escape. Seções futuras ficam desativadas e identificadas como “Em breve”. O espaço superior reserva a faixa de avisos sem simular alertas de renovação ainda não implementados.

## Sessão B

### Organização e modelo

`main.tsx` fica restrito à montagem do React e aos estilos. `App.tsx` concentra navegação e dados compartilhados, `screens/` contém as telas e `components/` os controles e formulários. Tokens CSS continuam centralizados e o visual permanece provisório.

A migração `0002_session_b.sql` reconstrói `accounts` para remover a restrição original a BRL, mantendo IDs, referências, campos e saldos. A suspensão temporária das verificações de chaves estrangeiras é encerrada após restaurar a tabela com o nome original. O teste de atualização parte da migração inicial com dados e verifica `foreign_key_check`. Nenhuma alteração na migração inicial. As tags da página de transações são agregadas na própria consulta SQL, mantendo duas consultas D1 por página, independentemente do número de linhas.

Campos novos de transações são preenchidos para o histórico BRL existente com cotação 1 e valor em reais igual ao original. O trigger de proteção das importadas passa a cobrir os campos novos. Beneficiários anteriores ganham registros e vínculos na migração. `archived` é preservado por compatibilidade; contas arquivadas existentes recebem `closed_at`.

### Lançamento, sugestões e unificação

O lançamento recebe valor inteiro seguro na moeda da conta, direção expressa pelo sinal, beneficiário, categoria opcional, nota e várias tags. A moeda vem da conta, não do cliente. Conta encerrada ou ainda em arquivo não aceita lançamento. O formulário usa categorias em `optgroup`, com grupo de categoria acima das opções.

A sugestão usa a última transação do beneficiário, por data decrescente, criação e ID como desempate. Ignora ajustes. Nomes são comparados sem distinção entre maiúsculas e minúsculas, com espaços nas pontas removidos na entrada. A categoria e as tags sugeridas continuam editáveis no formulário; nenhuma regra automática é criada.

Unificar nomes preenche `payees.merged_into_id` e redireciona aliases anteriores para o destino canônico no mesmo batch. Transações importadas mantêm tanto o texto quanto o vínculo originais; consultas e sugestões resolvem o nome canônico. A tela de beneficiários agrega quantidade e período do histórico conjunto. Novos lançamentos que usam um alias recebem o vínculo canônico. Não há exclusão do histórico nem alteração de valores por essa operação.

### Moedas e PTAX

A consulta usa a API pública PTAX do Banco Central, serviço `CotacaoMoedaPeriodo`, cotação de venda e boletim de fechamento. Busca o último fechamento até a data informada, numa janela de dez dias anteriores, cobrindo fins de semana e feriados usuais. Ausência de boletim, falha HTTP ou timeout de oito segundos devolvem orientação para cotação manual. A transação continua possível com a cotação informada pelo usuário.

`fx_rates` armazena o resultado por moeda e data solicitada. Valores manuais e os valores ilustrativos do seed não entram no cache PTAX. O Worker busca ou reutiliza a cotação automática no momento da gravação; não confia em uma indicação de fonte enviada pelo navegador. Uma correção do campo torna a cotação manual. BRL usa 1. `amount_brl_cents` é arredondado para o centavo mais próximo, com o mesmo tratamento para entrada e saída, validando limite inteiro seguro após conversão.

Contas mostram o saldo na moeda original e uma equivalência em reais pela PTAX disponível na data atual. O subtotal usa reais somente se todas as cotações necessárias estiverem disponíveis; caso contrário informa indisponibilidade, sem somar moedas diferentes. Essa equivalência não implementa o histórico mensal do patrimônio, previsto para a fase 2. Datas futuras não entram no saldo corrente, evitando contabilizar antecipadamente parcelas futuras do seed.

### Contas e conferência

Conta manual nasce ativa, com corte no dia anterior à criação. O saldo inicial representa o fechamento de ontem; lançamentos de hoje entram sobre essa base. A regra de corte permanece explícita no formulário. A ativação das importadas segue a regra da sessão A e passa a converter o ajuste em reais para contas estrangeiras, com PTAX ou fallback manual.

A conferência é do saldo corrente na data atual. A primeira chamada é uma prévia sem gravação. A confirmação envia o saldo do app visto na prévia; tanto a leitura quanto a escrita transacional conferem esse valor. Uma alteração intermediária exige nova conferência. O batch cria `reconciliations`, registra a diferença como transação `adjustment`, vincula o ajuste e atualiza `last_reconciled_at`. Diferença zero registra a conferência sem criar lançamento. Uma falha reverte todo o batch.

Contas encerradas aparecem somente no bloco recolhido ao final de Contas. Não entram nas opções de filtros nem no lançamento manual, mas seu histórico continua visível na consulta geral de transações. O endpoint de opções também as exclui.

### Prévia e validação

`preview:homologacao` usa `wrangler preview --env homologacao`. O bloco `previews` declara o D1 de homologação explicitamente; todos os testes usam D1 local isolado. Publicação remota, migração e seed remotos continuam dependendo do login do dono e dos passos em `docs/cloudflare.md`.

Os testes cobrem sugestão por beneficiário, cache PTAX, arredondamento e fallback manual, conferência com ajuste e rollback, conta encerrada fora das opções, unificação com preservação do registro importado e atualização de uma base da sessão A. Testes de navegador exercitam o fluxo manual com tags e moeda estrangeira, agrupamento e conferência, configuração e unificação de beneficiários. Chamadas externas controladas nos testes não comprovam acesso ao serviço PTAX real.

## Sessão E: meses, recorrentes e assinaturas

Transações usa `/transacoes/AAAA-MM`. Entradas sem mês são substituídas no histórico do navegador pelo mês atual em São Paulo. A API intersecta `month` com os filtros de período, conta, categoria, origem e tags. Setas preservam os filtros e reiniciam a paginação.

A primeira linha da tabela contém o formulário completo. Enter envia, mantém conta e data e limpa os campos do lançamento anterior. O foco volta ao beneficiário. A busca de categorias preserva os grupos. A edição acontece nas células da linha. Transações manuais comuns aceitam data, conta, beneficiário, valor, câmbio, tags, categoria e nota. Importadas aceitam somente categoria e nota. Parcelas e ajustes mantêm seus vínculos de sistema e permitem categoria e nota, com as categorias protegidas da sessão D preservadas. Dados financeiros de compras em faturas fechadas ficam protegidos também por trigger. Mudar conta ou data de compra numa fatura aberta recalcula o ciclo e a moeda.

`next_date` é a âncora inicial do calendário da recorrente. Não é avançada ao consultar ou reconhecer um lançamento, preservando a previsão de meses anteriores. Mensais e anuais mantêm o dia original, limitado ao último dia de meses menores. Semanal usa sete dias; personalizada usa `interval_days`. O modo de todos os cadastros permite editar também inativos e cobranças fora do mês selecionado.

Para o estado no mês, a consulta considera transações comuns, sem ajustes, na mesma conta e com o mesmo beneficiário, sem distinguir maiúsculas e minúsculas. Valores podem variar, mas a direção precisa coincidir. Cada transação atende uma ocorrência, pela proximidade da data prevista. Criar a partir de uma transação guarda o vínculo em `recurring_sources`, sem alterar uma importada. Esse vínculo tem preferência sobre a comparação do nome. O resumo separa entradas e saídas, esperado e realizado, por moeda, sem somar moedas distintas. O reconhecimento apenas informa o estado, sem criar lançamentos nem aplicar regras às transações.

Assinaturas continuam na categoria original. A tela agrupa por tipo ou alocação e mostra o total do equivalente mensal por grupo e moeda. Anuais são previstas pelo valor integral somente no mês da cobrança. A divisão por 12, arredondada em centavos, é informativa. Para semanais e personalizadas, o equivalente usa 52 semanas ou 365 dias por ano.

A janela inicial do aviso é de 30 dias corridos, incluindo hoje e o limite. Fica centralizada em `RENEWAL_NOTICE_DAYS`. A faixa mostra apenas assinaturas ativas com renovação nessa janela e é atualizada após salvar e a cada minuto. Datas vencidas deixam a faixa. A data de renovação é explícita e editável; não é avançada automaticamente. Janela e critério de reconhecimento são escolhas iniciais de implementação para o dono avaliar.

O seed acrescenta uma conta fictícia isolada, renda e despesa já realizadas em novembro, assinaturas mensais e anuais, incluindo uma renovação próxima em novembro de 2026. Mantém IDs estáveis e preserva edições existentes. Nenhum dado de produção é usado nos testes.
