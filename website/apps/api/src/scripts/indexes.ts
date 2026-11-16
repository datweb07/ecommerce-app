import { parseEnv } from '../config/env.js';
import {
  createStorefrontIndexes,
  registerIndexModels,
} from '../models/indexes.js';
import { openDatabase } from '../plugins/database.js';

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  if (args.length !== 1 || !['--dry-run', '--apply'].includes(args[0] ?? '')) {
    throw new Error('Usage: db:indexes --dry-run | --apply');
  }
  if (!process.env.MONGODB_URI || !process.env.DEPLOY_ENV) {
    throw new Error('Invalid environment: MONGODB_URI, DEPLOY_ENV');
  }
  // Index operators only receive the DB credential, never application keys.
  const uri = process.env.MONGODB_URI;
  const target = process.env.DEPLOY_ENV;
  if (target !== 'local') {
    let valid = false;
    try {
      const url = new URL(uri);
      valid =
        url.protocol === 'mongodb+srv:' &&
        url.hostname.endsWith('.mongodb.net') &&
        ((target === 'staging' && url.pathname === '/web_staging') ||
          (target === 'production' && url.pathname === '/web_prod')) &&
        ![...url.searchParams.keys()].some((key) =>
          /^(tls|ssl|directconnection)/i.test(key),
        );
    } catch {
      // Report only variable names.
    }
    if (!valid) throw new Error('Invalid environment: MONGODB_URI, DEPLOY_ENV');
  } else if (
    !/^mongodb:\/\/(?:[^/@]+@)?(?:127\.0\.0\.1|localhost|mongo)(?::\d+)?\/web_[a-z_]+(?:\?|$)/i.test(
      uri,
    ) ||
    /\/web_(?:prod|staging)(?:\?|$)/i.test(uri)
  ) {
    throw new Error('Invalid environment: MONGODB_URI');
  }
  const pool = parseEnv({
    MONGO_MAX_POOL_SIZE: process.env.MONGO_MAX_POOL_SIZE,
  }).MONGO_MAX_POOL_SIZE;
  const database = openDatabase(uri, pool, target !== 'local');
  try {
    await database.asPromise();
    registerIndexModels(database);
    for (const model of Object.values(database.models)) {
      const indexes = model.schema.indexes();
      if (indexes.length)
        console.log(
          JSON.stringify({ collection: model.collection.name, indexes }),
        );
    }
    if (args[0] === '--apply') {
      await createStorefrontIndexes(database);
      console.log('Additive indexes applied.');
    } else console.log('Dry run. No indexes created.');
  } finally {
    await database.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error &&
      /^(Invalid environment|Usage):/.test(error.message)
      ? error.message
      : 'Index operation failed. Check the database, privileges and index conflicts.',
  );
  process.exitCode = 1;
});
