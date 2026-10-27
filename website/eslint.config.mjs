import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.cache/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  {
    files: ['scripts/*.mjs'],
    languageOptions: { globals: { process: 'readonly' } },
  },
  ...tseslint.configs.recommended,
  {
    ...nextPlugin.configs['core-web-vitals'],
    files: ['apps/web/**/*.{ts,tsx}'],
    settings: { next: { rootDir: 'apps/web/' } },
  },
  { ...reactHooks.configs.flat.recommended, files: ['apps/web/**/*.{ts,tsx}'] },
  {
    files: ['**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
];
