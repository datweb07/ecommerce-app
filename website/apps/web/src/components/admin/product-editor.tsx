'use client';

import {
  adminProductCreate,
  adminProductPatch,
  adminStockInput,
  type adminProductDto,
} from '@storefront/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApiClient } from '../../lib/api/browser';
import { refreshStorefront } from '../../lib/admin/cache-client';
import {
  imageFileInput,
  maxProductImages,
  uploadAdminImage,
} from '../../lib/admin/upload';
import { moveItem } from '../../lib/admin/ordering';
import { adminKey } from '../../lib/admin/query';
import { t } from '../../lib/i18n';
import { ProductImage } from '../catalogue/product-image';
import { ConfirmDialog } from '../common/confirm-dialog';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../ui/overlays';
import { Input, Textarea } from '../ui/fields';
import { toastApiError } from '../ui/sonner';
import { AdminData, AdminTitle, selectClass } from './data';
import { FormLine } from './form-line';
import { productPath, StockStatus } from './products';
import { UploadInput } from './upload-input';

type Product = z.infer<typeof adminProductDto>;
type Images = Product['imageAssets'];
type Create = z.input<typeof adminProductCreate>;
type Patch = z.input<typeof adminProductPatch>;
type Stock = z.input<typeof adminStockInput>;
const productFields = adminProductCreate.omit({ images: true });

function StockEditor({
  product,
  onSaved,
}: {
  product: Product;
  onSaved: (row: Product) => void;
}) {
  const api = useApiClient().admin;
  const [open, setOpen] = useState(false);
  const form = useForm<Stock>({
    resolver: zodResolver(adminStockInput),
    defaultValues: { delta: 0, reason: 'inventory_count' },
  });
  const stock = useMutation({
    mutationFn: (body: Stock) => api.stock(product.id, body),
    onSuccess: (row) => {
      onSaved(row);
      form.reset();
      setOpen(false);
      toast.success(t('admin', 'saved'));
    },
    onError: toastApiError,
  });
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
      <p className="text-sm">
        {t('admin', 'stock')} <strong className="ml-1">{product.stock}</strong>{' '}
        <span className="ml-2">
          <StockStatus status={product.stockStatus} />
        </span>
      </p>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!stock.isPending) setOpen(value);
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline">{t('admin', 'stockAdjust')}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle className="pr-7 text-heading font-medium">
            {t('admin', 'stockAdjust')}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t('admin', 'stock')} · {product.stock}
          </DialogDescription>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((body) => {
              if (!stock.isPending) stock.mutate(body);
            })}
          >
            <FormLine
              id="stock-delta"
              label={t('admin', 'stockDelta')}
              error={
                form.formState.errors.delta ? t('admin', 'invalid') : undefined
              }
            >
              <Input
                id="stock-delta"
                type="number"
                step="1"
                {...form.register('delta', { valueAsNumber: true })}
                aria-invalid={Boolean(form.formState.errors.delta)}
              />
            </FormLine>
            <FormLine id="stock-reason" label={t('admin', 'reason')}>
              <select
                id="stock-reason"
                className={selectClass}
                {...form.register('reason')}
              >
                {adminStockInput.shape.reason.options.map((value) => (
                  <option value={value} key={value}>
                    {t('admin', value)}
                  </option>
                ))}
              </select>
            </FormLine>
            <Button type="submit" disabled={stock.isPending}>
              {t('admin', 'save')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function ProductEditor({ product }: { product?: Product }) {
  const router = useRouter();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [images, setImages] = useState<Images>(product?.imageAssets ?? []);
  const [changed, setChanged] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageError, setImageError] = useState<unknown>();
  const dataList = useId();
  const form = useForm({
    resolver: zodResolver(productFields),
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      price: product?.price ?? 0,
      stock: product?.stock ?? 0,
      category: product?.category ?? '',
    },
  });
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.list,
  });
  const saved = (row: Product) => {
    queryClient.setQueryData(adminKey('product', row.id), row);
    void queryClient.invalidateQueries({ queryKey: adminKey('products') });
    void queryClient.invalidateQueries({ queryKey: adminKey('stats') });
    refreshStorefront('catalogue');
  };
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      if (images.length + files.length > maxProductImages) {
        form.setError('root.images', { message: t('admin', 'imageLimit') });
        return;
      }
      files.forEach((file) => imageFileInput(file, 'product'));
      for (const [index, file] of files.entries()) {
        const asset = await uploadAdminImage({
          file,
          sign: api.admin.signature,
          purpose: 'product',
          progress: (value) =>
            setProgress(
              Math.round(((index + value / 100) / files.length) * 100),
            ),
        });
        setImages((list) => [
          ...list,
          { url: asset.url, publicId: asset.publicId },
        ]);
        setChanged(true);
      }
    },
    onError: setImageError,
  });
  const mutation = useMutation({
    mutationFn: (body: Create | Patch) =>
      product
        ? api.admin.updateProduct(product.id, body)
        : api.admin.createProduct(body as Create),
    onSuccess: (row) => {
      saved(row);
      setChanged(false);
      toast.success(t('admin', 'saved'));
      if (!product) router.replace(productPath + '/' + row.id);
    },
    onError: toastApiError,
  });
  const remove = useMutation({
    mutationFn: api.admin.deleteProduct,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKey('products') });
      void queryClient.invalidateQueries({ queryKey: adminKey('stats') });
      refreshStorefront('catalogue');
      toast.success(t('admin', 'deleted'));
      router.push(productPath);
    },
    onError: toastApiError,
  });
  const busy = upload.isPending || mutation.isPending || remove.isPending;
  const fieldError = (name: keyof Create) => {
    if (name !== 'images' && form.formState.errors[name])
      return t('admin', 'invalid');
  };
  function changeImages(next: Images) {
    setImages(next);
    setChanged(true);
    form.clearErrors('root.images');
  }
  return (
    <>
      <AdminTitle
        title={t('admin', product ? 'editProduct' : 'addProduct')}
        description={product?.name}
        action={
          <Button asChild variant="outline">
            <Link href={productPath}>{t('admin', 'products')}</Link>
          </Button>
        }
      />
      {product && <StockEditor product={product} onSaved={saved} />}
      <form
        noValidate
        className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        onSubmit={form.handleSubmit(({ stock, ...fields }) => {
          if (busy) return;
          const body = product
            ? adminProductPatch.safeParse({
                ...fields,
                ...(changed ? { images } : {}),
              })
            : adminProductCreate.safeParse({ ...fields, stock, images });
          if (!body.success) {
            form.setError('root.images', {
              message: images.length
                ? t('admin', 'invalid')
                : t('admin', 'imageRequired'),
            });
            return;
          }
          mutation.mutate(body.data);
        })}
      >
        <div className="space-y-5">
          <FormLine
            id="product-name"
            label={t('admin', 'name')}
            error={fieldError('name')}
          >
            <Input
              id="product-name"
              maxLength={200}
              {...form.register('name')}
              aria-invalid={Boolean(fieldError('name'))}
            />
          </FormLine>
          <FormLine
            id="product-description"
            label={t('admin', 'description')}
            error={fieldError('description')}
          >
            <Textarea
              id="product-description"
              rows={6}
              {...form.register('description')}
              aria-invalid={Boolean(fieldError('description'))}
            />
          </FormLine>
          <FormLine
            id="product-category"
            label={t('admin', 'category')}
            error={fieldError('category')}
          >
            <Input
              id="product-category"
              list={dataList}
              maxLength={100}
              {...form.register('category')}
              aria-invalid={Boolean(fieldError('category'))}
            />
            <datalist id={dataList}>
              {categories.data?.items.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </FormLine>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormLine
              id="product-price"
              label={t('admin', 'price')}
              error={fieldError('price')}
            >
              <Input
                id="product-price"
                type="number"
                step="0.01"
                min="0.01"
                {...form.register('price', { valueAsNumber: true })}
                aria-invalid={Boolean(fieldError('price'))}
              />
            </FormLine>
            {!product && (
              <FormLine
                id="product-stock"
                label={t('admin', 'initialStock')}
                error={fieldError('stock')}
              >
                <Input
                  id="product-stock"
                  type="number"
                  step="1"
                  min="0"
                  {...form.register('stock', { valueAsNumber: true })}
                  aria-invalid={Boolean(fieldError('stock'))}
                />
              </FormLine>
            )}
          </div>
          <Button type="submit" disabled={busy}>
            {t('admin', 'save')}
          </Button>
        </div>
        <section className="space-y-4">
          <h2 className="text-heading font-medium">{t('admin', 'images')}</h2>
          {product &&
            product.images.length > 0 &&
            !product.imageAssets.length &&
            !changed && (
              <>
                <p className="text-sm text-muted-foreground">
                  {t('admin', 'legacyImages')}
                </p>
                <div className="flex gap-2">
                  {product.images.map((url, index) => (
                    <span
                      className="relative block size-14 overflow-hidden rounded-control"
                      key={index}
                    >
                      <ProductImage
                        source={url}
                        alt={t('admin', 'assetAlt') + ' ' + (index + 1)}
                        sizes="56px"
                        className="object-cover"
                      />
                    </span>
                  ))}
                </div>
              </>
            )}
          <UploadInput
            label={t('admin', 'chooseFiles')}
            hint={t('admin', 'imageHint') + ' ' + t('admin', 'imageLimit')}
            busy={upload.isPending}
            disabled={busy}
            percent={progress}
            error={imageError}
            multiple
            onFiles={(files) => {
              if (!busy) {
                setProgress(0);
                setImageError(undefined);
                form.clearErrors('root.images');
                upload.mutate(files);
              }
            }}
          />
          {form.formState.errors.root?.images && (
            <p role="alert" className="text-sm text-destructive">
              {form.formState.errors.root.images.message}
            </p>
          )}
          <ol className="space-y-2">
            {images.map((image, index) => (
              <li
                className="flex flex-wrap items-center gap-2 border-b border-border pb-2"
                key={image.publicId}
              >
                <span className="relative block size-14 overflow-hidden rounded-control">
                  <ProductImage
                    source={image.url}
                    alt={t('admin', 'assetAlt') + ' ' + (index + 1)}
                    sizes="56px"
                    className="object-cover"
                  />
                </span>
                {index === 0 && (
                  <span className="text-xs text-muted-foreground">
                    {t('admin', 'cover')}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="small"
                  disabled={busy || index === 0}
                  onClick={() => changeImages(moveItem(images, index, 0))}
                >
                  {t('admin', 'useCover')}
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  disabled={busy || index === 0}
                  aria-label={t('admin', 'moveUp') + ' · ' + (index + 1)}
                  onClick={() =>
                    changeImages(moveItem(images, index, index - 1))
                  }
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  disabled={busy || index === images.length - 1}
                  aria-label={t('admin', 'moveDown') + ' · ' + (index + 1)}
                  onClick={() =>
                    changeImages(moveItem(images, index, index + 1))
                  }
                >
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    changeImages(
                      images.filter(
                        (entry) => entry.publicId !== image.publicId,
                      ),
                    )
                  }
                >
                  {t('admin', 'removeImage')}
                </Button>
              </li>
            ))}
          </ol>
        </section>
      </form>
      {product && (
        <div className="border-t border-border pt-5">
          <ConfirmDialog
            title={t('admin', 'delete') + ' ' + product.name}
            description={t('admin', 'deleteProductHint')}
            confirmLabel={t('admin', 'delete')}
            trigger={
              <Button variant="danger" disabled={busy}>
                {t('admin', 'delete')}
              </Button>
            }
            onConfirm={() => {
              if (!busy) remove.mutate(product.id);
            }}
          />
        </div>
      )}
    </>
  );
}

export function ProductEditorRoute({ id }: { id: string }) {
  const api = useApiClient().admin;
  const query = useQuery({
    queryKey: adminKey('product', id),
    queryFn: () => api.product(id),
  });
  return (
    <AdminData result={query} variant="form">
      {(product) => <ProductEditor key={product.id} product={product} />}
    </AdminData>
  );
}
