import { loadEnv } from '../config/env.js';
import { importProducts } from './product-data.js';

async function main() {
  const env = loadEnv();
  const source = process.env.LEGACY_PRODUCTS_URI;
  if (!source) throw new Error('Missing source');
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  if (args.some((arg) => arg !== '--write' && !/^--limit=\d+$/.test(arg)))
    throw new Error('Unknown option');
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const result = await importProducts(source, env.MONGODB_URI, {
    write: args.includes('--write'),
    limit: limitArg ? Number(limitArg.split('=')[1]) : 1000,
  });
  console.log(JSON.stringify(result));
}
main().catch(() => {
  console.error(
    'Product import failed. Check LEGACY_PRODUCTS_URI (read-only user), local target, and options --write / --limit=1000. Credentials and records are never printed.',
  );
  process.exitCode = 1;
});
