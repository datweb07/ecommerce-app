import { access, writeFile } from 'node:fs/promises';
import { createClerkClient } from '@clerk/backend';
import { pathsFor, roleEmail, roles, type Role } from './paths.ts';
import { assertSafeEnvironment } from './safety.ts';

const externalId = (role: Role, id: string) =>
  'storefront-e2e-' + id + '-' + role;
function clerkClient(env: NodeJS.ProcessEnv) {
  assertSafeEnvironment(env);
  const secretKey = env.CLERK_SECRET_KEY;
  if (!secretKey?.startsWith('sk_test_'))
    throw new Error('Cần CLERK_SECRET_KEY development.');
  return createClerkClient({ secretKey, apiUrl: 'https://api.clerk.com' });
}

export async function prepareClerk(env: NodeJS.ProcessEnv, id: string) {
  const client = clerkClient(env);
  await writeFile(pathsFor(id).identities, '', { mode: 0o600 });
  for (const role of roles) {
    const reference = externalId(role, id);
    const existing = await client.users.getUserList({
      externalId: [reference],
      limit: 2,
    });
    if (existing.data.length) {
      if (
        existing.data.length !== 1 ||
        existing.data[0]?.privateMetadata.storefrontE2E !== id
      )
        throw new Error('Fixture Clerk đã tồn tại với metadata không hợp lệ.');
      continue;
    }
    const user = await client.users.createUser({
      emailAddress: [roleEmail(role, id)],
      externalId: reference,
      firstName: 'Storefront',
      lastName: role,
      skipPasswordRequirement: true,
      privateMetadata: { storefrontE2E: id },
    });
    const primary = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    );
    if (
      primary?.emailAddress !== roleEmail(role, id) ||
      primary.verification?.status !== 'verified'
    )
      throw new Error(
        'Clerk không cấp email chính đã xác minh cho fixture ' + role,
      );
  }
}

export async function cleanupClerk(env: NodeJS.ProcessEnv, id: string) {
  try {
    await access(pathsFor(id).identities);
  } catch {
    return;
  }
  const client = clerkClient(env);
  const results = await Promise.allSettled(
    roles.map(async (role) => {
      const reference = externalId(role, id);
      const { data } = await client.users.getUserList({
        externalId: [reference],
        limit: 2,
      });
      for (const user of data) {
        if (
          user.externalId === reference &&
          user.privateMetadata.storefrontE2E === id &&
          user.emailAddresses.some(
            (email) => email.emailAddress === roleEmail(role, id),
          )
        )
          await client.users.deleteUser(user.id);
      }
    }),
  );
  if (results.some(({ status }) => status === 'rejected'))
    throw new Error('Dọn tài khoản thử Clerk thất bại cho phiên ' + id + '.');
}
