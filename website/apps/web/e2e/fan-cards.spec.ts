import { expect, test, type Page } from '@playwright/test';
import { captureUI3D as capture } from './ui-3d-artifacts.ts';

async function coveredLabels(page: Page) {
  return page.locator('[data-fan-face]').evaluateAll((faces) => {
    const elements = faces.filter(
      (face): face is HTMLElement => face instanceof HTMLElement,
    );
    const prior = elements.map((face) => face.style.pointerEvents);
    for (const face of elements) face.style.pointerEvents = 'auto';
    const covered: string[] = [];
    try {
      for (const face of elements) {
        for (const label of face.querySelectorAll('[data-fan-copy] > *')) {
          const rect = label.getBoundingClientRect();
          for (const x of [rect.left + 2, rect.right - 2]) {
            const hit = document
              .elementFromPoint(x, (rect.top + rect.bottom) / 2)
              ?.closest('[data-fan-face]');
            if (hit !== face) covered.push(label.textContent?.trim() || 'icon');
          }
        }
      }
      return covered;
    } finally {
      elements.forEach((face, index) => {
        face.style.pointerEvents = prior[index] ?? '';
      });
    }
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme, reducedMotion: 'no-preference' });

    test(
      'keeps all labels readable and uses stationary hover slots',
      { tag: '@public' },
      async ({ page }) => {
        await page.goto('/');
        const fan = page.locator('[data-fan-cards]');
        const cards = fan.locator('[data-fan-slot]');
        await expect(cards).toHaveCount(3);
        const desktop = await page.evaluate(
          () =>
            matchMedia(
              '(min-width: 48rem) and (hover: hover) and (pointer: fine)',
            ).matches,
        );
        await expect(page.locator('html')).toHaveClass(new RegExp(colorScheme));

        if (!desktop) {
          const boxes = await cards.evaluateAll((nodes) =>
            nodes.map((node) => node.getBoundingClientRect().top),
          );
          expect(boxes[0]).toBeLessThan(boxes[1]!);
          expect(boxes[1]).toBeLessThan(boxes[2]!);
          await expect(cards.first().locator('[data-fan-face]')).toHaveCSS(
            'transform',
            'none',
          );
          await fan.scrollIntoViewIfNeeded();
          await capture(page, 'mobile-' + colorScheme + '/01-benefits');
          return;
        }

        for (const width of [768, 820, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await fan.scrollIntoViewIfNeeded();
          await expect
            .poll(() => coveredLabels(page), {
              message: 'readable at ' + width,
            })
            .toEqual([]);
        }
        await capture(page, 'desktop-' + colorScheme + '/01-fan-rest');
        const slot = cards.nth(1);
        const bounds = await slot.boundingBox();
        if (!bounds) throw new Error('Missing hover slot');
        const pointerY = bounds.y + bounds.height - 2;
        await page.mouse.move(bounds.x + bounds.width / 2, pointerY);
        const face = slot.locator('[data-fan-face]');
        await expect
          .poll(async () => (await face.boundingBox())!.y)
          .toBeLessThan(bounds.y - 18);
        expect(await slot.boundingBox()).toEqual(bounds);
        const stable = await slot.evaluate(async (element, y) => {
          const face = element.querySelector('[data-fan-face]');
          for (let frame = 0; frame < 8; frame++) {
            await new Promise(requestAnimationFrame);
            if (
              !element.matches(':hover') ||
              !face ||
              face.getBoundingClientRect().bottom >= y
            )
              return false;
          }
          return true;
        }, pointerY);
        expect(stable).toBe(true);
        await capture(page, 'desktop-' + colorScheme + '/02-fan-hover');
        await page.mouse.move(0, 0);
        await page.keyboard.press('Tab');
        await cards.first().focus();
        await expect(cards.first()).toBeFocused();
        await expect(cards.first()).toHaveCSS('z-index', '3');
        await expect(cards.first()).toHaveCSS('outline-style', 'solid');
        await capture(page, 'desktop-' + colorScheme + '/03-fan-focus');
      },
    );
  });
}
