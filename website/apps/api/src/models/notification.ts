import { Schema, type Connection, type Types } from 'mongoose';

export interface NotificationKey {
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  status: 'shipped' | 'delivered';
}
export interface Notification extends NotificationKey {
  _id: Types.ObjectId;
  occurredAt: Date;
  createdAt: Date;
  readAt: Date | null;
}
export function notificationModel(db: Connection) {
  const schema = new Schema<Notification>(
    {
      userId: { type: Schema.Types.ObjectId, required: true },
      orderId: { type: Schema.Types.ObjectId, required: true },
      status: { type: String, enum: ['shipped', 'delivered'], required: true },
      occurredAt: { type: Date, required: true },
      createdAt: { type: Date, required: true },
      readAt: { type: Date, default: null },
    },
    { versionKey: false },
  );
  schema.index({ userId: 1, orderId: 1, status: 1 }, { unique: true });
  schema.index({ userId: 1, createdAt: -1, _id: -1 });
  schema.index({ userId: 1, readAt: 1, createdAt: -1 });
  return db.model('StorefrontNotification', schema, 'web_notifications');
}
