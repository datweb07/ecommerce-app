import mongoose from 'mongoose';
import type { FastifyInstance } from 'fastify';

export function openDatabase(uri: string, maxPoolSize: number, hosted = false) {
  return mongoose.createConnection(uri, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 5_000,
    maxPoolSize,
    retryWrites: true,
    ...(hosted ? { writeConcern: { w: 'majority' as const } } : {}),
  });
}

export async function connectDatabase(
  app: FastifyInstance,
  uri: string,
  maxPoolSize: number,
  hosted = false,
) {
  const connection = openDatabase(uri, maxPoolSize, hosted);
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
