import { clerk, clerkSetup } from '@clerk/testing/playwright';
import { expect, test as setup } from '@playwright/test';
import { prepareClerk } from './clerk-fixtures.ts';
import { pathsFor, roleEmail, roles } from './paths.ts';
import { clerkFrontendHost, requireRunId, webOrigin } from './safety.ts';

setup(
  'creates role-specific Clerk development sessions',
  async ({ browser }) => {
    setup.setTimeout(90_000);
    const frontendApiUrl = clerkFrontendHost(process.env);
    const id = requireRunId(process.env);
    await clerkSetup({
      dotenv: false,
      frontendApiUrl,
    });
    await prepareClerk(process.env, id);
    for (const role of roles) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.goto(webOrigin + '/');
        await clerk.signIn({ page, emailAddress: roleEmail(role, id) });
        await page.goto(webOrigin + '/account');
        await expect(page).toHaveURL(webOrigin + '/account');
        await context.storageState({ path: pathsFor(id).state(role) });
      } finally {
        await context.close();
      }
    }
  },
);
