import { loadEnv } from '../config/env.js';
import { seedProducts } from './product-data.js';
import { seedBanners } from './banner-data.js';

async function main() {
  const env = loadEnv();
  const result = await seedProducts(env.MONGODB_URI);
  const bannerCount = await seedBanners(
    env.MONGODB_URI,
    env.ADMIN_BANNER_MAX_COUNT,
  );
  console.log(
    `Seed complete: ${result.upsertedCount} products and ${bannerCount} banners inserted; existing records preserved.`,
  );
}
main().catch(() => {
  console.error(
    'Seed failed. Target must be the local storefront_web database and MongoDB must be ready.',
  );
  process.exitCode = 1;
});
