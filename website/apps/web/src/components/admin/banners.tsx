'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { adminBannerDto } from '@storefront/shared';
import { useState } from 'react';
import type { z } from 'zod';
import Image from 'next/image';
import Link from 'next/link';
import { GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { useApiClient } from '../../lib/api/browser';
import { ApiError } from '../../lib/api/transport';
import { refreshStorefront } from '../../lib/admin/cache-client';
import { moveItem } from '../../lib/admin/ordering';
import { adminDate, adminKey } from '../../lib/admin/query';
import { t } from '../../lib/i18n';
import { Button } from '../ui/button';
import { Switch } from '../ui/fields';
import { toastApiError } from '../ui/sonner';
import { ConfirmDialog } from '../common/confirm-dialog';
import { AdminData, AdminTitle } from './data';

export type AdminBanner = z.infer<typeof adminBannerDto>;
export const bannerPath = '/admin/banners';
export const allBanners = { limit: '50' };
export const bannerListKey = adminKey('banners', allBanners);

export function AdminBanners() {
  const api = useApiClient().admin;
  const client = useQueryClient();
  const list = useQuery({
    queryKey: bannerListKey,
    queryFn: () => api.banners(allBanners),
  });
  const [dragId, setDragId] = useState<string>();
  const saved = async () => {
    await client.invalidateQueries({ queryKey: adminKey('banners') });
    toast.success(t('admin', 'saved'));
    refreshStorefront('banners');
  };
  const mutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.updateBanner(id, { isActive: enabled }),
    onSuccess: saved,
    onError: toastApiError,
  });
  const remove = useMutation({
    mutationFn: api.deleteBanner,
    onSuccess: saved,
    onError: toastApiError,
  });
  const reorder = useMutation({
    mutationFn: api.reorderBanners,
    onSuccess: saved,
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(t('admin', 'bannerOrderConflict'));
        void list.refetch();
      } else toastApiError(error);
    },
  });
  const pending = mutation.isPending || remove.isPending || reorder.isPending;
  function move(rows: AdminBanner[], from: number, to: number) {
    if (!pending && from >= 0 && to >= 0 && to < rows.length && from !== to)
      reorder.mutate(moveItem(rows, from, to).map(({ id }) => id));
  }
  return (
    <>
      <AdminTitle
        title={t('admin', 'banners')}
        action={
          <Button asChild>
            <Link href={bannerPath + '/new'}>{t('admin', 'addBanner')}</Link>
          </Button>
        }
      />
      <AdminData result={list}>
        {({ items }) =>
          items.length ? (
            <ol className="space-y-1" aria-label={t('admin', 'banners')}>
              {items.map((banner, index) => {
                const title = banner.title ?? banner.alt;
                const rowId = 'banner-status-' + banner.id;
                return (
                  <li
                    key={banner.id}
                    onDragOver={(event) => {
                      if (dragId && !pending) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragId)
                        move(
                          items,
                          items.findIndex(({ id }) => id === dragId),
                          index,
                        );
                      setDragId(undefined);
                    }}
                    className="grid items-center gap-3 border-b border-border py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="hidden cursor-grab p-1 text-muted-foreground sm:inline-flex"
                        draggable={!pending}
                        onDragStart={(event) => {
                          if (pending) return;
                          event.dataTransfer.setData('text/plain', banner.id);
                          event.dataTransfer.effectAllowed = 'move';
                          setDragId(banner.id);
                        }}
                        onDragEnd={() => setDragId(undefined)}
                      >
                        <GripVertical size={17} aria-hidden="true" />
                      </span>
                      <Image
                        src={banner.imageDesktop.url}
                        alt={banner.alt}
                        width={96}
                        height={48}
                        sizes="96px"
                        className="h-12 w-24 rounded-control bg-muted object-cover"
                      />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <Link
                        href={bannerPath + '/' + banner.id}
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {title}
                      </Link>
                      <p className="text-xs break-all text-muted-foreground">
                        {banner.href}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('admin', 'schedule')} ·{' '}
                        {banner.startsAt || banner.endsAt
                          ? adminDate(banner.startsAt, true) +
                            ' → ' +
                            adminDate(banner.endsAt, true)
                          : t('admin', 'startUnspecified')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="mr-2 flex items-center gap-2 text-xs">
                        <Switch
                          id={rowId}
                          aria-label={t('admin', 'enabled') + ' · ' + title}
                          checked={banner.isActive}
                          disabled={pending}
                          onCheckedChange={(enabled) => {
                            if (!pending)
                              mutation.mutate({ id: banner.id, enabled });
                          }}
                        />
                        <label htmlFor={rowId}>
                          {t('admin', banner.isActive ? 'active' : 'inactive')}
                        </label>
                      </div>
                      <Button
                        variant="ghost"
                        size="small"
                        disabled={pending || index === 0}
                        aria-label={t('admin', 'moveUp') + ' · ' + title}
                        onClick={() => move(items, index, index - 1)}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="small"
                        disabled={pending || index === items.length - 1}
                        aria-label={t('admin', 'moveDown') + ' · ' + title}
                        onClick={() => move(items, index, index + 1)}
                      >
                        ↓
                      </Button>
                      <ConfirmDialog
                        title={t('admin', 'delete') + ' ' + title}
                        description={t('admin', 'deleteBannerHint')}
                        confirmLabel={t('admin', 'delete')}
                        trigger={
                          <Button
                            variant="ghost"
                            size="small"
                            disabled={pending}
                          >
                            {t('admin', 'delete')}
                          </Button>
                        }
                        onConfirm={() => {
                          if (!pending) remove.mutate(banner.id);
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="border-b border-border py-8 text-sm text-muted-foreground">
              {t('admin', 'empty')}
            </p>
          )
        }
      </AdminData>
    </>
  );
}
