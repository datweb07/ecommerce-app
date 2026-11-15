import { expect, type Page } from '@playwright/test';
import { apiOrigin } from './safety.ts';

export async function bearer(page: Page) {
  const token = await expect
    .poll(async () => {
      return Boolean(await clerkToken(page));
    })
    .toBe(true)
    .then(() => clerkToken(page));
  if (!token) throw new Error('Clerk development session has no Bearer token.');
  return { authorization: 'Bearer ' + token };
}

function clerkToken(page: Page) {
  return page.evaluate(async () => {
    const clerk = (
      window as Window & {
        Clerk?: { session?: { getToken(): Promise<string | null> } };
      }
    ).Clerk;
    return clerk?.session?.getToken();
  });
}

export function memberApi(page: Page) {
  return async (
    method: string,
    path: string,
    data?: object,
    headers?: Record<string, string>,
  ) =>
    page.request.fetch(apiOrigin + '/api/v1' + path, {
      method,
      headers: { ...(await bearer(page)), ...headers },
      ...(data ? { data } : {}),
      maxRedirects: 0,
    });
}

export const addressFixture = {
  label: 'E2E Home',
  fullName: 'Storefront Test',
  streetAddress: '1 Test Street',
  city: 'Test',
  state: 'Test',
  zipCode: '12345',
  phoneNumber: '+12025550123',
  isDefault: true,
};
