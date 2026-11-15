import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireRunId } from './safety.ts';

export const appRoot = fileURLToPath(new URL('../', import.meta.url));
export const workspace = dirname(dirname(appRoot));
export const apiRoot = join(workspace, 'apps', 'api');
export const e2eCache = join(workspace, '.cache', 'e2e');
export const roles = ['customer', 'customer2', 'admin'] as const;
export type Role = (typeof roles)[number];
export const pathsFor = (id: string) => {
  requireRunId({ STOREFRONT_E2E_RUN: id });
  const root = join(e2eCache, id);
  const privateDir = join(root, 'private');
  return {
    root,
    privateDir,
    mongo: join(privateDir, 'mongo'),
    report: join(root, 'report'),
    results: join(root, 'results'),
    project: join(privateDir, 'web'),
    identities: join(privateDir, 'identities.jsonl'),
    state: (role: Role) => join(privateDir, role + '.json'),
  };
};
export const roleEmail = (role: Role, id: string) =>
  'storefront-' + role + '-' + id + '+clerk_test@example.com';
