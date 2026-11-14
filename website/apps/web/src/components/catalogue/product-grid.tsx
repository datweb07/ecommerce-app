import type { productDto } from '@storefront/shared';
import type { z } from 'zod';
import { ProductCard } from '../common/storefront';

export type Product = z.infer<typeof productDto>;
export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
      {products.map((product) => (
        <li key={product.id} className="min-w-0">
          <ProductCard
            id={product.id}
            name={product.name}
            price={product.price}
            image={product.images[0]}
            stock={product.stock}
            {...(product.totalReviews > 0
              ? { rating: product.averageRating }
              : {})}
          />
        </li>
      ))}
    </ul>
  );
}
