import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

async function main() {
  const env = loadEnv();
  const app = await buildApp(env);
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    app.log.info('API draining');
    const deadline = setTimeout(() => {
      app.log.error('API drain deadline exceeded');
      process.exit(1);
    }, 25_000);
    deadline.unref();
    try {
      await app.close();
      app.log.info('API drained');
    } catch {
      app.log.error('API shutdown failed');
      process.exitCode = 1;
    } finally {
      clearTimeout(deadline);
    }
  };
  process.once('SIGINT', () => {
    void shutdown();
  });
  process.once('SIGTERM', () => {
    void shutdown();
  });
  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error && error.message.startsWith('Invalid environment:')
      ? error.message
      : 'API startup failed. Check environment configuration and MongoDB readiness.',
  );
  process.exitCode = 1;
});
