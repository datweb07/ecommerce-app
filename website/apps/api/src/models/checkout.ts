import { Schema, type Connection, type Types } from 'mongoose';
import type { Shipping, OrderItem } from './order.js';
import type { z } from 'zod';
import type { checkoutQuote } from '@storefront/shared';

export interface ReservedItem extends OrderItem {
  cartItemId: Types.ObjectId;
  unitCents: number;
}
export interface Checkout {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  clerkId: string;
  key: string;
  version: number;
  addressId: Types.ObjectId;
  cartId: Types.ObjectId;
  items: ReservedItem[];
  shipping: Shipping;
  quote: z.infer<typeof checkoutQuote>;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  expiresAt: Date;
  stripeId?: string;
  nextSweepAt: Date;
  paymentIntent?: string;
  url?: string;
  orderId?: Types.ObjectId;
  requiresReconciliation?: boolean;
  returnOrigin: string;
  createdAt: Date;
}
export function checkoutModel(db: Connection) {
  const item = new Schema<ReservedItem>(
    {
      cartItemId: Schema.Types.ObjectId,
      product: Schema.Types.ObjectId,
      name: String,
      price: Number,
      quantity: Number,
      image: String,
      unitCents: Number,
    },
    { _id: false },
  );
  const schema = new Schema<Checkout>(
    {
      user: { type: Schema.Types.ObjectId, required: true },
      clerkId: { type: String, required: true },
      key: { type: String, required: true },
      version: { type: Number, required: true },
      addressId: { type: Schema.Types.ObjectId, required: true },
      cartId: { type: Schema.Types.ObjectId, required: true },
      items: [item],
      shipping: {
        fullName: String,
        streetAddress: String,
        city: String,
        state: String,
        zipCode: String,
        phoneNumber: String,
      },
      quote: {
        currency: String,
        subtotalCents: Number,
        shippingCents: Number,
        taxCents: Number,
        totalCents: Number,
      },
      status: {
        type: String,
        enum: ['pending', 'paid', 'expired', 'failed'],
        required: true,
      },
      expiresAt: { type: Date, required: true },
      stripeId: String,
      nextSweepAt: { type: Date, required: true },
      paymentIntent: String,
      url: String,
      orderId: Schema.Types.ObjectId,
      requiresReconciliation: Boolean,
      returnOrigin: { type: String, required: true },
    },
    { timestamps: true },
  );
  schema.index({ user: 1, clerkId: 1, key: 1 }, { unique: true });
  schema.index(
    { user: 1, clerkId: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: 'pending' } },
  );
  schema.index({ stripeId: 1 }, { unique: true, sparse: true });
  schema.index({ paymentIntent: 1 }, { unique: true, sparse: true });
  schema.index(
    { nextSweepAt: 1, _id: 1 },
    {
      partialFilterExpression: {
        status: 'pending',
        stripeId: { $exists: true },
      },
    },
  );
  return db.model('StorefrontCheckout', schema, 'web_checkout_sessions');
}
