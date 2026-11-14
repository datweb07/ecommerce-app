import { Schema, type Connection } from 'mongoose';

export function webhookEvents(db: Connection) {
  return db.model(
    'StorefrontWebhookEvent',
    new Schema<{ _id: string; expiresAt: Date }>(
      {
        _id: String,
        expiresAt: { type: Date, expires: 0, required: true },
      },
      { versionKey: false },
    ),
    'web_webhook_events',
  );
}

export const receiptExpiry = () => new Date(Date.now() + 35 * 86400_000);
export function duplicateKey(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
