# Cloudflare: homologação e produção

Os dois D1 já existem na conta BFO. Não crie outros bancos. `wrangler.jsonc` mantém os IDs existentes e o binding `DB` de cada ambiente. Produção não recebe seed.

## Passos do dono, em ordem

1. Na máquina autenticada na conta BFO, entre na raiz do checkout da branch `tst-sessao-b` e atualize as dependências. Confira a identidade e o banco de homologação antes de executar a migração:

```sh
git switch tst-sessao-b
git pull --ff-only
npm ci
npx wrangler login
npx wrangler whoami
npm run db:migrate:homologacao
npm run db:seed:homologacao
```

`db:migrate:homologacao` executa `wrangler d1 migrations apply DB --remote --env homologacao`. Só as migrações pendentes são aplicadas; `0002_session_b.sql` preserva os registros da sessão A, reconstrói `accounts` para aceitar moedas estrangeiras e acrescenta as novas entidades. O ID esperado é `9db4bc67-bacb-4176-8701-34d24f7c7bce`. Se uma etapa falhar, corrija a causa antes da seguinte.

O seed usa IDs estáveis e pode ser repetido sem apagar edições ou reativar contas. Acrescenta instituições fictícias, uma conta encerrada, uma conta USD e tags. Preenche instituição somente quando o vínculo dos IDs fictícios antigos estiver vazio. O câmbio do lançamento fictício em USD é manual e ilustrativo, sem gravar cotação fictícia no cache PTAX.

2. Em **Workers & Pages > bfo-homologacao > Settings > Build > Branch control**, mantenha `homologacao` como branch de produção desse projeto de build. Isso significa homologação do BFO. Ative **preview builds** para `tst-*`, incluindo `tst-sessao-b`. Use Node.js 24 e a raiz do repositório. Comandos:

| Campo | Comando |
|---|---|
| Instalação | `npm ci` |
| Build | `npm run build` |
| Deploy da branch homologacao | `npx wrangler deploy --env homologacao` |
| Preview command | `npx wrangler preview --env homologacao` |

O script local `npm run preview:homologacao` compila e executa o mesmo Preview command. O Wrangler usa o nome da branch como nome da Preview por padrão. O bloco `env.homologacao.previews` declara `DB` explicitamente. Confira também a configuração base de Previews no painel, caso exista, pois ela pode sobrescrever configurações locais.

As Previews desta etapa compartilham o D1 de homologação. Alterações feitas em qualquer uma aparecem nas demais. Não use `wrangler deploy` para publicar uma branch de teste sobre a versão ativa. O comando antigo `wrangler versions upload --preview-alias` foi substituído pelo recurso Previews. `preview_urls` fica desativado para os antigos endereços de versão.

3. Configure a proteção em **Zero Trust > Access > Applications > Add an application > Self-hosted**. Inclua o host `bfo-homologacao.bfo-825.workers.dev`, cobrindo todos os caminhos, inclusive `/api/*`. Crie uma política **Allow**, com regra **Include > Emails** para o seu e-mail, informado somente no painel. Cadastre também os hosts de Preview efetivamente mostrados pelo novo recurso; não reutilize por suposição o formato antigo dos aliases de versão. Confirme a cobertura de cada Preview no painel. Em janela anônima, tanto páginas quanto API devem exigir autenticação. Faça isso antes de usar dados reais.

4. Dispare o preview build de `tst-sessao-b`. Copie a URL exibida no resultado e valide Transações, Contas, Categorias, Tags e Beneficiários. O endereço só deve ser divulgado como prévia funcional depois de responder e estar protegido pelo Access. Faça squash do PR para `homologacao` após revisar. A sessão B não faz merge nem publica em produção.

## Endereços de homologação

Estes endereços passam a exibir a sessão B depois da integração e do deploy de `homologacao`:

- https://bfo-homologacao.bfo-825.workers.dev/transacoes
- https://bfo-homologacao.bfo-825.workers.dev/contas
- https://bfo-homologacao.bfo-825.workers.dev/categorias
- https://bfo-homologacao.bfo-825.workers.dev/tags
- https://bfo-homologacao.bfo-825.workers.dev/beneficiarios

## Produção

O ambiente `producao` permanece ligado ao Worker `bfo-producao` e ao D1 `32c0ee02-7cdf-4fc7-b83f-e8808ba3f4de`, sem workers.dev nem prévias. Migração, domínio e deploy de produção pertencem à etapa futura, após as três fases.
