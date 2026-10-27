import { expect, it } from 'vitest';
import { productImportSchema } from '../src/index.js';

it('rejects unsafe stock and image sources for the data tools', () => {
  const product = {
    name: 'Sample',
    description: 'Description',
    price: 10,
    stock: 1,
    category: 'Electronics',
    images: ['https://images.unsplash.com/example'],
  };
  expect(productImportSchema.safeParse(product).success).toBe(true);
  expect(
    productImportSchema.safeParse({ ...product, stock: 0.5 }).success,
  ).toBe(false);
  expect(
    productImportSchema.safeParse({
      ...product,
      images: ['http://untrusted.local/image'],
    }).success,
  ).toBe(false);
});
