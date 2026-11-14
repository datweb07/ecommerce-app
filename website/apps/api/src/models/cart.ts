import { Schema, type Connection, type Types } from 'mongoose';
export interface CartItem {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  quantity: number;
}
export interface Cart {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  clerkId: string;
  items: CartItem[];
  version?: number;
}
export function cartModel(db: Connection) {
  const item = new Schema<CartItem>({
    product: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
  });
  return db.model(
    'StorefrontCart',
    new Schema<Cart>(
      {
        user: { type: Schema.Types.ObjectId, required: true },
        clerkId: { type: String, required: true, unique: true },
        items: [item],
        version: { type: Number, default: 0 },
      },
      { timestamps: true },
    ),
    'carts',
  );
}

export function groupCartItems(items: CartItem[]) {
  const grouped = new Map<string, CartItem>();
  for (const item of items) {
    const key = item.product.toString();
    const existing = grouped.get(key);
    if (existing) existing.quantity += item.quantity;
    else
      grouped.set(key, {
        _id: item._id,
        product: item.product,
        quantity: item.quantity,
      });
  }
  return [...grouped.values()];
}
