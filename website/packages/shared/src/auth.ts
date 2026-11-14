import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i);
export const emptyQuery = z.strictObject({});
export const acknowledgement = z.object({ received: z.literal(true) });
export const profileDto = z.object({
  id: objectId,
  name: z.string(),
  imageUrl: z.string(),
  bio: z.string(),
  userName: z.string().nullable(),
});
export const profilePatch = z
  .strictObject({
    bio: z.string().trim().max(500).optional(),
    userName: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_]{3,32}$/)
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0);
export const svixHeaders = z.object({
  'svix-id': z.string().min(1).max(128),
  'svix-timestamp': z.string().regex(/^\d+$/).max(20),
  'svix-signature': z.string().min(1).max(2048),
});
export const rawWebhookBody = z.string().min(1);
export const addressFields = z.strictObject({
  label: z.string().trim().min(1).max(80),
  fullName: z.string().trim().min(1).max(120),
  streetAddress: z.string().trim().min(1).max(240),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  zipCode: z.string().trim().min(1).max(24),
  phoneNumber: z
    .string()
    .trim()
    .min(7)
    .max(32)
    .regex(/^\+?[0-9 ().-]+$/)
    .refine((value) => value.replace(/\D/g, '').length >= 7),
  isDefault: z.boolean(),
});
