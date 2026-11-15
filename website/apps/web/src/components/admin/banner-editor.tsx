'use client';

import {
  adminBannerCreate,
  adminBannerPatch,
  type PublicBanner,
} from '@storefront/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  initialTarget,
  targetPath,
  type TargetKind,
} from '../../lib/admin/banner-target';
import { adminKey } from '../../lib/admin/query';
import { refreshStorefront } from '../../lib/admin/cache-client';
import {
  uploadAdminImage,
  type Placement,
  type UploadedAsset,
} from '../../lib/admin/upload';
import { useApiClient } from '../../lib/api/browser';
import { publicEnv } from '../../config/public-env';
import { t } from '../../lib/i18n';
import { StorefrontBanner } from '../catalogue/banner';
import { Button } from '../ui/button';
import { Input, Switch } from '../ui/fields';
import { toastApiError } from '../ui/sonner';
import { AdminData, AdminTitle, selectClass } from './data';
import { FormLine } from './form-line';
import {
  allBanners,
  bannerListKey,
  bannerPath,
  type AdminBanner,
} from './banners';
import { BannerTarget } from './banner-target';
import { UploadInput } from './upload-input';

const bannerFields = adminBannerCreate.omit({
  imageDesktop: true,
  imageMobile: true,
  href: true,
  startsAt: true,
  endsAt: true,
});
type Fields = z.input<typeof bannerFields>;
type Images = Partial<Record<Placement, UploadedAsset>>;
const placements = ['desktop', 'mobile'] as const;

export function localDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function BannerPreview({ banner }: { banner: PublicBanner | null }) {
  const [placement, setPlacement] = useState<Placement>('desktop');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  return (
    <section className="space-y-4 border-t border-border pt-5 xl:border-t-0 xl:pt-0">
      <h2 className="text-heading font-medium">{t('admin', 'preview')}</h2>
      <div className="flex flex-wrap gap-3">
        <label className="space-y-1 text-sm">
          <span>{t('admin', 'previewDevice')}</span>
          <select
            className={selectClass}
            value={placement}
            onChange={(event) =>
              setPlacement(
                event.target.value === 'mobile' ? 'mobile' : 'desktop',
              )
            }
          >
            <option value="desktop">{t('admin', 'desktop')}</option>
            <option value="mobile">{t('admin', 'mobile')}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>{t('admin', 'previewTheme')}</span>
          <select
            className={selectClass}
            value={theme}
            onChange={(event) =>
              setTheme(event.target.value === 'dark' ? 'dark' : 'light')
            }
          >
            <option value="light">{t('admin', 'light')}</option>
            <option value="dark">{t('admin', 'dark')}</option>
          </select>
        </label>
      </div>
      <div
        className={
          theme +
          ' border border-border bg-background p-3 text-foreground sm:p-4'
        }
        data-testid="admin-banner-preview"
      >
        {banner ? (
          <div className={placement === 'mobile' ? 'mx-auto max-w-72' : ''}>
            <StorefrontBanner banner={banner} preview={placement} />
          </div>
        ) : (
          <p className="py-9 text-center text-sm text-muted-foreground">
            {t('admin', 'previewEmpty')}
          </p>
        )}
      </div>
    </section>
  );
}

export function BannerEditor({ banner }: { banner?: AdminBanner }) {
  const router = useRouter();
  const api = useApiClient().admin;
  const client = useQueryClient();
  const [target, setTarget] = useState(() => initialTarget(banner?.href ?? ''));
  const [dates, setDates] = useState(() => ({
    startsAt: localDate(banner?.startsAt),
    endsAt: localDate(banner?.endsAt),
  }));
  const [images, setImages] = useState<Images>(() =>
    banner ? { desktop: banner.imageDesktop, mobile: banner.imageMobile } : {},
  );
  const [changed, setChanged] = useState<Partial<Record<Placement, true>>>({});
  const [progress, setProgress] = useState(0);
  const form = useForm({
    resolver: zodResolver(bannerFields),
    defaultValues: {
      alt: banner?.alt ?? '',
      title: banner?.title ?? null,
      subtitle: banner?.subtitle ?? null,
      ctaLabel: banner?.ctaLabel ?? null,
      isActive: banner?.isActive ?? true,
    },
  });
  const values = useWatch({ control: form.control });
  const resolvedHref = targetPath(
    target.kind,
    target.value,
    publicEnv.NEXT_PUBLIC_SITE_URL,
  );
  const preview =
    images.desktop && images.mobile
      ? {
          id: banner?.id ?? '000000000000000000000000',
          imageDesktop: images.desktop,
          imageMobile: images.mobile,
          href: resolvedHref ?? '/products',
          alt: values.alt?.trim() || t('admin', 'assetAlt'),
          title: values.title ?? null,
          subtitle: values.subtitle ?? null,
          ctaLabel: values.ctaLabel ?? null,
        }
      : null;
  const upload = useMutation({
    mutationFn: ({ file, placement }: { file: File; placement: Placement }) =>
      uploadAdminImage({
        file,
        placement,
        sign: api.signature,
        purpose: 'banner',
        progress: setProgress,
      }),
    onSuccess: (asset, { placement }) => {
      setImages((previous) => ({ ...previous, [placement]: asset }));
      setChanged((previous) => ({ ...previous, [placement]: true }));
      form.clearErrors('root.images');
    },
  });
  const mutation = useMutation({
    mutationFn: (
      body:
        z.input<typeof adminBannerCreate> | z.input<typeof adminBannerPatch>,
    ) =>
      banner
        ? api.updateBanner(banner.id, body)
        : api.createBanner(body as z.input<typeof adminBannerCreate>),
    onSuccess: (row) => {
      void client.invalidateQueries({ queryKey: adminKey('banners') });
      setChanged({});
      toast.success(t('admin', 'saved'));
      refreshStorefront('banners');
      if (!banner) router.replace(bannerPath + '/' + row.id);
    },
    onError: toastApiError,
  });
  const busy = upload.isPending || mutation.isPending;
  function changeTarget(kind: TargetKind, value: string) {
    form.clearErrors('root.target');
    setTarget({ kind, value });
  }
  function submit(fields: Fields) {
    if (busy) return;
    if (!resolvedHref) {
      form.setError('root.target', {
        message: t('admin', 'invalidDestination'),
      });
      return;
    }
    if (!images.desktop || !images.mobile) {
      form.setError('root.images', { message: t('admin', 'previewEmpty') });
      return;
    }
    const startsAt = dates.startsAt
      ? new Date(dates.startsAt).toISOString()
      : null;
    const endsAt = dates.endsAt ? new Date(dates.endsAt).toISOString() : null;
    if (startsAt && endsAt && startsAt >= endsAt) {
      form.setError('root.schedule', { message: t('admin', 'invalidDates') });
      return;
    }
    const fieldsAndTarget = { ...fields, href: resolvedHref, startsAt, endsAt };
    const ref = ({ url, publicId }: UploadedAsset) => ({ url, publicId });
    const body = banner
      ? adminBannerPatch.safeParse({
          ...fieldsAndTarget,
          ...(changed.desktop ? { imageDesktop: ref(images.desktop) } : {}),
          ...(changed.mobile ? { imageMobile: ref(images.mobile) } : {}),
        })
      : adminBannerCreate.safeParse({
          ...fieldsAndTarget,
          imageDesktop: ref(images.desktop),
          imageMobile: ref(images.mobile),
        });
    if (!body.success) {
      form.setError('root.images', { message: t('admin', 'invalid') });
      return;
    }
    mutation.mutate(body.data);
  }
  const fieldError = (field: keyof Fields) =>
    form.formState.errors[field] ? t('admin', 'invalid') : undefined;
  const optional = {
    setValueAs: (value: unknown) =>
      typeof value === 'string' ? value.trim() || null : value,
  };
  return (
    <>
      <AdminTitle
        title={t('admin', banner ? 'editBanner' : 'addBanner')}
        action={
          <Button asChild variant="outline">
            <Link href={bannerPath}>{t('admin', 'banners')}</Link>
          </Button>
        }
      />
      <div className="grid gap-8 xl:grid-cols-2">
        <form
          className="space-y-5"
          noValidate
          onSubmit={form.handleSubmit(submit)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {placements.map((placement) => (
              <UploadInput
                key={placement}
                label={t(
                  'admin',
                  placement === 'desktop' ? 'bannerDesktop' : 'bannerMobile',
                )}
                hint={
                  t(
                    'admin',
                    placement === 'desktop'
                      ? 'recommendedDesktop'
                      : 'recommendedMobile',
                  ) +
                  ' ' +
                  t('admin', 'imageHint')
                }
                busy={
                  upload.isPending && upload.variables?.placement === placement
                }
                disabled={busy}
                percent={progress}
                error={
                  upload.variables?.placement === placement
                    ? upload.error
                    : null
                }
                onFiles={([file]) => {
                  if (file && !busy) {
                    setProgress(0);
                    upload.mutate({ file, placement });
                  }
                }}
              />
            ))}
          </div>
          {form.formState.errors.root?.images?.message && (
            <p role="alert" className="text-sm text-destructive">
              {form.formState.errors.root.images.message}
            </p>
          )}
          <FormLine
            id="banner-alt"
            label={t('admin', 'bannerAlt')}
            error={fieldError('alt')}
          >
            <Input
              id="banner-alt"
              maxLength={180}
              {...form.register('alt')}
              aria-invalid={Boolean(fieldError('alt'))}
            />
          </FormLine>
          {(
            [
              ['title', 'bannerTitle', 100],
              ['subtitle', 'subtitle', 180],
              ['ctaLabel', 'cta', 40],
            ] as const
          ).map(([name, label, limit]) => (
            <FormLine
              key={name}
              id={'banner-' + name}
              label={t('admin', label)}
              error={fieldError(name)}
            >
              <Input
                id={'banner-' + name}
                maxLength={limit}
                {...form.register(name, optional)}
                aria-invalid={Boolean(fieldError(name))}
              />
            </FormLine>
          ))}
          <BannerTarget
            kind={target.kind}
            value={target.value}
            change={changeTarget}
            error={form.formState.errors.root?.target?.message}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {(['startsAt', 'endsAt'] as const).map((field) => (
              <FormLine
                key={field}
                id={'banner-' + field}
                label={t('admin', field)}
              >
                <Input
                  id={'banner-' + field}
                  type="datetime-local"
                  value={dates[field]}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDates((previous) => ({ ...previous, [field]: value }));
                    form.clearErrors('root.schedule');
                  }}
                />
              </FormLine>
            ))}
          </div>
          {form.formState.errors.root?.schedule?.message && (
            <p role="alert" className="text-sm text-destructive">
              {form.formState.errors.root.schedule.message}
            </p>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Switch
              id="banner-active"
              checked={values.isActive ?? false}
              onCheckedChange={(value) => form.setValue('isActive', value)}
            />
            <label htmlFor="banner-active">{t('admin', 'enabled')}</label>
          </div>
          <Button type="submit" disabled={busy}>
            {t('admin', 'save')}
          </Button>
        </form>
        <BannerPreview banner={preview} />
      </div>
    </>
  );
}

export function BannerEditorRoute({ id }: { id: string }) {
  const api = useApiClient().admin;
  const query = useQuery({
    queryKey: bannerListKey,
    queryFn: () => api.banners(allBanners),
  });
  return (
    <AdminData result={query} variant="form">
      {({ items }) => {
        const banner = items.find((row) => row.id === id);
        return banner ? (
          <BannerEditor key={banner.id} banner={banner} />
        ) : (
          <AdminTitle
            title={t('admin', 'bannerMissing')}
            action={
              <Button asChild>
                <Link href={bannerPath}>{t('admin', 'banners')}</Link>
              </Button>
            }
          />
        );
      }}
    </AdminData>
  );
}
