import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { serverEnv } from '../config/server-env';

export async function getServerToken() {
  return serverEnv.CLERK_SECRET_KEY ? (await auth()).getToken() : null;
}
