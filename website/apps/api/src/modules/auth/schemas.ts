import { z } from 'zod';

const clerkId = z
  .string()
  .regex(/^user_[a-zA-Z0-9]+$/)
  .max(128);
export const eventEnvelope = z.object({ type: z.string() });
export const userEvent = z.object({
  type: z.enum(['user.created', 'user.updated', 'user.deleted']),
  timestamp: z.number().int().positive(),
  data: z.object({ id: clerkId, updated_at: z.number().int().optional() }),
});
export const clerkIdentityPayload = z.object({
  primary_email_address_id: z.string().nullable(),
  email_addresses: z.array(
    z.object({
      id: z.string(),
      email_address: z.email(),
      verification: z.object({ status: z.string() }).nullish(),
    }),
  ),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  image_url: z.string().optional(),
  profile_image_url: z.string().optional(),
});
