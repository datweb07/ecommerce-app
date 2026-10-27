import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    include: ['apps/**/tests/**/*.test.ts', 'packages/**/tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      MONGOMS_VERSION: '8.0.17',
      MONGOMS_DBNAME: 'storefront_test',
      MONGOMS_DOWNLOAD_DIR: fileURLToPath(
        new URL('./.cache/mongodb', import.meta.url),
      ),
    },
  },
});
