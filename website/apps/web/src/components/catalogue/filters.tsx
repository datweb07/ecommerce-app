'use client';
import { SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from 'react';
import type { ProductFilters } from '../../lib/api/domains';
import {
  catalogueHref,
  catalogueSort,
  maxSearchLength,
  normalizeCatalogue,
} from '../../lib/catalogue-query';
import { t } from '../../lib/i18n';
import { Button } from '../ui/button';
import { Input, Label } from '../ui/fields';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '../ui/overlays';

function FilterForm({
  initial,
  categories,
  close,
}: {
  initial: ProductFilters;
  categories: string[];
  close?: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();
  const [appliedSearch, setAppliedSearch] = useState(initial.q ?? '');
  const [search, setSearch] = useState(appliedSearch);
  if (appliedSearch !== (initial.q ?? '')) {
    setAppliedSearch(initial.q ?? '');
    setSearch(initial.q ?? '');
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function navigate(form: HTMLFormElement) {
    if (!form.checkValidity()) return false;
    const data = Object.fromEntries(new FormData(form));
    const query = normalizeCatalogue({
      q: String(data.q ?? ''),
      category: String(data.category ?? ''),
      minPrice: String(data.minPrice ?? '').replace(',', '.'),
      maxPrice: String(data.maxPrice ?? '').replace(',', '.'),
      minRating: String(data.minRating ?? ''),
      sort: String(data.sort ?? ''),
      inStock: String(data.inStock ?? ''),
      ...(initial.limit ? { limit: initial.limit } : {}),
    });
    startTransition(() => router.push(catalogueHref(query), { scroll: false }));
    return true;
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (timer.current) clearTimeout(timer.current);
    if (navigate(event.currentTarget)) close?.();
  }
  const selectStyle =
    'min-h-11 w-full rounded-control border border-border bg-card px-3 text-sm';
  return (
    <form
      action="/products"
      onSubmit={submit}
      className="grid gap-4"
      aria-busy={pending}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={id + 'q'}>{t('nav', 'search')}</Label>
        <Input
          id={id + 'q'}
          name="q"
          type="search"
          value={search}
          maxLength={maxSearchLength}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            const form = event.currentTarget.form;
            if (!form) return;
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => navigate(form), 350);
          }}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id + 'category'}>{t('nav', 'categories')}</Label>
        <select
          id={id + 'category'}
          name="category"
          className={selectStyle}
          defaultValue={initial.category ?? ''}
        >
          <option value="">{t('catalogue', 'allCategories')}</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1.5 text-sm font-semibold">
          {t('catalogue', 'priceRange')}
        </legend>
        {(['minPrice', 'maxPrice'] as const).map((key) => (
          <div className="grid min-w-0 gap-1" key={key}>
            <Label className="text-xs" htmlFor={id + key}>
              {t('catalogue', key)}
            </Label>
            <Input
              id={id + key}
              name={key}
              type="text"
              inputMode="decimal"
              pattern="[0-9]{1,9}([.,][0-9]{1,2})?"
              maxLength={12}
              defaultValue={initial[key]}
            />
          </div>
        ))}
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor={id + 'rating'}>{t('catalogue', 'minRating')}</Label>
        <select
          id={id + 'rating'}
          name="minRating"
          className={selectStyle}
          defaultValue={initial.minRating ?? ''}
        >
          <option value="">{t('catalogue', 'anyRating')}</option>
          {Array.from(
            new Set([
              '1',
              '2',
              '3',
              '4',
              '5',
              ...(initial.minRating ? [initial.minRating] : []),
            ]),
          ).map((rating) => (
            <option key={rating} value={rating}>
              {rating} {t('catalogue', 'stars')}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id + 'sort'}>{t('catalogue', 'sort')}</Label>
        <select
          id={id + 'sort'}
          name="sort"
          className={selectStyle}
          defaultValue={initial.sort ?? 'newest'}
        >
          {catalogueSort.map((sort) => (
            <option key={sort} value={sort}>
              {t('catalogue', sort)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id + 'stock'}>{t('catalogue', 'stock')}</Label>
        <select
          id={id + 'stock'}
          name="inStock"
          className={selectStyle}
          defaultValue={initial.inStock ?? ''}
        >
          <option value="">{t('catalogue', 'anyStock')}</option>
          <option value="true">{t('catalogue', 'inStock')}</option>
          <option value="false">{t('catalogue', 'outOfStock')}</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {t('catalogue', 'apply')}
      </Button>
    </form>
  );
}

export function CatalogueFilters({
  query,
  categories,
}: {
  query: ProductFilters;
  categories: string[];
}) {
  const [open, setOpen] = useState(false);
  const options = Array.from(
    new Set([...(query.category ? [query.category] : []), ...categories]),
  );
  const { q, page, ...filters } = query;
  const formKey = catalogueHref(filters);
  const initial = { ...filters, q, page };
  return (
    <>
      <aside
        aria-label={t('catalogue', 'filters')}
        className="hidden self-start rounded-panel border border-border bg-card p-5 lg:block"
      >
        <h2 className="mb-5 text-lg font-bold">{t('catalogue', 'filters')}</h2>
        <FilterForm key={formKey} initial={initial} categories={options} />
      </aside>
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal size={16} aria-hidden="true" />
              {t('catalogue', 'filters')}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle className="text-xl font-bold">
              {t('catalogue', 'filters')}
            </SheetTitle>
            <SheetDescription className="mt-1 mb-5 text-sm text-muted-foreground">
              {t('catalogue', 'filterDescription')}
            </SheetDescription>
            <FilterForm
              key={formKey}
              initial={initial}
              categories={options}
              close={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
