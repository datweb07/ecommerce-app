'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { TargetKind } from '../../lib/admin/banner-target';
import { useApiClient } from '../../lib/api/browser';
import { t } from '../../lib/i18n';
import { Input } from '../ui/fields';
import { selectClass } from './data';
import { FormLine } from './form-line';

export function BannerTarget({
  kind,
  value,
  change,
  error,
}: {
  kind: TargetKind;
  value: string;
  change: (kind: TargetKind, value: string) => void;
  error?: string | undefined;
}) {
  const api = useApiClient();
  const [search, setSearch] = useState('');
  const q = search.trim().slice(0, 80);
  const products = useQuery({
    queryKey: ['admin', 'banner-products', q],
    queryFn: () => api.products.list({ limit: '20', ...(q ? { q } : {}) }),
    enabled: kind === 'product',
  });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.list,
    enabled: kind === 'category',
  });
  const selected = useQuery({
    queryKey: ['admin', 'banner-target', value],
    queryFn: () => api.products.detail(value),
    enabled:
      kind === 'product' &&
      Boolean(value) &&
      !products.data?.items.some(({ id }) => id === value),
  });
  const list = products.data?.items ?? [];
  const names = Array.from(
    new Set([
      ...(categories.data?.items ?? []),
      ...(kind === 'category' && value ? [value] : []),
    ]),
  );

  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium">
        {t('admin', 'destination')}
      </legend>
      <label className="grid gap-1 text-sm">
        <span className="sr-only">{t('admin', 'destination')}</span>
        <select
          className={selectClass}
          value={kind}
          onChange={(event) => {
            const next = event.currentTarget.value;
            if (
              next === 'product' ||
              next === 'category' ||
              next === 'custom'
            ) {
              change(next, '');
              setSearch('');
            }
          }}
        >
          <option value="product">{t('admin', 'product')}</option>
          <option value="category">{t('admin', 'category')}</option>
          <option value="custom">{t('admin', 'customPath')}</option>
        </select>
      </label>
      {kind === 'product' && (
        <>
          <FormLine
            id="banner-product-search"
            label={t('admin', 'productSearch')}
          >
            <Input
              id="banner-product-search"
              type="search"
              maxLength={80}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
          </FormLine>
          <FormLine
            id="banner-product"
            label={t('admin', 'selectProduct')}
            error={error}
          >
            <select
              id="banner-product"
              className={selectClass}
              value={value}
              aria-invalid={Boolean(error)}
              onChange={(event) => change(kind, event.currentTarget.value)}
            >
              <option value="">—</option>
              {value && !list.some(({ id }) => id === value) && (
                <option value={value}>{selected.data?.name ?? value}</option>
              )}
              {list.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </FormLine>
        </>
      )}
      {kind === 'category' && (
        <FormLine
          id="banner-category"
          label={t('admin', 'selectCategory')}
          error={error}
        >
          <select
            id="banner-category"
            className={selectClass}
            value={value}
            aria-invalid={Boolean(error)}
            onChange={(event) => change(kind, event.currentTarget.value)}
          >
            <option value="">—</option>
            {names.map((name) => (
              <option value={name} key={name}>
                {name}
              </option>
            ))}
          </select>
        </FormLine>
      )}
      {kind === 'custom' && (
        <FormLine
          id="banner-custom"
          label={t('admin', 'customPath')}
          error={error}
        >
          <Input
            id="banner-custom"
            value={value}
            placeholder="/products"
            maxLength={2048}
            aria-invalid={Boolean(error)}
            onChange={(event) => change(kind, event.currentTarget.value)}
          />
        </FormLine>
      )}
    </fieldset>
  );
}
