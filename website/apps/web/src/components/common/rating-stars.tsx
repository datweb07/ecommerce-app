'use client';
import { Star } from 'lucide-react';
import { useId } from 'react';

export function RatingStars({
  value,
  onChange,
}: {
  value: number;
  onChange?: (value: number) => void;
}) {
  const group = useId();
  const stars = [1, 2, 3, 4, 5];
  const icon = (stars: number) => (
    <Star
      aria-hidden="true"
      size={19}
      fill={value >= stars ? 'currentColor' : 'none'}
    />
  );
  if (!onChange)
    return (
      <span
        role="img"
        aria-label={`${new Intl.NumberFormat('vi-VN').format(value)} trên 5 sao`}
        className="inline-flex gap-1 text-primary"
      >
        {stars.map((star) => (
          <span key={star}>{icon(star)}</span>
        ))}
      </span>
    );
  return (
    <fieldset className="inline-flex flex-wrap text-primary">
      <legend className="sr-only">Đánh giá sản phẩm</legend>
      {stars.map((star) => (
        <label key={star} className="relative">
          <input
            type="radio"
            name={group}
            value={star}
            checked={star === value}
            onChange={() => onChange(star)}
            className="peer sr-only"
          />
          <span className="sr-only">{star} sao</span>
          <span className="grid size-11 cursor-pointer place-items-center rounded-control peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary hover:bg-muted">
            {icon(star)}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
