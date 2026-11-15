import { expect, test } from '@playwright/test';
import { pathsFor, roles } from './paths.ts';
import { apiOrigin, requireRunId } from './safety.ts';

const paths = pathsFor(requireRunId(process.env));
for (const role of roles) {
  test(
    'restores Clerk state and authenticates API for ' + role,
    { tag: '@auth' },
    async ({ browser, baseURL }) => {
      const context = await browser.newContext({
        baseURL: baseURL ?? '',
        storageState: paths.state(role),
      });
      try {
        const page = await context.newPage();
        await page.goto('/account');
        await expect(page).toHaveURL(/\/account$/);
        await expect
          .poll(async () =>
            page.evaluate(async () => {
              const clerk = (
                window as Window & {
                  Clerk?: { session?: { getToken(): Promise<string | null> } };
                }
              ).Clerk;
              return Boolean(await clerk?.session?.getToken());
            }),
          )
          .toBe(true);
        const statuses = await page.evaluate(async (origin) => {
          const clerk = (
            window as Window & {
              Clerk?: { session?: { getToken(): Promise<string | null> } };
            }
          ).Clerk;
          const token = await clerk?.session?.getToken();
          if (!token) return [];
          const headers = { Authorization: 'Bearer ' + token };
          const results = await Promise.all([
            fetch(origin + '/api/v1/me', { headers }),
            fetch(origin + '/api/v1/admin/me', { headers }),
          ]);
          return results.map(({ status }) => status);
        }, apiOrigin);
        expect(statuses).toEqual([200, role === 'admin' ? 200 : 403]);
      } finally {
        await context.close();
      }
    },
  );
}
