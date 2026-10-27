import mongoose from 'mongoose';
import type { FastifyInstance } from 'fastify';

export async function connectDatabase(app: FastifyInstance, uri: string) {
  const connection = mongoose.createConnection(uri, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 5_000,
  });
  try {
    await connection.asPromise();
  } catch {
    await connection.close().catch(() => undefined);
    throw new Error(
      'MongoDB connection failed; check MONGODB_URI and database readiness',
    );
  }
  app.addHook('onClose', async () => {
    await connection.close();
  });
  return connection;
}
