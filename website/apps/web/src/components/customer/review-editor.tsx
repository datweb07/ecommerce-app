'use client';
import { reviewPatch } from '@storefront/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useApiClient } from '../../lib/api/browser';
import { queryKeys } from '../../lib/query';
import { t } from '../../lib/i18n';
import { ConfirmDialog } from '../common/confirm-dialog';
import { RatingStars } from '../common/rating-stars';
import { Button } from '../ui/button';
import { toastApiError } from '../ui/sonner';
import type { Order } from './orders';

export function ReviewEditor({
  orderId,
  item,
}: {
  orderId: string;
  item: Order['items'][number];
}) {
  const api = useApiClient();
  const client = useQueryClient();
  const [draft, setDraft] = useState<number>();
  const rating = draft ?? item.review?.rating ?? 0;
  const mutation = useMutation({
    mutationFn: async (remove: boolean) => {
      if (remove && item.review) {
        await api.reviews.remove(item.review.id);
        return null;
      }
      const input = reviewPatch.parse({ rating });
      return item.review
        ? api.reviews.update(item.review.id, input)
        : api.reviews.add({ ...input, productId: item.productId, orderId });
    },
    onSuccess: async (review) => {
      client.setQueryData<Order>(
        queryKeys.order(orderId),
        (order) =>
          order && {
            ...order,
            items: order.items.map((line) =>
              line.productId === item.productId
                ? {
                    ...line,
                    review: review
                      ? { id: review.id, rating: review.rating }
                      : null,
                    canReview: !review,
                  }
                : line,
            ),
          },
      );
      setDraft(undefined);
      toast.success(t('reviews', 'saved'));
      await client.invalidateQueries({ queryKey: queryKeys.order(orderId) });
    },
    onError: (error) => {
      toastApiError(error);
      void client.invalidateQueries({ queryKey: queryKeys.order(orderId) });
    },
  });
  if (!item.canReview && !item.review) return null;
  return (
    <fieldset
      disabled={mutation.isPending}
      className="grid justify-items-start gap-2"
    >
      <legend className="font-semibold">
        {t('reviews', item.review ? 'yourRating' : 'rate')}
      </legend>
      <RatingStars value={rating} onChange={setDraft} />
      <div className="flex flex-wrap gap-2">
        <Button
          size="small"
          disabled={!rating || rating === item.review?.rating}
          onClick={() => mutation.mutate(false)}
        >
          {t('reviews', item.review ? 'update' : 'submit')}
        </Button>
        {item.review && (
          <ConfirmDialog
            title={t('reviews', 'remove')}
            description={t('reviews', 'removeHint')}
            trigger={
              <Button size="small" variant="outline">
                {t('reviews', 'remove')}
              </Button>
            }
            onConfirm={() => mutation.mutate(true)}
          />
        )}
      </div>
    </fieldset>
  );
}
