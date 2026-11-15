import { Schema, type Connection, type Types } from 'mongoose';
import type { Address } from './user.js';

export type Shipping = Omit<Address, '_id' | 'label' | 'isDefault'>;
export interface OrderItem {
  product: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  image: string;
}
export interface Order {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  clerkId: string;
  orderItems: OrderItem[];
  shippingAddress: Shipping;
  paymentResult?: { id?: string; status?: string };
  totalPrice: number;
  status: 'pending' | 'shipped' | 'delivered';
  createdAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
}
export function orderModel(db: Connection) {
  const orderItems = new Schema<OrderItem>({
    product: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String, required: true },
  });
  const shipping = new Schema<Shipping>({
    fullName: { type: String, required: true },
    streetAddress: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    phoneNumber: { type: String, required: true },
  });
  const order = new Schema<Order>(
    {
      user: { type: Schema.Types.ObjectId, required: true },
      clerkId: { type: String, required: true },
      orderItems: [orderItems],
      shippingAddress: { type: shipping, required: true },
      paymentResult: { id: String, status: String },
      totalPrice: { type: Number, required: true, min: 0 },
      status: {
        type: String,
        enum: ['pending', 'shipped', 'delivered'],
        default: 'pending',
      },
      shippedAt: Date,
      deliveredAt: Date,
    },
    { timestamps: true },
  );
  order.index({ clerkId: 1, createdAt: -1, _id: -1 });
  order.index({ createdAt: -1, _id: -1 });
  order.index({ user: 1, createdAt: -1 });
  order.index({ status: 1, createdAt: -1, _id: -1 });
  return db.model('StorefrontOrder', order, 'orders');
}
