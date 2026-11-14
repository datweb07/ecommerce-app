import { Schema, type Connection, type Types } from 'mongoose';

export interface Product {
  _id: Types.ObjectId;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  images: string[];
  averageRating?: number;
  totalReviews?: number;
  createdAt?: Date;
}
export interface Review {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  rating: number;
  createdAt?: Date;
}
export function catalogueModels(db: Connection) {
  const product = new Schema<Product>(
    {
      name: { type: String, required: true },
      description: { type: String, required: true },
      category: { type: String, required: true },
      price: { type: Number, required: true, min: 0 },
      stock: { type: Number, required: true, min: 0, default: 0 },
      images: [String],
      averageRating: { type: Number, min: 0, max: 5, default: 0 },
      totalReviews: { type: Number, default: 0 },
    },
    { timestamps: true },
  );
  product.index({ createdAt: -1, _id: -1 });
  product.index({ category: 1, createdAt: -1, _id: -1 });
  product.index({ category: 1, price: 1, _id: 1 });
  product.index({ price: 1, _id: 1 });
  product.index({ averageRating: -1, _id: -1 });
  const review = new Schema<Review>(
    {
      productId: { type: Schema.Types.ObjectId, required: true },
      userId: { type: Schema.Types.ObjectId, required: true },
      orderId: { type: Schema.Types.ObjectId, required: true },
      rating: { type: Number, required: true, min: 1, max: 5 },
    },
    { timestamps: true },
  );
  review.index({ productId: 1, createdAt: -1, _id: -1 });
  review.index({ userId: 1, productId: 1 });
  return {
    products: db.model('StorefrontProduct', product, 'products'),
    reviews: db.model('StorefrontReview', review, 'reviews'),
  };
}
