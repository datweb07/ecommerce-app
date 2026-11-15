import { Heart } from 'lucide-react';
import Link from 'next/link';
import type { checkoutStatus, orderStatus } from '@storefront/shared';
import type { z } from 'zod';
import { formatMoney } from '../../lib/money';
import { Badge } from '../ui/panels';
import { RatingStars } from './rating-stars';
import { ProductImage } from '../catalogue/product-image';
import { t } from '../../lib/i18n';

export function Price({
  amount,
  previous,
  unit = 'major',
  currency = 'usd',
}: {
  amount: number;
  previous?: number;
  unit?: 'major' | 'cents';
  currency?: 'usd';
}) {
  const options = { unit, currency };
  return (
    <span className="inline-flex flex-wrap gap-2">
      <span className="font-medium">{formatMoney(amount, options)}</span>
      {previous !== undefined && previous > amount && (
        <s className="text-sm text-muted-foreground">
          {formatMoney(previous, options)}
        </s>
      )}
    </span>
  );
}

export function ProductCard({
  id,
  name,
  price,
  image,
  stock,
  rating,
  showWishlistLink = false,
}: {
  id: string;
  name: string;
  price: number;
  image?: string | undefined;
  stock: number;
  rating?: number;
  showWishlistLink?: boolean;
}) {
  return (
    <article className="group h-full">
      <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[2px] bg-muted">
        <ProductImage
          source={image}
          alt={name}
          className={`object-cover transition-transform duration-200 motion-safe:group-hover:scale-[1.025] ${stock <= 0 ? 'opacity-80' : ''}`}
          sizes="(max-width: 1279px) 50vw, 300px"
        />
        {showWishlistLink && (
          <Link
            href={`/products/${encodeURIComponent(id)}#purchase`}
            aria-label={`${t('nav', 'wishlist')} · ${name}`}
            className="absolute top-2 right-2 grid size-10 place-items-center rounded-control bg-background text-muted-foreground hover:text-foreground focus-visible:text-foreground"
          >
            <Heart size={18} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="grid gap-1.5 pt-3 text-label">
        <Link
          href={`/products/${encodeURIComponent(id)}`}
          className="line-clamp-2 font-medium underline-offset-4 hover:underline"
        >
          {name}
        </Link>
        <span className="text-muted-foreground">
          <Price amount={price} />
        </span>
        {rating !== undefined && <RatingStars value={rating} />}
        {stock <= 0 && (
          <Badge className="justify-self-start">
            {t('catalogue', 'outOfStock')}
          </Badge>
        )}
      </div>
    </article>
  );
}

const orderLabels = {
  pending: 'Chờ xử lý',
  shipped: 'Đang giao',
  delivered: 'Đã giao',
};
const checkoutLabels = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  expired: 'Đã hết hạn',
  failed: 'Thanh toán thất bại',
};
type StatusProps =
  | { kind: 'order'; status: z.infer<typeof orderStatus> }
  | { kind: 'checkout'; status: z.infer<typeof checkoutStatus>['status'] };
export function StatusBadge(props: StatusProps) {
  const label =
    props.kind === 'order'
      ? orderLabels[props.status]
      : checkoutLabels[props.status];
  return <Badge>{label}</Badge>;
}
