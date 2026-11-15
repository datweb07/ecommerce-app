import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { workspace } from './paths.ts';

async function capture(page: Page, name: string) {
  if (process.env.STOREFRONT_CAPTURE_GLOBE !== '1') return;
  const dir = join(workspace, '.cache', 'ui-globe');
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: join(dir, name + '.png') });
}

const openLabel = 'Xem vị trí trên bản đồ';
const closeLabel = 'Quay lại địa cầu';
const globe = (page: Page) => page.locator('[data-hero-globe]');

test.use({
  launchOptions: {
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  },
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme, reducedMotion: 'no-preference' });

    test(
      'rotates, accepts direct manipulation and zooms to the location preview',
      { tag: '@public' },
      async ({ page, isMobile }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto('/');
        await expect(page.locator('html')).toHaveClass(new RegExp(colorScheme));
        const wrapper = globe(page);
        const stage = wrapper.locator('[data-globe-mode]');
        const marker = wrapper.locator('[data-globe-marker]');
        const prefix = `${isMobile ? 'mobile' : 'desktop'}-${colorScheme}`;
        await wrapper.scrollIntoViewIfNeeded();
        await expect(stage).toHaveAttribute('data-globe-live', 'true', {
          timeout: 15_000,
        });
        await expect(marker).toBeVisible();
        const first = await marker.evaluate((element) => element.style.left);
        await expect
          .poll(() => marker.evaluate((element) => element.style.left))
          .not.toBe(first);
        await capture(page, prefix + '-01-rotation');

        const b = await stage.boundingBox();
        if (!b) throw new Error('Missing globe bounds');
        const x = b.x + b.width * 0.31;
        const y = b.y + b.height * 0.3;
        const before = await marker.evaluate((element) => element.style.left);
        if (isMobile) {
          const cdp = await page.context().newCDPSession(page);
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x, y }],
          });
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: x + 45, y }],
          });
          await capture(page, prefix + '-02-drag');
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: [],
          });
          await cdp.detach();
        } else {
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x + 70, y, { steps: 6 });
          await capture(page, prefix + '-02-drag');
          await page.mouse.up();
        }
        await expect
          .poll(() => marker.evaluate((element) => element.style.left))
          .not.toBe(before);

        if (!isMobile) {
          await marker.hover();
          await expect(marker).toHaveCSS('cursor', 'pointer');
          await capture(page, prefix + '-03-marker');
          await marker.click();
        } else {
          await wrapper.getByRole('button', { name: openLabel }).last().tap();
        }
        await expect(stage).toHaveAttribute('data-globe-mode', 'opening');
        await capture(page, prefix + '-04-zoom');
        await expect(stage).toHaveAttribute('data-globe-mode', 'map', {
          timeout: 16_000,
        });
        const mapLink = wrapper.getByRole('link', {
          name: 'Mở trên OpenStreetMap',
        });
        await expect(mapLink).toHaveAttribute(
          'href',
          /#map=14\/10\.7769\/106\.7009$/,
        );
        await capture(page, prefix + '-05-preview');
        const axe = await new AxeBuilder({ page })
          .include('[data-hero-globe]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(axe.violations).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(stage).toHaveAttribute('data-globe-mode', 'globe');
        await expect(
          wrapper.getByRole('button', { name: openLabel }).last(),
        ).toBeFocused();
        expect(errors).toEqual([]);
      },
    );
  });
}

test(
  'keeps the location button usable with reduced motion and with WebGL unavailable',
  { tag: '@public' },
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const wrapper = globe(page);
    const open = wrapper.getByRole('button', { name: openLabel });
    await expect(open).toBeVisible();
    await expect(wrapper.locator('canvas')).toHaveCount(0);
    await open.focus();
    await page.keyboard.press('Enter');
    await expect(
      wrapper.getByRole('button', { name: closeLabel }),
    ).toBeFocused();
    await expect(wrapper.locator('[data-globe-mode]')).toHaveAttribute(
      'data-globe-mode',
      'map',
    );
    await page.keyboard.press('Escape');
    await expect(open).toBeFocused();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        value: function (
          this: HTMLCanvasElement,
          ...args: Parameters<typeof original>
        ) {
          if (String(args[0]).startsWith('webgl')) return null;
          return Reflect.apply(original, this, args);
        },
      });
    });
    await page.reload();
    await open.click();
    await expect(
      wrapper.getByRole('link', { name: 'Mở trên OpenStreetMap' }),
    ).toBeVisible();
    await expect(wrapper.locator('canvas')).toHaveCount(0);
  },
);
