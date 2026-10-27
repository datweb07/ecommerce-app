import { loadEnv } from '../config/env.js';
import { seedProducts } from './product-data.js';

async function main() {
  const env = loadEnv();
  const result = await seedProducts(env.MONGODB_URI);
  console.log(
    `Seed complete: ${result.upsertedCount} products inserted; existing products preserved.`,
  );
}
main().catch(() => {
  console.error(
    'Seed failed. Target must be the local storefront_web database and MongoDB must be ready.',
  );
  process.exitCode = 1;
});
