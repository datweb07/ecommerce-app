import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { captureUI3D } from './ui-3d-artifacts.ts';
import { webOrigin } from './safety.ts';

const guide = (page: Page) =>
  page.getByRole('region', { name: 'Cách mua sắm tại ShopEase' });

async function axeGuide(page: Page) {
  const result = await new AxeBuilder({ page })
    .include('[data-pin-guide]')
    .include('[data-fan-cards]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations).toEqual([]);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme, reducedMotion: 'no-preference' });

    test(
      'keeps the guide below the header while scrolling and changes steps',
      { tag: '@public' },
      async ({ page }) => {
        await page.goto('/');
        const section = guide(page);
        const frame = section.locator('[data-pin-frame]');
        await expect(section.getByRole('listitem')).toHaveCount(4);
        await expect(page.locator('html')).toHaveClass(new RegExp(colorScheme));
        const desktop = (page.viewportSize()?.width ?? 0) >= 768;
        const prefix = (desktop ? 'desktop-' : 'mobile-') + colorScheme;
        if (!desktop) {
          await expect(frame).toHaveCSS('position', 'relative');
          await expect(section.locator('[data-pin-poster]')).toBeHidden();
          await section.scrollIntoViewIfNeeded();
          await captureUI3D(page, prefix + '/02-guide');
          await axeGuide(page);
          return;
        }

        await expect(section).toHaveAttribute('data-pin-enhanced', '');
        await expect(frame).toHaveCSS('position', 'sticky');
        const bounds = await section.evaluate((element) => {
          const frame = element.querySelector<HTMLElement>('[data-pin-frame]');
          if (!frame) throw new Error('Missing pin frame');
          const offset = Number.parseFloat(getComputedStyle(frame).top);
          return {
            start:
              element.getBoundingClientRect().top + window.scrollY - offset,
            distance: element.clientHeight - frame.clientHeight,
            offset,
          };
        });
        expect(bounds.distance).toBeGreaterThan(1000);
        for (const [index, fraction] of [0.04, 1 / 3, 2 / 3, 0.95].entries()) {
          await page.evaluate(
            (top) => window.scrollTo({ top, behavior: 'instant' }),
            bounds.start + bounds.distance * fraction,
          );
          await expect(section).toHaveAttribute(
            'data-pin-step',
            String(index + 1),
          );
          await expect(section.locator('[data-pin-readout]')).toHaveText(
            '0' + String(index + 1),
          );
          await expect
            .poll(async () =>
              Math.abs((await frame.boundingBox())!.y - bounds.offset),
            )
            .toBeLessThan(2);
          const header = await page.getByRole('banner').boundingBox();
          expect(Math.abs((header?.height ?? 0) - bounds.offset)).toBeLessThan(
            2,
          );
          await captureUI3D(page, prefix + '/pin-step-' + String(index + 1));
        }
        const before = await page.evaluate(() => window.scrollY);
        await page.mouse.move(420, 420);
        await page.mouse.wheel(0, 70);
        await expect
          .poll(() => page.evaluate(() => window.scrollY))
          .toBeGreaterThan(before);
        await axeGuide(page);
        const skip = section.getByRole('link', {
          name: 'Bỏ qua hướng dẫn mua sắm',
        });
        await page.keyboard.press('Tab');
        await skip.focus();
        await expect(skip).toHaveCSS('clip-path', 'none');
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/#home-benefits$/);
        await expect(page.locator('#home-benefits')).toBeFocused();
      },
    );
  });
}

test(
  'keeps the guide in document flow without JavaScript, with reduced motion or in a short viewport',
  { tag: '@public' },
  async ({ browser, page }) => {
    await page.setViewportSize({ width: 1200, height: 480 });
    await page.goto('/');
    await expect(guide(page).locator('[data-pin-frame]')).toHaveCSS(
      'position',
      'relative',
    );
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await expect(guide(page).locator('[data-pin-frame]')).toHaveCSS(
      'position',
      'relative',
    );
    await expect(page.locator('[data-fan-face]').first()).toHaveCSS(
      'transform',
      'none',
    );
    await axeGuide(page);

    const noJS = await browser.newPage({
      viewport: { width: 1200, height: 900 },
      javaScriptEnabled: false,
    });
    try {
      await noJS.goto(webOrigin);
      await expect(guide(noJS).locator('[data-pin-frame]')).toHaveCSS(
        'position',
        'relative',
      );
      await expect(guide(noJS).getByRole('listitem')).toHaveCount(4);
      await expect(guide(noJS).getByRole('heading', { level: 3 })).toHaveCount(
        4,
      );
    } finally {
      await noJS.close();
    }
  },
);
