# Cloudflare: homologação e produção

Os dois D1 já existem na conta BFO. Não crie outros bancos. Os IDs informados estão em `wrangler.jsonc`; cada ambiente aponta seu binding `DB` ao banco correspondente. O campo `database_name` serve como nome legível na configuração; as operações documentadas resolvem o binding e o ID.

## Passos do dono, em ordem

1. Entre na conta BFO e confira os D1 existentes: homologação `9db4bc67-bacb-4176-8701-34d24f7c7bce`; produção `32c0ee02-7cdf-4fc7-b83f-e8808ba3f4de`. Não é necessário criá-los nesta sessão.
2. Em Workers & Pages, conecte `guilhermebayara/bfo` ao Workers Builds para o Worker `bfo-homologacao`. Escolha `homologacao` como branch de produção desse projeto de homologação e a raiz do repositório como diretório. Use Node.js 24, instalação `npm ci`, build `npm run build` e deploy `npx wrangler deploy --env homologacao`. Confira que `DB` está vinculado ao D1 de homologação. O ambiente chamado “produção” do projeto de Builds significa sua branch principal de build; aqui ela continua sendo homologação do BFO.
3. Ative builds de branches que não são de produção e inclua as branches `tst-*`. Use `npx wrangler versions upload --env homologacao --preview-alias "$WORKERS_CI_BRANCH"` como comando de deploy dessas branches. `WORKERS_CI_BRANCH` é fornecida pelo Workers Builds; para esta sessão seu valor é `tst-fundacao`. O build continua `npm run build`. Não execute `wrangler deploy` para prévias, pois ele alteraria a versão ativa de homologação. Após conectar o repositório, dispare o primeiro build da branch. O primeiro deploy do Worker principal precisa existir antes de enviar uma versão de prévia.
4. Ative Cloudflare Access no endereço workers.dev de `bfo-homologacao` e também nas URLs de prévia. Restrinja a política ao seu login e proteja todos os caminhos, inclusive `/api/*`. Confira a cobertura das prévias de versão e do alias `tst-fundacao`, consultando os hosts mostrados no painel. Teste em janela anônima: páginas e API devem exigir login. Faça isso antes de usar qualquer dado real. As prévias usam o mesmo D1 de homologação e compartilham as alterações entre si.
5. Na sua máquina, com a branch `tst-fundacao` ou a entrega já integrada em `homologacao`, rode os comandos abaixo. Autentique na conta BFO e confira o ID do banco indicado pelo Wrangler antes de confirmar. Nesta sessão, migração e seed remotos são exclusivos de homologação.

```sh
npm ci
npx wrangler login
npx wrangler whoami
npm run db:migrate:homologacao
npm run db:seed:homologacao
```

Se uma operação falhar, corrija a causa antes da seguinte. Não execute seed no banco de produção. O seed não é parte do build nem do deploy automático. Pode ser repetido sem duplicar as fixtures; também preserva edições existentes.

6. Abra Transações e Contas na prévia da branch. Confira filtros e edição de categoria/nota; em Contas, confira a prévia antes de confirmar uma ativação. O ajuste deve aparecer em Transações, filtrando pela conta e pela origem Ajuste. Faça squash do PR para `homologacao` somente depois da revisão. Esta sessão não integra nem publica em produção.

## Endereços esperados

O subdomínio workers.dev da conta aparece no painel da Cloudflare. Ele não é inferido do nome do repositório. Os formatos abaixo ainda dependem dos passos de configuração e do primeiro build bem-sucedido:

- Homologação: `https://bfo-homologacao.<SUBDOMINIO-DA-CONTA>.workers.dev/transacoes` e `/contas`.
- Prévia da sessão: `https://tst-fundacao-bfo-homologacao.<SUBDOMINIO-DA-CONTA>.workers.dev/transacoes` e `/contas`.
- O comando `versions upload` também informa uma URL de versão. Use o endereço completo impresso no build e confirme a proteção pelo Access.

## Produção

O ambiente `producao` está configurado para `bfo-producao` e para o D1 `32c0ee02-7cdf-4fc7-b83f-e8808ba3f4de`. Workers.dev e prévias ficam desativados nesse ambiente. A ligação do domínio e a migração de produção pertencem à etapa futura de produção, após as três fases. Nenhum seed é executado automaticamente por scripts de deploy.
