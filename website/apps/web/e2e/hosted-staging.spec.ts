import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';
import { productListDto } from '@storefront/shared';
import { stagingTarget } from './staging-target.ts';

test('@staging verifies SSR and a Clerk development session across hosts', async ({
  context,
  page,
}) => {
  const { web, api, clerkHost } = stagingTarget(process.env);
  const bypass = process.env.SMOKE_VERCEL_BYPASS_SECRET;
  const landing = await context.request.get(web + '/', {
    maxRedirects: 0,
    ...(bypass
      ? {
          headers: {
            'x-vercel-protection-bypass': bypass,
            'x-vercel-set-bypass-cookie': 'true',
          },
        }
      : {}),
  });
  expect(landing.status()).toBe(200);
  expect(landing.headers()['x-robots-tag']).toMatch(/\bnoindex\b/i);

  const data = await context.request.get(api + '/api/v1/products?limit=1', {
    maxRedirects: 0,
  });
  expect(data.status()).toBe(200);
  const product = productListDto.parse(await data.json()).items[0];
  if (!product)
    throw new Error('Create a staging catalogue product before running E2E.');
  const detail = await context.request.get(web + '/products/' + product.id, {
    maxRedirects: 0,
  });
  expect(detail.status()).toBe(200);
  const headings = [
    ...(await detail.text()).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi),
  ].map(([, heading]) => heading);
  // Compare the heading itself to distinguish SSR from serialized hydration data.
  const headingMatches = await page.evaluate(
    ({ headings, name }) => {
      return headings.some(
        (heading) =>
          new DOMParser().parseFromString(heading ?? '', 'text/html').body
            .textContent === name,
      );
    },
    { headings, name: product.name },
  );
  expect(headingMatches).toBe(true);

  await clerkSetup({ dotenv: false, frontendApiUrl: clerkHost });
  const corsErrors: string[] = [];
  page.on('console', (event) => {
    if (
      event.type() === 'error' &&
      /cors policy|cross-origin request blocked/i.test(event.text())
    )
      corsErrors.push('Blocked cross-origin request');
  });
  await page.goto(web + '/');
  await expect(page).toHaveURL(web + '/');
  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: process.env.STAGING_TEST_EMAIL!,
      password: process.env.STAGING_TEST_PASSWORD!,
    },
  });
  const profile = page.waitForResponse(
    (response) =>
      response.url() === api + '/api/v1/me' &&
      response.request().method() === 'GET',
  );
  await page.goto(web + '/account/profile');
  await expect(page).toHaveURL(web + '/account/profile');
  const response = await profile;
  expect(response.status()).toBe(200);
  expect(await response.headerValue('access-control-allow-origin')).toBe(web);
  expect(await response.headerValue('set-cookie')).toBeNull();
  expect(
    Boolean(
      (await response.request().headerValue('authorization'))?.startsWith(
        'Bearer ',
      ),
    ),
  ).toBe(true);
  expect(corsErrors).toEqual([]);
});
