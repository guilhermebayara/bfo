import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: '2026-11-19',
        d1Databases: ['DB'],
        bindings: { MIGRATIONS: await readD1Migrations('migrations') },
      },
      config: false,
    }),
  ],
  test: { include: ['tests/**/*.test.ts'], fileParallelism: false },
});
