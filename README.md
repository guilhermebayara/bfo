# BFO

Finanças pessoais com Cloudflare Workers, Hono, React, Vite e D1. Interface em português, modo escuro neutro e dados fictícios.

## Desenvolvimento local

Requer Node.js 24 (veja `.nvmrc`). Na raiz do repositório:

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Abra `http://localhost:8787/transacoes` ou `http://localhost:8787/contas`. O Worker serve a API em `/api` e os assets compilados do React. O D1 local fica em `.wrangler/state`, separado dos bancos remotos. Migração e seed locais podem ser repetidos. O seed inclui apenas dados inventados e não apaga edições existentes.

Para atualizar o front com recarga automática, mantenha o Worker aberto e rode `npm run dev:front` em outro terminal. Use a porta indicada pelo Vite; `/api` é encaminhado ao Worker em 8787. `npm run dev` recompila os assets ao iniciar; alterações posteriores no front aparecem nele depois de `npm run build`. O Wrangler recarrega as alterações da API.

```sh
npm test          # regras e API em runtime Workers com D1 isolado
npm run build     # TypeScript e bundle do front
npx playwright install chromium  # uma vez, para os testes de navegador
npm run test:e2e  # sobe Worker e D1 próprios e verifica os fluxos completos
```

Os testes de navegador recriam somente `.wrangler/e2e`; não apagam o banco do desenvolvimento. Se já houver Chromium instalado, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/caminho/do/chromium npm run test:e2e`.

## Organização

- `src/server`: API Hono e operações D1.
- `src/shared`: tipos de dados e conversão de reais para centavos.
- `src/client/components`: tabela, selo, campo de valor, botão e modal compartilhados.
- `src/client/tokens.css`: cores, fonte, tamanhos e espaçamentos do visual provisório.
- `migrations`: esquema versionado; `scripts/seed-data.mjs`: seed fictício.

Veja [as decisões técnicas](docs/decisoes-tecnicas.md), [a configuração da Cloudflare](docs/cloudflare.md) e [o andamento](docs/a-construir.md).
