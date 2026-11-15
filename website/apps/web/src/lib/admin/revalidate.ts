'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { serverApi } from '../api/server';

const catalogueTag = z.enum(['catalogue', 'banners']);
export async function revalidateAdminStorefront(tag: unknown) {
  const result = catalogueTag.safeParse(tag);
  if (!result.success) return false;
  try {
    await serverApi.admin.me();
    revalidateTag(result.data, { expire: 0 });
    return true;
  } catch {
    return false;
  }
}
