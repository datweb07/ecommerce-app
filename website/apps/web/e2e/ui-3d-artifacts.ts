import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Page } from '@playwright/test';
import { workspace } from './paths.ts';

export async function captureUI3D(page: Page, name: string) {
  if (process.env.STOREFRONT_CAPTURE_UI3D !== '1') return;
  const path = join(workspace, '.cache', 'ui-3d', name + '.png');
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, animations: 'disabled' });
}
