import { apiErrorMessage } from './transport';

export async function apiResult<T>(operation: Promise<T>) {
  return operation.then(
    (data) => ({ ok: true as const, data }),
    (error: unknown) => ({
      ok: false as const,
      message: apiErrorMessage(error),
    }),
  );
}
