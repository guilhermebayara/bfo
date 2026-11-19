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
