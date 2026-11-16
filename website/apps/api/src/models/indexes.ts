import type { Connection } from 'mongoose';
import { bannerModels } from './banner.js';
import { cartModel } from './cart.js';
import { catalogueModels } from './catalogue.js';
import { checkoutModel } from './checkout.js';
import { notificationModel } from './notification.js';
import { orderModel } from './order.js';
import { userModels } from './user.js';
import { webhookEvents } from './webhook-event.js';

export function registerIndexModels(db: Connection) {
  bannerModels(db);
  cartModel(db);
  catalogueModels(db);
  checkoutModel(db);
  notificationModel(db);
  orderModel(db);
  userModels(db);
  webhookEvents(db);
}

export async function createStorefrontIndexes(db: Connection) {
  for (const model of Object.values(db.models)) await model.createIndexes();
}
