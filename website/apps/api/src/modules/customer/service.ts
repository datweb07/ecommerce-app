import { Types, type Connection } from 'mongoose';
import type { z } from 'zod';
import type { Env } from '../../config/env.js';
import {
  groupCartItems,
  type CartItem,
  type cartModel,
} from '../../models/cart.js';
import type { catalogueModels } from '../../models/catalogue.js';
import type { Address, User, userModels } from '../../models/user.js';
import { duplicateKey } from '../../models/webhook-event.js';
import { ApiError } from '../../plugins/errors.js';
import { productView } from '../products/service.js';
import type { addressCreate, addressPatch, pagination } from './schemas.js';

export const owner = (user: User) => ({
  user: user._id,
  clerkId: user.clerkId,
});
const account = (user: User) => ({ _id: user._id, clerkId: user.clerkId });
const notFound = () =>
  new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.');
export const cartConflict = () =>
  new ApiError(409, 'CART_CHANGED', 'Giỏ hàng đã thay đổi.');
export const stockConflict = () =>
  new ApiError(409, 'INSUFFICIENT_STOCK', 'Số lượng hàng còn lại không đủ.');

type CartChange =
  | {
      action: 'add' | 'set';
      productId: string;
      quantity: number;
      version?: number | undefined;
    }
  | { action: 'remove'; productId: string }
  | { action: 'clear' };

function addressView(a: Address) {
  return {
    id: a._id.toString(),
    label: a.label,
    fullName: a.fullName,
    streetAddress: a.streetAddress,
    city: a.city,
    state: a.state,
    zipCode: a.zipCode,
    phoneNumber: a.phoneNumber,
    isDefault: a.isDefault ?? false,
  };
}

export function customerService(
  db: Connection,
  carts: ReturnType<typeof cartModel>,
  users: ReturnType<typeof userModels>['users'],
  products: ReturnType<typeof catalogueModels>['products'],
  env: Env,
) {
  async function viewCart(user: User) {
    const cart = await carts.findOne(owner(user)).lean();
    const items = groupCartItems(cart?.items ?? []);
    const rows = await products
      .find({ _id: { $in: items.map((item) => item.product) } })
      .lean();
    const values = new Map(rows.map((row) => [row._id.toString(), row]));
    return {
      version: cart?.version ?? 0,
      items: items.map((item) => {
        const productId = item.product.toString();
        const row = values.get(productId);
        const status = !row
          ? 'deleted'
          : row.stock <= 0
            ? 'out_of_stock'
            : row.stock < item.quantity
              ? 'insufficient_stock'
              : 'available';
        return {
          productId,
          quantity: item.quantity,
          product: row ? productView(row) : null,
          status,
        } as const;
      }),
    };
  }
  async function changeCart(user: User, change: CartChange) {
    for (let attempt = 0; ; attempt++) {
      try {
        await db.transaction(async (session) => {
          const cart = await carts.findOne(owner(user)).session(session).lean();
          let items = groupCartItems(cart?.items ?? []);
          if (change.action === 'add' || change.action === 'set') {
            if (
              change.version !== undefined &&
              change.version !== (cart?.version ?? 0)
            )
              throw cartConflict();
            const current = items.find(
              (item) => item.product.toString() === change.productId,
            );
            if (change.action === 'set' && !current) throw notFound();
            const product = await products
              .findById(change.productId)
              .session(session)
              .select({ stock: 1 })
              .lean();
            if (!product) throw notFound();
            const quantity =
              change.quantity +
              (change.action === 'add' ? (current?.quantity ?? 0) : 0);
            if (quantity > env.CART_MAX_QUANTITY)
              throw new ApiError(
                400,
                'QUANTITY_LIMIT',
                'Vượt giới hạn số lượng cho mỗi sản phẩm.',
              );
            if (quantity > product.stock) throw stockConflict();
            if (current) {
              current.quantity = quantity;
              if (change.action === 'set') current._id = new Types.ObjectId();
            } else {
              if (items.length >= 100)
                throw new ApiError(409, 'CART_LIMIT', 'Giỏ hàng đã đầy.');
              items.push({
                _id: new Types.ObjectId(),
                product: product._id,
                quantity,
              });
            }
          } else {
            if (!cart) return;
            items =
              change.action === 'clear'
                ? []
                : items.filter(
                    (item) => item.product.toString() !== change.productId,
                  );
          }
          if (cart)
            await carts.updateOne(
              { _id: cart._id, ...owner(user) },
              { $set: { items }, $inc: { version: 1 } },
              { session },
            );
          else
            await carts.create([{ ...owner(user), items, version: 1 }], {
              session,
            });
        });
        return viewCart(user);
      } catch (error) {
        if (!duplicateKey(error) || attempt >= 3) throw error;
        if (!(await carts.exists(owner(user)))) throw cartConflict();
      }
    }
  }
  async function wishlist(user: User, query: z.infer<typeof pagination>) {
    const doc = await users
      .findOne(account(user))
      .select({ wishlist: 1 })
      .lean();
    if (!doc) throw notFound();
    const ids = doc.wishlist ?? [];
    const offset = (query.page - 1) * query.limit;
    const selected = ids.slice(offset, offset + query.limit);
    const rows = await products.find({ _id: { $in: selected } }).lean();
    const byId = new Map(rows.map((row) => [row._id.toString(), row]));
    return {
      ...query,
      total: ids.length,
      items: selected.flatMap((id) => {
        const row = byId.get(id.toString());
        return row ? [productView(row)] : [];
      }),
    };
  }
  async function setWish(user: User, id: string, add: boolean) {
    if (add && !(await products.exists({ _id: id }))) throw notFound();
    const product = new Types.ObjectId(id);
    const result = await users.updateOne(
      account(user),
      add
        ? { $addToSet: { wishlist: product } }
        : { $pull: { wishlist: product } },
    );
    if (!result.matchedCount) throw notFound();
    return { received: true as const };
  }
  async function addresses(user: User) {
    const doc = await users
      .findOne(account(user))
      .select({ addresses: 1 })
      .lean();
    if (!doc) throw notFound();
    return { items: (doc.addresses ?? []).map(addressView) };
  }
  async function changeAddress(
    user: User,
    change:
      | { action: 'create'; input: z.infer<typeof addressCreate> }
      | { action: 'update'; id: string; input: z.infer<typeof addressPatch> }
      | { action: 'delete'; id: string },
  ) {
    return db.transaction(async (session) => {
      const filter = {
        ...account(user),
        ...('id' in change
          ? { 'addresses._id': new Types.ObjectId(change.id) }
          : {}),
      };
      const doc = await users
        .findOne(filter)
        .select({ addresses: 1 })
        .session(session)
        .lean();
      if (!doc) throw notFound();
      const rows = doc.addresses ?? [];
      let chosen: Address | undefined;
      if (change.action === 'create') {
        if (rows.length >= env.ADDRESS_MAX_COUNT)
          throw new ApiError(409, 'ADDRESS_LIMIT', 'Đã đạt giới hạn địa chỉ.');
        chosen = { _id: new Types.ObjectId(), ...change.input };
        rows.push(chosen);
      } else {
        const index = rows.findIndex((row) => row._id.equals(change.id));
        const previous = rows[index];
        if (!previous) throw notFound();
        if (change.action === 'delete') rows.splice(index, 1);
        else {
          const clean = Object.fromEntries(
            Object.entries(change.input).filter(
              ([, value]) => value !== undefined,
            ),
          ) as Partial<Address>;
          chosen = { ...previous, ...clean };
          rows[index] = chosen;
        }
      }
      const requestedDefault =
        change.action !== 'delete' && change.input.isDefault === true
          ? chosen
          : undefined;
      const defaultId = (requestedDefault ?? rows.find((row) => row.isDefault))
        ?._id;
      for (const row of rows)
        row.isDefault = defaultId?.equals(row._id) ?? false;
      await users.updateOne(
        filter,
        { $set: { addresses: rows } },
        { session, runValidators: true },
      );
      return { items: rows.map(addressView) };
    });
  }
  return { viewCart, changeCart, wishlist, setWish, addresses, changeAddress };
}

export type CustomerService = ReturnType<typeof customerService>;
export type { CartItem };
