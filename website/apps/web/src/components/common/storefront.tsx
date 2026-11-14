import Link from 'next/link';
import type { checkoutStatus, orderStatus } from '@storefront/shared';
import type { z } from 'zod';
import { formatMoney } from '../../lib/money';
import { Badge, Card } from '../ui/panels';
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
      <span className="font-bold">{formatMoney(amount, options)}</span>
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
}: {
  id: string;
  name: string;
  price: number;
  image?: string | undefined;
  stock: number;
  rating?: number;
}) {
  return (
    <Card className="h-full overflow-hidden p-0">
      <div className="relative grid aspect-[4/3] place-items-center bg-muted">
        <ProductImage
          source={image}
          alt={name}
          className="object-cover"
          sizes="(max-width: 1279px) 50vw, 300px"
        />
      </div>
      <div className="grid gap-2 p-4">
        <Link
          href={`/products/${encodeURIComponent(id)}`}
          className="font-bold hover:underline"
        >
          {name}
        </Link>
        <Price amount={price} />
        {rating !== undefined && <RatingStars value={rating} />}
        {stock <= 0 && (
          <Badge className="justify-self-start">
            {t('catalogue', 'outOfStock')}
          </Badge>
        )}
      </div>
    </Card>
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
